/**
 * Lecture du catalogue Storefront côté serveur : collections et produits
 * d'une collection, toujours paginés jusqu'au bout (aucune troncature).
 * Partagé par `/api/shopify/collections`, `/api/shopify/collections/[handle]`
 * et `/api/shopify/teintes` (index de la recherche de teintes).
 */
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

export interface CollectionStorefront {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: { url: string; altText: string | null } | null;
}

interface OptionVariante {
  name: string;
  value: string;
}

export interface ProduitStorefront {
  id: string;
  title: string;
  handle: string;
  description: string;
  availableForSale: boolean;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  images: { edges: { node: { url: string; altText: string | null } }[] };
  variants: { edges: { node: { selectedOptions: OptionVariante[] } }[] };
}

/** Produit enrichi des finitions disponibles (forme renvoyée au client) */
export interface ProduitCatalogue extends ProduitStorefront {
  finitions: string[];
}

interface CollectionsReponse {
  collections: PageStorefront<CollectionStorefront> | null;
}

interface CollectionProduitsReponse {
  collection: {
    id: string;
    title: string;
    products: PageStorefront<ProduitStorefront>;
  } | null;
}

/** Finitions disponibles d'un produit : option de variante « Finition », sinon titre. */
export function finitionsDuProduit(produit: ProduitStorefront): string[] {
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

/** Toutes les collections de la boutique (la boutique en compte plus de 50). */
export async function chargerCollections(): Promise<CollectionStorefront[]> {
  return chargerToutesLesPages(async (after) => {
    const { data } = await shopifyFetch<CollectionsReponse>({
      query: COLLECTIONS_QUERY,
      variables: { first: TAILLE_PAGE_STOREFRONT, after },
    });
    return data.collections;
  });
}

/**
 * Tous les produits d'une collection, avec leurs finitions.
 * `null` si la collection n'existe pas.
 */
export async function chargerProduitsCollection(
  handle: string,
): Promise<{ titre: string; produits: ProduitCatalogue[] } | null> {
  // Titre relevé pendant la pagination (objet : affecté dans le callback)
  const collection: { titre: string | null } = { titre: null };

  const produits = await chargerToutesLesPages(async (after) => {
    const { data } = await shopifyFetch<CollectionProduitsReponse>({
      query: COLLECTION_PRODUCTS_QUERY,
      variables: { handle, first: TAILLE_PAGE_STOREFRONT, after },
    });
    if (!data.collection) return null;
    collection.titre = data.collection.title;
    return data.collection.products;
  });

  if (collection.titre === null) return null;
  return {
    titre: collection.titre,
    produits: produits.map((produit) => ({ ...produit, finitions: finitionsDuProduit(produit) })),
  };
}
