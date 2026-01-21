import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get('handle');

  if (!handle) {
    return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
  }

  try {
    // Appel au MCP Shopify via la CLI Manus
    const command = `manus-mcp-cli tool call shopify_get_product --server shopify-mcp-server-colibri --input '{"handle": "${handle}"}'`;
    const output = execSync(command, { encoding: 'utf-8' });
    
    // Le MCP retourne souvent du texte avant le JSON, on essaie de parser le JSON
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid MCP output');
    }
    
    const productData = JSON.parse(jsonMatch[0]);
    
    // On retourne les variants avec les infos essentielles (ID, prix, stock, contenance)
    return NextResponse.json({ 
      variants: productData.variants || [],
      metafields: productData.metafields || []
    });
  } catch (error) {
    console.error('Shopify API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch Shopify data' }, { status: 500 });
  }
}
