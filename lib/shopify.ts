/**
 * Client Shopify Storefront API
 * Utilise fetch natif avec GraphQL
 */

// Vérification des variables d'environnement
if (!process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) {
  throw new Error('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN is required');
}

if (!process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN) {
  throw new Error('NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN is required');
}

const SHOPIFY_STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const SHOPIFY_STOREFRONT_ACCESS_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

const SHOPIFY_GRAPHQL_ENDPOINT = `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

/**
 * Fonction utilitaire pour faire des requêtes GraphQL vers Shopify
 */
async function shopifyFetch<T>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, any>;
}): Promise<{ data: T; errors?: any[] }> {
  try {
    const response = await fetch(SHOPIFY_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      // Cache pour améliorer les performances
      next: { revalidate: 3600 }, // 1 heure
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const json = await response.json();

    if (json.errors) {
      console.error('Shopify GraphQL errors:', json.errors);
      throw new Error('Shopify GraphQL query failed');
    }

    return json;
  } catch (error) {
    console.error('Shopify fetch error:', error);
    throw error;
  }
}

/**
 * Récupère les collections de couleurs (Les Blancs, Les Bleus, etc.)
 */
export async function getColorCollections() {
  const query = `
    query GetCollections {
      collections(first: 20, query: "title:Les *") {
        edges {
          node {
            id
            title
            handle
            image {
              url
              altText
            }
            productsCount {
              count
            }
          }
        }
      }
    }
  `;

  const { data } = await shopifyFetch<any>({ query });
  return data;
}

/**
 * Récupère les produits d'une collection
 */
export async function getCollectionProducts(collectionHandle: string) {
  const query = `
    query GetCollectionProducts($handle: String!) {
      collection(handle: $handle) {
        id
        title
        products(first: 50) {
          edges {
            node {
              id
              handle
              title
              featuredImage {
                url
                altText
              }
              metafield(namespace: "custom", key: "code_hexadecimal") {
                value
              }
            }
          }
        }
      }
    }
  `;

  const { data } = await shopifyFetch<any>({
    query,
    variables: { handle: collectionHandle },
  });
  return data;
}

/**
 * Récupère les détails complets d'un produit avec ses variants
 */
export async function getProduct(handle: string) {
  const query = `
    query GetProduct($handle: String!) {
      product(handle: $handle) {
        id
        title
        handle
        description
        featuredImage {
          url
          altText
        }
        variants(first: 50) {
          edges {
            node {
              id
              sku
              title
              price {
                amount
                currencyCode
              }
              availableForSale
              selectedOptions {
                name
                value
              }
            }
          }
        }
        metafield_base: metafield(namespace: "custom", key: "base") {
          value
        }
        metafield_hex: metafield(namespace: "custom", key: "code_hexadecimal") {
          value
        }
      }
    }
  `;

  const { data } = await shopifyFetch<any>({
    query,
    variables: { handle },
  });
  return data;
}

/**
 * Récupère les produits complémentaires (sous-couches)
 * Via le metafield shopify.discovery.product_recommendation.complementary_products
 */
export async function getComplementaryProducts(productId: string) {
  const query = `
    query GetComplementaryProducts($id: ID!) {
      product(id: $id) {
        id
        title
        metafield(
          namespace: "shopify.discovery.product_recommendation"
          key: "complementary_products"
        ) {
          references(first: 10) {
            edges {
              node {
                ... on Product {
                  id
                  handle
                  title
                  productType
                }
              }
            }
          }
        }
      }
    }
  `;

  const { data } = await shopifyFetch<any>({
    query,
    variables: { id: productId },
  });
  return data;
}

/**
 * Recherche de produits par query
 */
export async function searchProducts(searchQuery: string) {
  const query = `
    query SearchProducts($query: String!) {
      products(first: 20, query: $query) {
        edges {
          node {
            id
            handle
            title
            featuredImage {
              url
              altText
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const { data } = await shopifyFetch<any>({
    query,
    variables: { query: searchQuery },
  });
  return data;
}