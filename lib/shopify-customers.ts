/**
 * Shopify Customers API
 * Gestion de la création de clients via Admin API
 */

import { callAdminAPI } from './shopify-admin';

interface CustomerInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  addresses?: {
    address1?: string;
    city?: string;
    zip?: string;
    country?: string;
  }[];
  tags?: string[];
}

interface ShopifyCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tags: string[];
}

/**
 * Crée un client dans Shopify
 * @param customerData - Données du client
 * @returns Customer créé ou null si erreur
 */
export async function createCustomer(customerData: CustomerInput): Promise<ShopifyCustomer | null> {
  const mutation = `
    mutation customerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
          firstName
          lastName
          phone
          tags
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
      email: customerData.email,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phone,
      addresses: customerData.addresses,
      tags: customerData.tags || ['calculateur'], // Tag par défaut
    },
  };

  try {
    const data = await callAdminAPI(mutation, variables);

    // Vérifier les erreurs
    if (data.customerCreate.userErrors.length > 0) {
      console.error('Customer creation errors:', data.customerCreate.userErrors);
      return null;
    }

    return data.customerCreate.customer;
  } catch (error) {
    console.error('Error creating customer:', error);
    return null;
  }
}

/**
 * Recherche un client par email
 * @param email - Email du client
 * @returns Customer trouvé ou null
 */
export async function findCustomerByEmail(email: string): Promise<ShopifyCustomer | null> {
  const query = `
    query customerSearch($query: String!) {
      customers(first: 1, query: $query) {
        edges {
          node {
            id
            email
            firstName
            lastName
            phone
            tags
          }
        }
      }
    }
  `;

  const variables = {
    query: `email:${email}`,
  };

  try {
    const data = await callAdminAPI(query, variables);
    
    const customers = data.customers.edges;
    if (customers.length > 0) {
      return customers[0].node;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding customer:', error);
    return null;
  }
}
