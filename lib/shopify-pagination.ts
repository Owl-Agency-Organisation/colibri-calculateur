/**
 * Parcours complet d'une connexion Storefront paginée par curseur.
 *
 * Les routes catalogue ne doivent jamais tronquer silencieusement : une
 * limite fixe (`first: 30`, `first: 50`) a déjà fait disparaître des
 * collections (« Les Beiges ») et des teintes de la popup couleur.
 */

export interface PageInfoStorefront {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface PageStorefront<N> {
  nodes: N[];
  pageInfo: PageInfoStorefront;
}

/** Taille de page demandée à la Storefront API (maximum autorisé : 250). */
export const TAILLE_PAGE_STOREFRONT = 100;

/** Garde-fou : au-delà, la boucle s'arrête (curseur qui ne progresse pas). */
const PAGES_MAX = 50;

export async function chargerToutesLesPages<N>(
  chargerPage: (after: string | null) => Promise<PageStorefront<N> | null>,
): Promise<N[]> {
  const noeuds: N[] = [];
  let after: string | null = null;
  for (let page = 0; page < PAGES_MAX; page++) {
    const resultat = await chargerPage(after);
    if (!resultat) break;
    noeuds.push(...resultat.nodes);
    const { hasNextPage, endCursor } = resultat.pageInfo;
    if (!hasNextPage || !endCursor || endCursor === after) break;
    after = endCursor;
  }
  return noeuds;
}
