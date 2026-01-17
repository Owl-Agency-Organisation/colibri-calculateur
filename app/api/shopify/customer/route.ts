import { NextRequest, NextResponse } from 'next/server';

interface CreateCustomerRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateCustomerRequest = await request.json();

    // Validation des champs requis
    if (!body.firstName || !body.lastName || !body.email || !body.phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const storeDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
    const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';

    if (!storeDomain || !adminToken) {
      console.error('Missing Shopify Admin API credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Construire l'adresse complète
    const address1 = body.address || '';
    const city = body.city || '';
    const zip = body.postalCode || '';

    // GraphQL mutation pour créer un client
    const mutation = `
      mutation CreateCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
            firstName
            lastName
            phone
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
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        addresses: address1 || city || zip ? [
          {
            address1,
            city,
            zip,
          }
        ] : undefined,
      }
    };

    const response = await fetch(
      `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
      }
    );

    const data = await response.json();

    // Vérifier les erreurs GraphQL
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return NextResponse.json(
        { error: 'Failed to create customer', details: data.errors },
        { status: 400 }
      );
    }

    // Vérifier les erreurs utilisateur (ex: email déjà existant)
    if (data.data?.customerCreate?.userErrors?.length > 0) {
      const userErrors = data.data.customerCreate.userErrors;
      
      // Si l'email existe déjà, ce n'est pas une erreur critique
      const emailExists = userErrors.some(
        (err: any) => err.field?.includes('email') && err.message?.includes('already exists')
      );

      if (emailExists) {
        console.log('Customer already exists with this email:', body.email);
        return NextResponse.json(
          { 
            success: true, 
            message: 'Customer already exists',
            customerId: null 
          },
          { status: 200 }
        );
      }

      console.error('User errors:', userErrors);
      return NextResponse.json(
        { error: 'Failed to create customer', details: userErrors },
        { status: 400 }
      );
    }

    const customer = data.data?.customerCreate?.customer;

    if (!customer) {
      return NextResponse.json(
        { error: 'Failed to create customer' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        customerId: customer.id,
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
