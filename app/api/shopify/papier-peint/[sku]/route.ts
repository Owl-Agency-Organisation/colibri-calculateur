import { NextResponse } from 'next/server';
import { normaliserTeintes } from '@/lib/embed-messages';
import { resoudrePapiersPeints } from '@/lib/shopify-papiers-peints';

/**
 * Papier peint par SKU de variante (référence Wizart) :
 * `GET /api/shopify/papier-peint/{sku}` →
 * `{ sku, handle, titre, motif, coloris, imageUrl, variantId, lien }`.
 * 404 si le SKU est invalide ou inconnu de la boutique. Aucun prix.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sku: string }> }
) {
  const [sku] = normaliserTeintes([(await params).sku], 1);
  if (!sku) {
    return NextResponse.json({ error: 'Papier peint introuvable' }, { status: 404 });
  }
  try {
    const papier = (await resoudrePapiersPeints([sku])).get(sku);
    if (!papier) {
      return NextResponse.json({ error: 'Papier peint introuvable' }, { status: 404 });
    }
    return NextResponse.json(papier, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (error) {
    console.error('[api/shopify/papier-peint] Catalogue indisponible', error);
    return NextResponse.json({ error: 'Catalogue indisponible' }, { status: 502 });
  }
}
