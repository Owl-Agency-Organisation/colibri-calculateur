import { NextResponse } from 'next/server';
import { selectionnerCollectionsTeintes } from '@/lib/collectionsTeintes';
import { construireIndexTeintes } from '@/lib/rechercheTeintes';
import { chargerCollections, chargerProduitsCollection } from '@/lib/shopify-catalogue';

/**
 * Index de la recherche de teintes : toutes les teintes des collections
 * affichées dans la popup couleur (mêmes familles, même ordre). Chargé une
 * fois par le client, filtré localement à chaque frappe.
 */
export async function GET() {
  try {
    const collections = selectionnerCollectionsTeintes(await chargerCollections());
    const contenus = await Promise.all(
      collections.map((collection) => chargerProduitsCollection(collection.handle))
    );
    const teintes = construireIndexTeintes(
      contenus.filter((contenu): contenu is NonNullable<typeof contenu> => contenu !== null)
    );
    return NextResponse.json({ teintes });
  } catch (error) {
    console.error('Error building shade index:', error);
    return NextResponse.json(
      { error: 'Failed to build shade index' },
      { status: 500 }
    );
  }
}
