import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder, sendDraftOrderInvoice } from '@/lib/shopify-draft-orders';

interface UserData {
  email: string;
  prenom: string;
  nom: string;
  telephone: string;
  adresse: string;
  ville: string;
  codePostal: string;
}

interface CheckoutRequestBody {
  mode: 'direct' | 'save';
  customerId: string;
  lineItems: Array<{ variantId: string; quantity: number }>;
  userData: UserData;
  cartCheckoutUrl?: string;
}

/**
 * POST /api/calculateur/checkout
 * 
 * Gère la finalisation du panier en 2 modes :
 * - Mode 'direct' : Redirection vers checkout Shopify classique
 * - Mode 'save' : Création Draft Order + envoi email invoice
 */
export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequestBody = await request.json();
    const { mode, customerId, lineItems, userData, cartCheckoutUrl } = body;

    // Validation
    if (!mode || !customerId || !lineItems || !userData) {
      return NextResponse.json(
        { error: 'Champs requis manquants' },
        { status: 400 }
      );
    }

    // MODE A : Checkout direct
    if (mode === 'direct') {
      if (!cartCheckoutUrl) {
        return NextResponse.json(
          { error: 'URL de checkout manquante pour le mode direct' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: 'direct',
        checkoutUrl: cartCheckoutUrl,
      });
    }

    // MODE B : Sauvegarder projet (Draft Order)
    if (mode === 'save') {
      // Créer le Draft Order (les prix sont déjà réduits dans les line items)
      const draftOrder = await createDraftOrder({
        customerId,
        lineItems,
        shippingAddress: {
          firstName: userData.prenom,
          lastName: userData.nom,
          address1: userData.adresse,
          city: userData.ville,
          zip: userData.codePostal,
          country: 'FR',
          phone: userData.telephone,
        },
        email: userData.email,
        phone: userData.telephone,
        note: 'Projet sauvegardé par le client - À finaliser ultérieurement',
        tags: ['projet-sauvegarde', 'calculateur'],
      });

      if (!draftOrder) {
        return NextResponse.json(
          { error: 'Échec de la création du draft order' },
          { status: 500 }
        );
      }

      // Envoyer l'email invoice
      const emailSent = await sendDraftOrderInvoice(draftOrder.id, userData.email);

      if (!emailSent) {
        return NextResponse.json(
          {
            error: 'Draft order créé mais l\'envoi de l\'email a échoué',
            draftOrderId: draftOrder.id,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: 'save',
        message: 'Votre projet a été sauvegardé ! Un email vous a été envoyé avec un lien pour finaliser votre commande.',
        draftOrder: {
          id: draftOrder.id,
          name: draftOrder.name,
          invoiceUrl: draftOrder.invoiceUrl,
          totalPrice: draftOrder.totalPrice,
        },
      });
    }

    // Mode invalide
    return NextResponse.json(
      { error: 'Mode invalide. Utilisez "direct" ou "save"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erreur checkout:', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne' },
      { status: 500 }
    );
  }
}
