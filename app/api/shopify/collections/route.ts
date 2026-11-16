import { NextResponse } from 'next/server';
import { chargerCollections } from '@/lib/shopify-catalogue';

/**
 * Toutes les collections de la boutique, sans troncature. Le tri et le
 * filtre des collections de teintes sont faits côté client par
 * `selectionnerCollectionsTeintes`.
 */
export async function GET() {
  try {
    const collections = await chargerCollections();
    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}
