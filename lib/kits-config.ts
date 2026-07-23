/**
 * Configuration des kits matériel — tout-ou-rien.
 *
 * Le kit est un produit Shopify unique, vendu au prix bundle. Le handle et le seuil
 * de recommandation sont la seule référence conservée ici ; le prix et le contenu
 * affiché (description) proviennent exclusivement de la Storefront API.
 */

/**
 * Interface pour la configuration d'un kit
 */
export interface ConfigKit {
  handle: string;
  titre: string;
  seuil: number;
}

/**
 * Type pour identifier un kit
 */
export type TypeKit = 'petiteSurface' | 'moyenneGrandeSurface';

/**
 * Configuration des deux kits disponibles
 */
export const KITS_CONFIG: Record<TypeKit, ConfigKit> = {
  petiteSurface: {
    handle: 'kit-peinture-petite-surface',
    titre: 'Kit matériel - Petite surface',
    seuil: 30, // m²
  },
  moyenneGrandeSurface: {
    handle: 'kit-materiel-de-peinture-moyenne-et-grande-surface-1',
    titre: 'Kit matériel - Moyenne et grande surface',
    seuil: 30, // m²
  },
};

/**
 * Détermine le type de kit à utiliser selon la surface totale
 *
 * @param surfaceTotale - Surface totale en m²
 * @returns Le type de kit approprié
 */
export function determinerKit(surfaceTotale: number): TypeKit {
  return surfaceTotale <= KITS_CONFIG.petiteSurface.seuil
    ? 'petiteSurface'
    : 'moyenneGrandeSurface';
}
