import { NextResponse } from 'next/server';
import { chargerProduitsCollection } from '@/lib/shopify-catalogue';

/** Tous les produits d'une collection, avec leurs finitions disponibles. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  try {
    const resultat = await chargerProduitsCollection(handle);

    if (!resultat) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      collection: resultat.titre,
      products: resultat.produits,
    });
  } catch (error) {
    console.error('Error fetching collection products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection products' },
      { status: 500 }
    );
  }
}
