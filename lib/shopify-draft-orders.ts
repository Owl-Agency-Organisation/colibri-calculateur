/**
 * Shopify Draft Orders API
 * Création de Draft Orders et envoi d'invoices
 */

import { callAdminAPI } from './shopify-admin';

interface DraftOrderLineItem {
  variantId: string;
  quantity: number;
}

interface DraftOrderInput {
  customerId: string;
  lineItems: DraftOrderLineItem[];
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    address1?: string;
    city?: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  email?: string;
  phone?: string;
  note?: string;
  tags?: string[];
  appliedDiscount?: {
    description: string;
    value: number;
    valueType: 'FIXED_AMOUNT' | 'PERCENTAGE';
  };
}

interface ShopifyDraftOrder {
  id: string;
  name: string;
  invoiceUrl: string;
  totalPrice: string;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        quantity: number;
        originalUnitPrice: string;
      };
    }>;
  };
}

/**
 * Crée un Draft Order
 * @param input - Données du Draft Order
 * @returns Draft Order créé ou null si erreur
 */
export async function createDraftOrder(input: DraftOrderInput): Promise<ShopifyDraftOrder | null> {
  const mutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          invoiceUrl
          totalPrice
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPrice
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      customerId: input.customerId,
      lineItems: input.lineItems,
      shippingAddress: input.shippingAddress,
      email: input.email,
      phone: input.phone,
      note: input.note,
      tags: input.tags,
      appliedDiscount: input.appliedDiscount,
    },
  };

  try {
    const data = await callAdminAPI(mutation, variables);

    // Vérifier les erreurs
    if (data.draftOrderCreate.userErrors.length > 0) {
      console.error('Draft Order creation errors:', data.draftOrderCreate.userErrors);
      return null;
    }

    return data.draftOrderCreate.draftOrder;
  } catch (error) {
    console.error('Error creating draft order:', error);
    return null;
  }
}

/**
 * Envoie l'email invoice d'un Draft Order
 * @param draftOrderId - ID du Draft Order (format: gid://shopify/DraftOrder/xxx)
 * @param email - Email du destinataire (optionnel, utilise l'email du customer par défaut)
 * @returns true si succès, false si erreur
 */
export async function sendDraftOrderInvoice(
  draftOrderId: string,
  email?: string
): Promise<boolean> {
  const mutation = `
    mutation draftOrderInvoiceSend($id: ID!, $email: EmailInput) {
      draftOrderInvoiceSend(id: $id, email: $email) {
        draftOrder {
          id
          invoiceSentAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables: {
    id: string;
    email?: { to: string };
  } = {
    id: draftOrderId,
  };

  // Ajouter l'email si fourni
  if (email) {
    variables.email = {
      to: email,
    };
  }

  try {
    const data = await callAdminAPI(mutation, variables);

    // Vérifier les erreurs
    if (data.draftOrderInvoiceSend.userErrors.length > 0) {
      console.error(
        'Draft Order invoice send errors:',
        data.draftOrderInvoiceSend.userErrors
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending draft order invoice:', error);
    return false;
  }
}
