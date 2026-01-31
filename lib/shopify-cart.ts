/**
 * Shopify Cart API Helpers
 * Gestion du panier via l'API Storefront Cart de Shopify
 */

import { shopifyFetch } from './shopify';

/**
 * Types pour l'API Cart
 */
export interface CartLineInput {
  merchandiseId: string; // ID Shopify du variant (ex: "gid://shopify/ProductVariant/123")
  quantity: number;
  attributes?: Array<{ key: string; value: string }>;
}

export interface CartLineNode {
  id: string;
  quantity: number;
  attributes: Array<{ key: string; value: string }>;
  merchandise: {
    id: string;
    title: string;
    product: {
      title: string;
      handle: string;
      featuredImage?: {
        url: string;
        altText?: string;
      };
    };
    price: {
      amount: string;
      currencyCode: string;
    };
    image?: {
      url: string;
      altText?: string;
    };
  };
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  lines: {
    edges: Array<{
      node: CartLineNode;
    }>;
  };
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
    totalTaxAmount?: {
      amount: string;
      currencyCode: string;
    };
  };
  buyerIdentity?: {
    email?: string;
    countryCode?: string;
  };
}

// Fragment GraphQL réutilisable pour les données du panier
const CART_FRAGMENT = `
  fragment CartFragment on Cart {
    id
    checkoutUrl
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          attributes {
            key
            value
          }
          merchandise {
            ... on ProductVariant {
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
              price {
                amount
                currencyCode
              }
              image {
                url
                altText
              }
            }
          }
        }
      }
    }
    cost {
      totalAmount {
        amount
        currencyCode
      }
      subtotalAmount {
        amount
        currencyCode
      }
      totalTaxAmount {
        amount
        currencyCode
      }
    }
    buyerIdentity {
      email
      countryCode
    }
  }
`;

/**
 * Informations de l'acheteur pour pré-remplir le checkout
 */
export interface BuyerInfo {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  address1?: string;
  city?: string;
  zip?: string;
  country?: string;
}

/**
 * Créer un nouveau panier Shopify
 */
export async function createCart(
  lines: CartLineInput[],
  buyerInfo?: BuyerInfo
): Promise<ShopifyCart> {
  const mutation = `
    ${CART_FRAGMENT}
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables: any = {
    input: {
      lines,
    },
  };

  // Construire buyerIdentity avec les informations de base
  if (buyerInfo) {
    variables.input.buyerIdentity = {
      email: buyerInfo.email,
      countryCode: buyerInfo.country || 'FR',
    };

    // Ajouter le téléphone si fourni
    if (buyerInfo.phone) {
      variables.input.buyerIdentity.phone = buyerInfo.phone;
    }
  }

  const response = await shopifyFetch<{
    cartCreate: {
      cart: ShopifyCart;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>({
    query: mutation,
    variables,
  });

  if (response.data?.cartCreate?.userErrors?.length > 0) {
    const error = response.data.cartCreate.userErrors[0];
    console.error('Erreur création panier:', error);
    throw new Error(`Erreur création panier: ${error.message}`);
  }

  if (!response.data?.cartCreate?.cart) {
    throw new Error('Erreur création panier: réponse invalide');
  }

  return response.data.cartCreate.cart;
}

/**
 * Récupérer un panier existant par son ID
 */
export async function getCart(cartId: string): Promise<ShopifyCart> {
  const query = `
    ${CART_FRAGMENT}
    query getCart($cartId: ID!) {
      cart(id: $cartId) {
        ...CartFragment
      }
    }
  `;

  const response = await shopifyFetch<{ cart: ShopifyCart | null }>({
    query,
    variables: { cartId },
  });

  if (!response.data?.cart) {
    throw new Error('Panier non trouvé ou expiré');
  }

  return response.data.cart;
}

/**
 * Ajouter des lignes à un panier existant
 */
export async function addCartLines(
  cartId: string,
  lines: CartLineInput[]
): Promise<ShopifyCart> {
  const mutation = `
    ${CART_FRAGMENT}
    mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await shopifyFetch<{
    cartLinesAdd: {
      cart: ShopifyCart;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>({
    query: mutation,
    variables: { cartId, lines },
  });

  if (response.data?.cartLinesAdd?.userErrors?.length > 0) {
    const error = response.data.cartLinesAdd.userErrors[0];
    throw new Error(`Erreur ajout produit: ${error.message}`);
  }

  return response.data.cartLinesAdd.cart;
}

/**
 * Supprimer des lignes d'un panier
 */
export async function removeCartLines(
  cartId: string,
  lineIds: string[]
): Promise<ShopifyCart> {
  const mutation = `
    ${CART_FRAGMENT}
    mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await shopifyFetch<{
    cartLinesRemove: {
      cart: ShopifyCart;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>({
    query: mutation,
    variables: { cartId, lineIds },
  });

  if (response.data?.cartLinesRemove?.userErrors?.length > 0) {
    const error = response.data.cartLinesRemove.userErrors[0];
    throw new Error(`Erreur suppression: ${error.message}`);
  }

  return response.data.cartLinesRemove.cart;
}

/**
 * Mettre à jour les quantités des lignes d'un panier
 */
export async function updateCartLines(
  cartId: string,
  lines: Array<{ id: string; quantity: number }>
): Promise<ShopifyCart> {
  const mutation = `
    ${CART_FRAGMENT}
    mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await shopifyFetch<{
    cartLinesUpdate: {
      cart: ShopifyCart;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>({
    query: mutation,
    variables: { cartId, lines },
  });

  if (response.data?.cartLinesUpdate?.userErrors?.length > 0) {
    const error = response.data.cartLinesUpdate.userErrors[0];
    throw new Error(`Erreur mise à jour: ${error.message}`);
  }

  return response.data.cartLinesUpdate.cart;
}

/**
 * Mettre à jour l'identité de l'acheteur (email)
 */
export async function updateCartBuyerIdentity(
  cartId: string,
  email: string
): Promise<ShopifyCart> {
  const mutation = `
    ${CART_FRAGMENT}
    mutation cartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        cart {
          ...CartFragment
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await shopifyFetch<{
    cartBuyerIdentityUpdate: {
      cart: ShopifyCart;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>({
    query: mutation,
    variables: {
      cartId,
      buyerIdentity: {
        email,
        countryCode: 'FR',
      },
    },
  });

  if (response.data?.cartBuyerIdentityUpdate?.userErrors?.length > 0) {
    const error = response.data.cartBuyerIdentityUpdate.userErrors[0];
    throw new Error(`Erreur mise à jour identité: ${error.message}`);
  }

  return response.data.cartBuyerIdentityUpdate.cart;
}
