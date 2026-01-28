/**
 * Configuration centralisée des kits matériel
 * 
 * Ce fichier définit les deux kits disponibles et leurs composants individuels.
 * Les composants sont ajoutés séparément au panier pour permettre la suppression individuelle.
 */

/**
 * Interface pour un composant de kit
 */
export interface ComposantKit {
  nom: string;
  handle: string;
  prix: number;
  variantFilter?: {
    option: string;
    value: string;
  };
}

/**
 * Interface pour la configuration d'un kit
 */
export interface ConfigKit {
  handle: string;
  titre: string;
  seuil: number;
  composants: ComposantKit[];
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
    composants: [
      {
        nom: 'Bac à peindre plat',
        handle: 'bac-a-peindre-plat',
        prix: 7.55,
      },
      {
        nom: 'Rouleau anti-gouttes 180 mm',
        handle: 'rouleau-peinture-anti-gouttes-180-mm',
        prix: 8.40,
      },
      {
        nom: 'Monture rouleau 180 mm',
        handle: 'monture-rouleau-180-mm',
        prix: 5.85,
      },
      {
        nom: 'Pinceau à réchampir T0',
        handle: 'pinceau-rechampir',
        prix: 9.90,
      },
      {
        nom: 'Ruban de masquage 38mm x 50m',
        handle: 'ruban-de-masquage',
        variantFilter: {
          option: 'Taille',
          value: '38mm',
        },
        prix: 5.10,
      },
    ],
  },
  moyenneGrandeSurface: {
    handle: 'kit-materiel-de-peinture-moyenne-et-grande-surface-1',
    titre: 'Kit matériel - Moyenne et grande surface',
    seuil: 30, // m²
    composants: [
      {
        nom: 'Bac de peinture 7L + 5 recharges',
        handle: 'bac-peinture',
        prix: 14.90,
      },
      {
        nom: 'Bâche protectrice 4x5m',
        handle: 'bache-de-protection',
        prix: 5.35,
      },
      {
        nom: 'Ruban de masquage 50mm x 50m',
        handle: 'ruban-de-masquage',
        variantFilter: {
          option: 'Taille',
          value: '50mm',
        },
        prix: 5.85,
      },
      {
        nom: 'Monture rouleau 180 mm',
        handle: 'monture-rouleau-180-mm',
        prix: 5.85,
      },
      {
        nom: 'Rouleau anti-gouttes 180 mm',
        handle: 'rouleau-peinture-anti-gouttes-180-mm',
        prix: 8.40,
      },
      {
        nom: 'Pinceau à réchampir T0',
        handle: 'pinceau-rechampir',
        prix: 9.90,
      },
      {
        nom: 'Ouvre pot Colibri',
        handle: 'ouvre-pot',
        prix: 7.00,
      },
    ],
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

/**
 * Calcule le prix total d'un kit (avant remise)
 * 
 * @param typeKit - Type de kit
 * @returns Prix total en euros
 */
export function calculerPrixKit(typeKit: TypeKit): number {
  return KITS_CONFIG[typeKit].composants.reduce((sum, c) => sum + c.prix, 0);
}
