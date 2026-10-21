import { shopifyFetch } from '@/lib/shopify';
import { resoudrePapiersPeints } from '@/lib/shopify-papiers-peints';
import type { PapierPeint } from '@/lib/papierPeint';
import {
  lireHandlesDemandes,
  origineAutorisee,
  requeteTeintes,
  versReferencePapierPeint,
  versReferencePeinture,
  type ProduitTeinte,
  type ReferenceEmbed,
} from '@/lib/embed-teintes';

/**
 * Références de la barre du simulateur (script hébergé `/embed/colibri.js`) :
 * `GET /api/embed/teintes?handles=r1,r2`. Chaque référence est d'abord
 * cherchée comme handle de teinte (Storefront), puis, à défaut, comme SKU de
 * variante papier peint (Admin, côté serveur). CORS limité à la boutique et à
 * l'app (labo) ; références invalides ou inconnues ignorées ; cache court.
 * En cas d'échec, la barre affiche le nom seul. Admin indisponible : les
 * teintes sont renvoyées sans les papiers peints, sans cache.
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
    const teintes = handles.map((_, i) => data?.[`t${i}`] ?? null);
    const autres = handles.filter((_, i) => !teintes[i]);

    let papiers = new Map<string, PapierPeint>();
    let cache = CACHE_CONTROL;
    try {
      papiers = await resoudrePapiersPeints(autres);
    } catch (erreur) {
      console.error('[api/embed/teintes] Papiers peints indisponibles', erreur);
      cache = 'no-store';
    }

    const references: ReferenceEmbed[] = [];
    handles.forEach((handle, i) => {
      const teinte: ProduitTeinte | null = teintes[i];
      const papier = papiers.get(handle);
      if (teinte) references.push(versReferencePeinture(teinte));
      else if (papier) references.push(versReferencePapierPeint(papier));
    });
    return Response.json(references, { headers: entetes(origine, cache) });
  } catch (erreur) {
    console.error('[api/embed/teintes] Catalogue indisponible', erreur);
    return Response.json([], { status: 502, headers: entetes(origine, 'no-store') });
  }
}
