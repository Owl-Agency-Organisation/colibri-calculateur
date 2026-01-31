/**
 * Shopify Admin API - Client Credentials Grant
 * Génère un token d'accès frais (valide 24h) à chaque appel
 */

/**
 * Génère un token Admin API frais (valide 24h)
 */
export async function getAdminAccessToken(): Promise<string> {
  const SHOPIFY_STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const CLIENT_ID = process.env.SHOPIFY_ADMIN_CLIENT_ID;
  const CLIENT_SECRET = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;

  // Vérifier les credentials
  if (!SHOPIFY_STORE_DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
    const missing = [];
    if (!SHOPIFY_STORE_DOMAIN) missing.push('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN');
    if (!CLIENT_ID) missing.push('SHOPIFY_ADMIN_CLIENT_ID');
    if (!CLIENT_SECRET) missing.push('SHOPIFY_ADMIN_CLIENT_SECRET');
    console.error('Missing Shopify Admin API credentials:', missing.join(', '));
    throw new Error(`Missing Shopify Admin API credentials: ${missing.join(', ')}`);
  }

  const response = await fetch(
    `https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Admin API token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Appelle l'Admin API GraphQL avec un token frais
 */
export async function callAdminAPI<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const SHOPIFY_STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';

  const token = await getAdminAccessToken();
  
  const response = await fetch(
    `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Admin API call failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  
  // Vérifier les erreurs GraphQL
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }
  
  return result.data;
}
