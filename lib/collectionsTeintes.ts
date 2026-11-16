/**
 * Collections de teintes proposées dans la popup couleur (et le labo du pont).
 *
 * Règle unique, alignée sur l'export Wizart (`PAINT_EXCLUDED_COLLECTIONS`,
 * `scripts/wizart/common.ts`) :
 * - familles de couleurs murales : titres commençant par « Les » ;
 * - sauf les laques (« Les laques … », bois et métal, hors murs) et les
 *   sélections thématiques transverses (« Les Pastels », « Les Peps »,
 *   « Les Tendances ») dont les teintes appartiennent déjà aux familles ;
 * - plus la collection « Schmidt X Colibri », affichée en dernier.
 *
 * Familles triées par ordre alphabétique : l'ordre de création des
 * collections dans Shopify ne veut rien dire pour le client, et une nouvelle
 * famille trouve sa place sans modifier le code.
 */

export const COLLECTION_SCHMIDT = 'Schmidt X Colibri';

/** Titres de collections « Les … » écartés de la popup couleur. */
export const COLLECTIONS_TEINTES_EXCLUES = /laque|pastel|peps|tendance/i;

export function estCollectionTeintes(titre: string): boolean {
  const nom = titre.trim();
  if (nom === COLLECTION_SCHMIDT) return true;
  return nom.startsWith('Les ') && !COLLECTIONS_TEINTES_EXCLUES.test(nom);
}

/** Filtre puis trie les collections : familles A→Z, Schmidt X Colibri en dernier. */
export function selectionnerCollectionsTeintes<C extends { title: string }>(collections: readonly C[]): C[] {
  return collections
    .filter((collection) => estCollectionTeintes(collection.title))
    .sort((a, b) => {
      const schmidtA = a.title.trim() === COLLECTION_SCHMIDT;
      const schmidtB = b.title.trim() === COLLECTION_SCHMIDT;
      if (schmidtA !== schmidtB) return schmidtA ? 1 : -1;
      return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
    });
}
