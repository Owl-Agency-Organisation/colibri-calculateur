import { NextResponse } from 'next/server';
import { shopifyFetch } from '@/lib/shopify';
import {
  chargerToutesLesPages,
  TAILLE_PAGE_STOREFRONT,
  type PageStorefront,
} from '@/lib/shopify-pagination';

const COLLECTION_PRODUCTS_QUERY = `
  query GetCollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      id
      title
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          handle
          description
          availableForSale
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 1) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 20) {
            edges {
              node {
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface OptionVariante {
  name: string;
  value: string;
}

interface ProduitStorefront {
  id: string;
  title: string;
  handle: string;
  description: string;
  availableForSale: boolean;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  images: { edges: { node: { url: string; altText: string | null } }[] };
  variants: { edges: { node: { selectedOptions: OptionVariante[] } }[] };
}

interface CollectionProduitsReponse {
  collection: {
    id: string;
    title: string;
    products: PageStorefront<ProduitStorefront>;
  } | null;
}

/** Finitions disponibles d'un produit : option de variante « Finition », sinon titre. */
function finitionsDuProduit(produit: ProduitStorefront): string[] {
  const finitions = new Set<string>();

  produit.variants.edges.forEach(({ node: variante }) => {
    const option = variante.selectedOptions.find(
      (opt) => opt.name.toLowerCase() === 'finition'
    );
    if (option) finitions.add(option.value);
  });

  // Fallback sur le titre si aucune option n'est trouvée
  if (finitions.size === 0) {
    const titre = produit.title.toLowerCase();
    if (titre.includes('mat')) finitions.add('Mat');
    if (titre.includes('velours')) finitions.add('Velours');
    if (titre.includes('satin')) finitions.add('Satin');
  }

  return Array.from(finitions);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  try {
    let titreCollection: string | null = null;
    let collectionTrouvee = false;

    // Tous les produits de la collection, sans troncature (« Les Blancs
    // teintés » dépasse les 50 teintes de l'ancienne limite)
    const produits = await chargerToutesLesPages(async (after) => {
      const { data } = await shopifyFetch<CollectionProduitsReponse>({
        query: COLLECTION_PRODUCTS_QUERY,
        variables: { handle, first: TAILLE_PAGE_STOREFRONT, after },
      });
      if (!data.collection) return null;
      collectionTrouvee = true;
      titreCollection = data.collection.title;
      return data.collection.products;
    });

    if (!collectionTrouvee) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Même forme de réponse qu'avant (`images.edges`, `variants.edges`)
    const products = produits.map((produit) => ({
      ...produit,
      finitions: finitionsDuProduit(produit),
    }));

    return NextResponse.json({
      collection: titreCollection,
      products,
    });
  } catch (error) {
    console.error('Error fetching collection products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection products' },
      { status: 500 }
    );
  }
}
