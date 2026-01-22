import { NextResponse } from 'next/server';
import { shopifyFetch } from '@/lib/shopify';

const COLLECTION_PRODUCTS_QUERY = `
  query GetCollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      id
      title
      products(first: $first) {
        edges {
          node {
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
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            metafields(identifiers: [
              { namespace: "custom", key: "finition" }
            ]) {
              key
              value
            }
          }
        }
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
      query: COLLECTION_PRODUCTS_QUERY,
      variables: { 
        handle,
        first: 50,
      },
    });

    if (!data.collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    const products = data.collection.products.edges.map((edge: any) => {
      const node = edge.node;
      const finitionMeta = node.metafields?.find((mf: any) => mf?.key === 'finition');
      return {
        ...node,
        finition: finitionMeta ? finitionMeta.value : null
      };
    });

    return NextResponse.json({ 
      collection: data.collection.title,
      products 
    });
  } catch (error) {
    console.error('Error fetching collection products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection products' },
      { status: 500 }
    );
  }
}
