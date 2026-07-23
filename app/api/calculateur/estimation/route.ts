import { NextRequest, NextResponse } from 'next/server';
import {
  createCustomer,
  findCustomerByEmail,
  subscribeCustomerEmailMarketing,
} from '@/lib/shopify-customers';
import { createDraftOrder, sendDraftOrderInvoice } from '@/lib/shopify-draft-orders';
import { isValidEmail, isValidPhone } from '@/lib/utils';
import { normalizeFrenchPhone } from '@/lib/utils/phone';

/**
 * POST /api/calculateur/estimation
 *
 * Sortie "✉️ Recevoir mon estimation par e-mail" : enchaîne côté serveur
 *   1. recherche/création du client Shopify (tag `calculateur`, consentement
 *      marketing single opt-in si la case est cochée)
 *   2. création du draft order remisé -15% (même remise réelle que le flux direct)
 *   3. envoi de l'e-mail invoice Shopify
 *
 * Toute la chaîne utilise l'Admin API : serveur uniquement, aucun customerId
 * ne transite côté client.
 */

// ==================== RATE LIMITING ====================
// Limite simple par IP : la route crée de vrais clients et draft orders Shopify
// sur une app publique. Fenêtre glissante en mémoire — sur Vercel, la Map est
// par instance serverless (best-effort, remise à zéro à chaque cold start) :
// suffisant contre un abus naïf, sans dépendance externe.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 5; // par IP et par fenêtre
const rateLimitHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateLimitHits.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitHits.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitHits.set(ip, recent);

  // Purge périodique pour borner la mémoire de l'instance
  if (rateLimitHits.size > 1000) {
    rateLimitHits.forEach((timestamps, key) => {
      if (timestamps.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitHits.delete(key);
      }
    });
  }

  return false;
}

function getClientIp(request: NextRequest): string {
  // Vercel place l'IP réelle en tête de x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

// ==================== VALIDATION ====================
// Même exigence que le permalink : GID de variante strict (suffixe de contexte
// @inContext toléré), normalisé avant envoi à l'Admin API.
const VARIANT_GID_REGEX = /^gid:\/\/shopify\/ProductVariant\/(\d+)(?:\?.*)?$/;

interface EstimationRequestBody {
  email?: string;
  prenom?: string;
  nom?: string;
  telephone?: string;
  consentementMarketing?: boolean;
  lineItems?: Array<{ variantId?: string; quantity?: number }>;
}

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(getClientIp(request))) {
      return NextResponse.json(
        { error: 'Trop de demandes. Merci de réessayer dans quelques minutes.' },
        { status: 429 }
      );
    }

    const body: EstimationRequestBody = await request.json();
    const email = body.email?.trim() ?? '';
    const prenom = body.prenom?.trim() || undefined;
    const nom = body.nom?.trim() || undefined;
    const telephone = body.telephone?.trim() || undefined;
    const consentementMarketing = body.consentementMarketing === true;

    // E-mail requis ; prénom/nom/téléphone optionnels (téléphone validé si fourni)
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 });
    }
    if (telephone && !isValidPhone(telephone)) {
      return NextResponse.json({ error: 'Numéro de téléphone invalide' }, { status: 400 });
    }

    const rawLineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
    if (rawLineItems.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    const lineItems: Array<{ variantId: string; quantity: number }> = [];
    for (const item of rawLineItems) {
      const match = VARIANT_GID_REGEX.exec(item.variantId ?? '');
      const quantiteValide = Number.isInteger(item.quantity) && (item.quantity as number) > 0;
      if (!match || !quantiteValide) {
        return NextResponse.json(
          { error: 'Une ligne du panier est invalide' },
          { status: 422 }
        );
      }
      lineItems.push({
        variantId: `gid://shopify/ProductVariant/${match[1]}`,
        quantity: item.quantity as number,
      });
    }

    const normalizedPhone = telephone ? normalizeFrenchPhone(telephone) : null;

    // 1. Recherche/création du client
    let customer = await findCustomerByEmail(email);

    if (!customer) {
      customer = await createCustomer({
        email,
        firstName: prenom,
        lastName: nom,
        phone: normalizedPhone || undefined,
        tags: ['calculateur'],
        emailMarketingConsent: consentementMarketing,
      });

      // Un téléphone déjà pris par un autre compte fait échouer customerCreate :
      // on retente sans téléphone plutôt que de bloquer l'estimation.
      if (!customer && normalizedPhone) {
        customer = await createCustomer({
          email,
          firstName: prenom,
          lastName: nom,
          tags: ['calculateur'],
          emailMarketingConsent: consentementMarketing,
        });
      }

      if (!customer) {
        return NextResponse.json(
          { error: 'Impossible de créer votre fiche client. Merci de réessayer.' },
          { status: 500 }
        );
      }
    } else if (consentementMarketing) {
      // Client déjà connu qui coche la case : enregistrer son consentement
      // (non bloquant pour l'envoi de l'estimation)
      await subscribeCustomerEmailMarketing(customer.id);
    }

    // 2. Draft order remisé -15% (les line items portent le prix catalogue plein,
    // `appliedDiscount` applique la même remise réelle que le code promo du flux
    // direct : total identique au panier de l'app)
    const draftOrder = await createDraftOrder({
      customerId: customer.id,
      lineItems,
      email,
      phone: normalizedPhone || undefined,
      note: 'Estimation envoyée par le calculateur - à finaliser par le client',
      tags: ['projet-sauvegarde', 'calculateur'],
      appliedDiscount: {
        description: 'Remise calculateur',
        value: 15,
        valueType: 'PERCENTAGE',
      },
    });

    if (!draftOrder) {
      return NextResponse.json(
        { error: "Impossible de créer l'estimation. Merci de réessayer." },
        { status: 500 }
      );
    }

    // 3. E-mail invoice
    const emailSent = await sendDraftOrderInvoice(draftOrder.id, email);

    if (!emailSent) {
      return NextResponse.json(
        { error: "Estimation créée mais l'envoi de l'e-mail a échoué. Merci de réessayer." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur estimation:', error);
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
  }
}
