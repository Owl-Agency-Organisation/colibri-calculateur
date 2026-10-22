import { callAdminAPI } from '@/lib/shopify-admin';
import {
  REQUETE_CATALOGUE_PAPIERS_PEINTS,
  cataloguePapiersPeints,
  type PapierPeint,
  type ProduitPapierPeintAdmin,
} from '@/lib/papierPeint';

/**
 * Résolution des SKU de papiers peints — SERVEUR UNIQUEMENT (Admin API).
 * La Storefront API ne permet pas de chercher une variante par SKU (filtres
 * de `products(query:)` : type, tag, titre, vendeur, prix, disponibilité).
 *
 * Les routes qui l'utilisent sont publiques et les identifiants Admin servent
 * aussi à l'estimation (clients, draft orders) : aucune requête n'est faite
 * par référence reçue. Le catalogue des papiers peints (table SKU → papier
 * peint) est lu en une requête et gardé en mémoire 10 minutes ; une référence
 * inconnue ne coûte aucun appel. Un échec n'est jamais mis en cache.
 */

export const DUREE_CACHE_PAPIERS_PEINTS_MS = 10 * 60 * 1000;

// Garde-fou de pagination (50 produits par page)
const MAX_PAGES = 10;

interface ReponseCatalogue {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ProduitPapierPeintAdmin[];
  };
}

let cache: { table: Map<string, PapierPeint>; expireA: number } | null = null;
// Lecture en cours, partagée par les requêtes simultanées
let lecture: Promise<Map<string, PapierPeint>> | null = null;

async function lireCatalogue(): Promise<Map<string, PapierPeint>> {
  const produits: ProduitPapierPeintAdmin[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data: ReponseCatalogue = await callAdminAPI<ReponseCatalogue>(REQUETE_CATALOGUE_PAPIERS_PEINTS, { after });
    produits.push(...data.products.nodes);
    const { hasNextPage, endCursor } = data.products.pageInfo;
    if (!hasNextPage || !endCursor) break;
    after = endCursor;
  }
  return cataloguePapiersPeints(produits);
}

/** Catalogue des papiers peints (cache mémoire de 10 minutes). Lève une erreur si l'Admin API est indisponible. */
export async function chargerCataloguePapiersPeints(): Promise<Map<string, PapierPeint>> {
  if (cache && cache.expireA > Date.now()) return cache.table;
  if (!lecture) {
    lecture = lireCatalogue()
      .then((table) => {
        cache = { table, expireA: Date.now() + DUREE_CACHE_PAPIERS_PEINTS_MS };
        return table;
      })
      .finally(() => {
        lecture = null;
      });
  }
  return lecture;
}

/**
 * Papiers peints connus parmi les SKU donnés (déjà validés), lus dans le
 * catalogue en cache. Les SKU inconnus sont absents de la table. Aucun SKU :
 * aucun appel. Lève une erreur si le catalogue ne peut pas être lu.
 */
export async function resoudrePapiersPeints(skus: readonly string[]): Promise<Map<string, PapierPeint>> {
  const trouves = new Map<string, PapierPeint>();
  if (skus.length === 0) return trouves;
  const catalogue = await chargerCataloguePapiersPeints();
  for (const sku of skus) {
    const papier = catalogue.get(sku);
    if (papier) trouves.set(sku, papier);
  }
  return trouves;
}

/** Vide le cache (tests). */
export function viderCachePapiersPeints(): void {
  cache = null;
  lecture = null;
}
