import { NextRequest, NextResponse } from 'next/server';
import { createCart, type CartLineInput, type BuyerInfo } from '@/lib/shopify-cart';

interface CreateCartRequestBody {
  lines: CartLineInput[];
  buyerInfo?: BuyerInfo;
}

/**
 * POST /api/calculateur/cart
 *
 * Crée le panier Shopify côté serveur afin d'injecter le code promo -15%
 * (`process.env.DISCOUNT_CODE`) sans jamais l'exposer au client. La remise est
 * réellement appliquée par Shopify (`discountCodes` dans `cartCreate`) et se
 * répercute automatiquement sur le checkout du même panier.
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateCartRequestBody = await request.json();
    const { lines, buyerInfo } = body;

    if (!lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Aucune ligne de panier fournie' },
        { status: 400 }
      );
    }

    const cart = await createCart(lines, buyerInfo);

    return NextResponse.json({ cart });
  } catch (error) {
    console.error('Erreur création panier:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur création panier' },
      { status: 500 }
    );
  }
}
