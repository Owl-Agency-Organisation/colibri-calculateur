import { NextRequest, NextResponse } from 'next/server';
import { findCustomerByEmail, createCustomer } from '@/lib/shopify-customers';

/**
 * POST /api/shopify/customer
 * Crée ou récupère un customer Shopify
 * 
 * Body:
 * - email: string (required)
 * - firstName: string (required)
 * - lastName: string (required)
 * - phone: string (optional)
 * - address: string (optional)
 * - city: string (optional)
 * - postalCode: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, lastName, phone, address, city, postalCode } = body;

    // Validation des champs requis
    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, firstName, lastName' },
        { status: 400 }
      );
    }

    // 1. Chercher si le client existe déjà
    let customer = await findCustomerByEmail(email);
    let isNew = false;

    // 2. Si le client n'existe pas, le créer
    if (!customer) {
      const addresses = [];
      if (address && city && postalCode) {
        addresses.push({
          address1: address,
          city,
          zip: postalCode,
          country: 'FR',
        });
      }

      customer = await createCustomer({
        email,
        firstName,
        lastName,
        phone: phone || undefined,
        addresses: addresses.length > 0 ? addresses : undefined,
        tags: ['covea'],
      });

      if (!customer) {
        return NextResponse.json(
          { error: 'Failed to create customer' },
          { status: 500 }
        );
      }

      isNew = true;
    }

    // 3. Retourner le customer ID
    return NextResponse.json({
      success: true,
      customerId: customer.id,
      isNew,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    });
  } catch (error) {
    console.error('Error in customer API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
