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
export async function shopifyFetch<T>({
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
      // Cache pour améliorer les performances (prix boutique = source de vérité,
      // fraîcheur relevée à 15 min pour refléter plus vite les changements de prix)
      next: { revalidate: 900 }, // 15 minutes
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
 * Composant d'un bundle Shopify natif ("Produits en lot"), au format renvoyé
 * par la route variants pour l'affichage informatif du contenu d'un kit.
 */
export interface BundleComponent {
  id: string;
  titre: string;
  quantite: number;
  imageUrl?: string;
  imageAlt?: string;
}

/**
 * Récupère les composants du bundle d'un produit (kits matériel).
 * `ProductVariant.components` — Storefront API ≥ 2024-07 (fixed bundles) ;
 * les kits n'ont qu'un variant, on ne lit que le premier.
 * Retourne [] si le produit n'est pas un bundle ou n'a pas de composants
 * (l'appelant doit alors se rabattre sur la description produit).
 */
export async function getProductBundleComponents(handle: string): Promise<BundleComponent[]> {
  const query = `
    query GetBundleComponents($handle: String!) {
      product(handle: $handle) {
        id
        variants(first: 1) {
          edges {
            node {
              requiresComponents
              components(first: 20) {
                nodes {
                  quantity
                  productVariant {
                    id
                    title
                    product {
                      title
                      handle
                      featuredImage {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const { data } = await shopifyFetch<any>({
      query,
      variables: { handle },
    });

    const nodes = data?.product?.variants?.edges?.[0]?.node?.components?.nodes;
    if (!Array.isArray(nodes)) return [];

    return nodes
      .filter((node: any) => node?.productVariant?.product?.title)
      .map((node: any) => {
        const variant = node.productVariant;
        // Libellé : titre produit, précisé du titre de variante quand le
        // composant est une déclinaison (ex. ruban 38mm vs 50mm)
        const variantTitle =
          variant.title && variant.title !== 'Default Title' ? ` — ${variant.title}` : '';
        return {
          id: variant.id,
          titre: `${variant.product.title}${variantTitle}`,
          quantite: typeof node.quantity === 'number' && node.quantity > 0 ? node.quantity : 1,
          imageUrl: variant.product.featuredImage?.url,
          imageAlt: variant.product.featuredImage?.altText || undefined,
        };
      });
  } catch (error) {
    // Fail-soft : l'affichage du kit retombe sur la description produit
    console.error(`Erreur chargement composants bundle "${handle}":`, error);
    return [];
  }
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