import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/calculateur/permalink
 *
 * Construit le cart permalink boutique ("Continuer mes achats") à partir des
 * lignes du panier Shopify :
 *   https://www.colibripeinture.com/cart/{id}:{qté},...?discount={CODE}&storefront=true
 *
 * Route serveur obligatoire : le code promo (`process.env.DISCOUNT_CODE`) est lu
 * ici et n'est jamais présent dans le bundle client. Il apparaît uniquement dans
 * l'URL boutique construite, conformément au format acté dans PLAN.md.
 *
 * ⚠️ Comportement Shopify : ouvrir un cart permalink REMPLACE le panier boutique
 * existant du visiteur (décision acceptée) et la remise s'applique à tout le
 * panier boutique, y compris aux produits ajoutés ensuite.
 */

const BOUTIQUE_URL = 'https://www.colibripeinture.com';

// Le permalink exige l'identifiant NUMÉRIQUE de la variante. La Storefront API
// renvoie un GID `gid://shopify/ProductVariant/123456`, parfois suffixé d'un
// paramètre de contexte (ex. `?country=FR` via la directive @inContext) : on
// tolère ce suffixe mais on n'extrait que la partie numérique.
const VARIANT_GID_REGEX = /^gid:\/\/shopify\/ProductVariant\/(\d+)(?:\?.*)?$/;

interface PermalinkLine {
  merchandiseId: string;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const lines: PermalinkLine[] = Array.isArray(body?.lines) ? body.lines : [];

    if (lines.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    // Fail-closed : si UNE ligne est inexploitable, on refuse tout le permalink.
    // Un panier partiel enverrait l'utilisateur acheter moins que ce qui a été
    // calculé, sans qu'il s'en aperçoive.
    const parts: string[] = [];
    for (const line of lines) {
      const match = VARIANT_GID_REGEX.exec(line.merchandiseId ?? '');
      const quantiteValide = Number.isInteger(line.quantity) && line.quantity > 0;

      if (!match || !quantiteValide) {
        console.error(
          `Permalink refusé : ligne invalide (merchandiseId="${line.merchandiseId}", quantity=${line.quantity})`
        );
        return NextResponse.json(
          { error: 'Une ligne du panier est invalide, permalink impossible' },
          { status: 422 }
        );
      }

      parts.push(`${match[1]}:${line.quantity}`);
    }

    const params = new URLSearchParams();
    const discountCode = process.env.DISCOUNT_CODE;
    if (discountCode) {
      params.set('discount', discountCode);
    } else {
      // Même garde-fou qu'à la création du panier : sans code configuré, le
      // permalink partirait au prix catalogue plein. Visible dans les logs
      // serveur, le code lui-même n'est jamais loggé.
      console.error(
        'ALERTE remise calculateur : DISCOUNT_CODE absent, permalink construit sans remise.'
      );
    }
    params.set('storefront', 'true');

    return NextResponse.json({
      url: `${BOUTIQUE_URL}/cart/${parts.join(',')}?${params.toString()}`,
    });
  } catch (error) {
    console.error('Erreur construction permalink:', error);
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
  }
}
