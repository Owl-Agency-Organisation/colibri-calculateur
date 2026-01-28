import { NextResponse } from 'next/server';
import { getProduct } from '@/lib/shopify';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get('handle');

  if (!handle) {
    return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
  }

  try {
    const { product } = await getProduct(handle);
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    // Mapper les variants au format attendu par l'algorithme de calcul
    const variants = product.variants.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      sku: edge.node.sku,
      price: {
        amount: edge.node.price.amount,
        currencyCode: edge.node.price.currencyCode,
      },
      availableForSale: edge.node.availableForSale,
      selectedOptions: edge.node.selectedOptions,
    }));
    
    return NextResponse.json({ 
      id: product.id,
      handle: product.handle,
      title: product.title,
      variants,
      featuredImage: product.featuredImage ? {
        url: product.featuredImage.url,
        altText: product.featuredImage.altText,
      } : undefined,
      metafields: {
        base: product.metafield_base?.value,
        hex: product.metafield_hex?.value,
      }
    });
  } catch (error) {
    console.error('Shopify API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Shopify data' },
      { status: 500 }
    );
  }
}
