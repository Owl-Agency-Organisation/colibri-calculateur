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
            variants(first: 20) {
              edges {
                node {
                  selectedOptions {
                    name
                    value
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
      
      // Extraire toutes les finitions disponibles pour ce produit
      const finitionsDisponibles = new Set<string>();
      
      node.variants?.edges?.forEach((vEdge: any) => {
        const variant = vEdge.node;
        const finitionOption = variant.selectedOptions?.find(
          (opt: any) => opt.name.toLowerCase() === 'finition'
        );
        if (finitionOption) {
          finitionsDisponibles.add(finitionOption.value);
        }
      });
      
      // Fallback sur le titre si aucune option n'est trouvée
      if (finitionsDisponibles.size === 0) {
        if (node.title.toLowerCase().includes('mat')) finitionsDisponibles.add('Mat');
        if (node.title.toLowerCase().includes('velours')) finitionsDisponibles.add('Velours');
        if (node.title.toLowerCase().includes('satin')) finitionsDisponibles.add('Satin');
      }

      return {
        ...node,
        finitions: Array.from(finitionsDisponibles)
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
