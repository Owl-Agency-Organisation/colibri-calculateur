import { NextResponse } from 'next/server';
import { shopifyFetch } from '@/lib/shopify';

const PRODUCT_QUERY = `
  query GetProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      description
      availableForSale
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 5) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 10) {
        edges {
          node {
            id
            title
            sku
            price {
              amount
              currencyCode
            }
            availableForSale
          }
        }
      }
      metafields(identifiers: [
        { namespace: "custom", key: "base" },
        { namespace: "custom", key: "code_hexadecimal" },
        { namespace: "custom", key: "sous_couche" }
      ]) {
        namespace
        key
        value
        type
      }
    }
  }
`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  try {
    const { data } = await shopifyFetch<any>({
      query: PRODUCT_QUERY,
      variables: { handle },
    });

    if (!data.product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const product = data.product;

    // Extraire les metafields
    const metafields: Record<string, string> = {};
    if (product.metafields) {
      product.metafields.forEach((mf: any) => {
        if (mf) {
          metafields[mf.key] = mf.value;
        }
      });
    }

    // Déterminer la base (Blanc, BLC, B, C)
    const base = metafields.base || 'Blanc';
    
    // Déterminer la sous-couche recommandée
    let sousCouche = 'blanche';
    if (metafields.sous_couche) {
      sousCouche = metafields.sous_couche.toLowerCase();
    } else {
      // Logique par défaut basée sur la base
      if (base === 'C' || base === 'BLC') {
        sousCouche = 'grise';
      }
    }

    return NextResponse.json({
      ...product,
      base,
      sousCouche,
      codeHex: metafields.code_hexadecimal || '#FFFFFF',
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}
