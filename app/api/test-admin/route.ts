import { NextResponse } from 'next/server';
import { callAdminAPI } from '@/lib/shopify-admin';

/**
 * Route de test pour vérifier l'accès à l'Admin API
 * GET /api/test-admin
 */
export async function GET() {
  try {
    // Query simple pour tester l'accès
    const query = `
      {
        shop {
          name
          email
          currencyCode
          plan {
            displayName
          }
        }
      }
    `;
    
    const data = await callAdminAPI(query);
    
    return NextResponse.json({
      success: true,
      message: 'Admin API access OK!',
      shop: data.shop,
    });
  } catch (error) {
    console.error('Admin API test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
