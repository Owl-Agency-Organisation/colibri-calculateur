import { shopifyFetch } from '@/lib/shopify';
import {
  lireHandlesDemandes,
  origineAutorisee,
  requeteTeintes,
  versTeinteEmbed,
  type ProduitTeinte,
  type TeinteEmbed,
} from '@/lib/embed-teintes';

/**
 * Couleurs des teintes de la barre du simulateur (script hébergé
 * `/embed/colibri.js`) : `GET /api/embed/teintes?handles=h1,h2`.
 * CORS limité à la boutique et à l'app (labo) ; handles invalides ou inconnus
 * ignorés ; cache court. En cas d'échec, la barre affiche le nom seul.
 */
export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 'public, max-age=300';

function entetes(origine: string | null, cache: string): Headers {
  const headers = new Headers({ 'Cache-Control': cache, Vary: 'Origin' });
  if (origine) {
    headers.set('Access-Control-Allow-Origin', origine);
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }
  return headers;
}

export function OPTIONS(request: Request) {
  const origine = request.headers.get('origin');
  if (!origineAutorisee(origine, new URL(request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: entetes(origine, 'public, max-age=86400') });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origine = request.headers.get('origin');
  if (!origineAutorisee(origine, url.origin)) {
    return Response.json({ erreur: 'Origine non autorisée' }, { status: 403, headers: { Vary: 'Origin' } });
  }

  const handles = lireHandlesDemandes(url.searchParams.get('handles'));
  if (handles.length === 0) {
    return Response.json([], { headers: entetes(origine, CACHE_CONTROL) });
  }

  try {
    const variables = Object.fromEntries(handles.map((handle, i) => [`h${i}`, handle]));
    const { data } = await shopifyFetch<Record<string, ProduitTeinte | null>>({
      query: requeteTeintes(handles.length),
      variables,
    });
    const teintes: TeinteEmbed[] = handles
      .map((_, i) => data?.[`t${i}`])
      .filter((produit): produit is ProduitTeinte => !!produit)
      .map(versTeinteEmbed);
    return Response.json(teintes, { headers: entetes(origine, CACHE_CONTROL) });
  } catch (erreur) {
    console.error('[api/embed/teintes] Catalogue indisponible', erreur);
    return Response.json([], { status: 502, headers: entetes(origine, 'no-store') });
  }
}
