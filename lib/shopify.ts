import { createStorefrontApiClient } from '@shopify/storefront-api-client';

// Vérification des variables d'environnement
if (!process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) {
  throw new Error('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN is required');
}

if (!process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN) {
  throw new Error('NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN is required');
}

// Client Shopify Storefront API
export const shopifyClient = createStorefrontApiClient({
  storeDomain: process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN,
  apiVersion: '2025-01',
  publicAccessToken: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
});

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
            productsCount
          }
        }
      }
    }
  `;

  const { data } = await shopifyClient.request(query);
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

  const { data } = await shopifyClient.request(query, {
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

  const { data } = await shopifyClient.request(query, {
    variables: { handle },
  });
  return data;
}