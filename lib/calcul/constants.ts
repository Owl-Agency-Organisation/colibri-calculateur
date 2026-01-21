/**
 * Constantes pour le système de calcul de peinture Colibri
 * 
 * @module lib/calcul/constants
 * @author Owl Agency
 * @version 2.0.0
 */

/**
 * Rendement de la peinture Colibri
 * 
 * @constant
 * @description Nombre de m² couverts par 1 litre de peinture pour 1 couche
 * @default 10
 * @unit m²/L/couche
 * 
 * @example
 * // Pour 2 couches sur 20 m²
 * const litresNecessaires = (20 / RENDEMENT_PEINTURE) * 2; // = 4 L
 */
export const RENDEMENT_PEINTURE = 10; // m²/L/couche

/**
 * Nombre de couches pour la sous-couche
 * 
 * @constant
 * @description La sous-couche s'applique toujours en 1 seule couche
 * @default 1
 * 
 * @see https://colibri-peintures.com/pages/conseils-application
 */
export const NOMBRE_COUCHES_SOUS_COUCHE = 1;

/**
 * Nombre de couches pour la peinture de finition
 * 
 * @constant
 * @description La peinture de finition s'applique toujours en 2 couches
 * pour un résultat optimal
 * @default 2
 * 
 * @see https://colibri-peintures.com/pages/conseils-application
 */
export const NOMBRE_COUCHES_FINITION = 2;

/**
 * Marge de sécurité appliquée au calcul
 * 
 * @constant
 * @description Marge de 5% ajoutée au calcul pour compenser :
 * - Les pertes lors de l'application
 * - Les variations de porosité du support
 * - Les retouches éventuelles
 * @default 0.05
 * @unit pourcentage (exprimé en décimal)
 * 
 * @example
 * const litresAvecMarge = litresBruts * (1 + MARGE_SECURITE); // +5%
 */
export const MARGE_SECURITE = 0.05; // 5%

/**
 * Contenances de pots disponibles (en litres)
 * 
 * @constant
 * @description Liste des contenances disponibles pour les peintures Colibri,
 * triées du plus grand au plus petit pour l'algorithme d'optimisation glouton.
 * 
 * @remarks
 * - Les testeurs (100ml) ne sont pas inclus dans l'optimisation
 * - L'ordre est important pour l'algorithme glouton (12L > 3L > 1L)
 */
export const CONTENANCES_DISPONIBLES = [
  { contenance: '12L' as const, litres: 12 },
  { contenance: '3L' as const, litres: 3 },
  { contenance: '1L' as const, litres: 1 },
];

/**
 * Mapping des types de pièces vers les finitions recommandées
 * 
 * @constant
 * @description Finition recommandée selon le type de pièce, basé sur :
 * - L'humidité de la pièce
 * - Le trafic (passage fréquent ou non)
 * - La facilité d'entretien
 * 
 * @see https://colibri-peintures.com/pages/choisir-finition
 */
export const FINITIONS_PAR_PIECE = {
  /** Pièce de vie : finition velours (lessivable, résistante) */
  vie: 'Velours' as const,
  /** Chambre : finition mat (douce, apaisante) */
  chambre: 'Mat' as const,
  /** Cuisine : finition satin (très lessivable, résistante aux projections) */
  cuisine: 'Satin' as const,
  /** Salle de bain : finition satin (résistante à l'humidité) */
  sdb: 'Satin' as const,
  /** WC : finition velours (lessivable) */
  wc: 'Velours' as const,
  /** Couloir : finition velours (résistante au passage) */
  couloir: 'Velours' as const,
  /** Entrée : finition satin (très résistante au passage) */
  entree: 'Satin' as const,
};

/**
 * Codes couleurs Schmidt nécessitant une sous-couche grise
 * 
 * @constant
 * @description Certaines teintes Schmidt spécifiques nécessitent une
 * sous-couche grise au lieu de blanche pour un rendu optimal des pigments.
 * 
 * @remarks
 * Liste fournie par Colibri basée sur les références Schmidt
 */
export const COULEURS_SCHMIDT_SOUS_COUCHE_GRISE = [
  'S16', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29',
  'S30', 'S31', 'S32', 'S33', 'S34', 'S35', 'S36', 'S37',
];

/**
 * Handle Shopify de la sous-couche blanche
 * 
 * @constant
 * @description Handle du produit sous-couche blanche dans Shopify
 */
export const SOUS_COUCHE_BLANCHE_HANDLE = 'sous-couche-blanche-peinture-biosourcee-murs-et-plafonds';

/**
 * Handle Shopify de la sous-couche grise
 * 
 * @constant
 * @description Handle du produit sous-couche grise dans Shopify
 */
export const SOUS_COUCHE_GRISE_HANDLE = 'sous-couche-grise-peinture-biosourcee-murs-et-plafonds';

/**
 * Seuil d'arrondi pour les litres
 * 
 * @constant
 * @description Seuil décimal pour arrondir au litre supérieur ou inférieur :
 * - < 0.5 → arrondir au litre inférieur
 * - >= 0.5 → arrondir au litre supérieur
 * @default 0.5
 * 
 * @example
 * // 5,4 L → 5 L (0,4 < 0,5)
 * // 5,5 L → 6 L (0,5 >= 0,5)
 * // 5,6 L → 6 L (0,6 >= 0,5)
 */
export const SEUIL_ARRONDI = 0.5;

/**
 * Version de l'algorithme de calcul
 * 
 * @constant
 * @description Version de l'algorithme (Semantic Versioning)
 * @see https://semver.org/
 */
export const VERSION_ALGORITHME = '2.0.0';

/**
 * Changelog de l'algorithme
 * 
 * @constant
 * @description Historique des modifications de l'algorithme
 */
export const CHANGELOG = {
  '2.0.0': {
    date: '2026-01-21',
    changes: [
      'CORRECTIF : Rendement corrigé à 10 m²/L/COUCHE (au lieu de 10 m²/L pour 2 couches)',
      'AJOUT : Marge de sécurité de 5% appliquée avant arrondi',
      'CORRECTIF : Arrondi selon règle x,5 (< 0,5 → arrondir inf, >= 0,5 → arrondir sup)',
      'AJOUT : Interrogation dynamique des variants Shopify',
      'AJOUT : Sélection automatique du variant correct (gamme + finition + contenance)',
      'AJOUT : Calcul des prix par variant et prix total',
      'AMÉLIORATION : Documentation complète et commentaires exhaustifs',
    ],
  },
  '1.0.0': {
    date: '2026-01-15',
    changes: [
      'Version initiale de l\'algorithme',
      'Calcul de base avec contenants fixes',
      'Rendement incorrect (10 m² pour 2 couches)',
      'Pas de marge de sécurité',
      'Arrondi au dixième',
    ],
  },
};
