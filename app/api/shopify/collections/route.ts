import { NextResponse } from 'next/server';
import { shopifyFetch } from '@/lib/shopify';
import {
  chargerToutesLesPages,
  TAILLE_PAGE_STOREFRONT,
  type PageStorefront,
} from '@/lib/shopify-pagination';

const COLLECTIONS_QUERY = `
  query GetCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        description
        image {
          url
          altText
        }
      }
    }
  }
`;

interface CollectionStorefront {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: { url: string; altText: string | null } | null;
}

interface CollectionsReponse {
  collections: PageStorefront<CollectionStorefront> | null;
}

/**
 * Toutes les collections de la boutique, sans troncature (la boutique en
 * compte plus de 50). Le tri et le filtre des collections de teintes sont
 * faits côté client par `selectionnerCollectionsTeintes`.
 */
export async function GET() {
  try {
    const collections = await chargerToutesLesPages(async (after) => {
      const { data } = await shopifyFetch<CollectionsReponse>({
        query: COLLECTIONS_QUERY,
        variables: { first: TAILLE_PAGE_STOREFRONT, after },
      });
      return data.collections;
    });

    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}
