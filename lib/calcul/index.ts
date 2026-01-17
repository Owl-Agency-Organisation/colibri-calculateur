/**
 * Algorithme de calcul des quantités de peinture
 * 
 * Règles métier :
 * - Rendement peinture : 10 m²/L (2 couches incluses)
 * - Rendement sous-couche : 10 m²/L (1 couche)
 * - Contenants disponibles : 1L, 3L, 12L
 * - Sous-couche grise pour bases C et BLC (couleurs foncées/vives)
 * - Sous-couche blanche pour bases Blanc et B
 * - Kit petite surface (≤30m²) : 29,90€
 * - Kit moyenne/grande surface (>30m²) : 40,90€
 */

import type { Piece, Couleur } from '@/lib/types';

// ==================== CONSTANTES ====================

const RENDEMENT_PEINTURE = 10; // m²/L (2 couches)
const RENDEMENT_SOUS_COUCHE = 10; // m²/L (1 couche)

// Contenants disponibles (du plus grand au plus petit pour l'optimisation)
const CONTENANTS_DISPONIBLES = [
  { contenance: '12L' as const, litres: 12 },
  { contenance: '3L' as const, litres: 3 },
  { contenance: '1L' as const, litres: 1 },
];

// Seuil de surface pour le kit
const SEUIL_SURFACE_KIT = 30; // m²

// Handles des kits matériels sur Shopify
export const KIT_HANDLES = {
  petiteSurface: 'kit-materiel-de-peinture-petite-surface',
  grandeSurface: 'kit-materiel-de-peinture-moyenne-et-grande-surface',
};

// Handles des sous-couches sur Shopify
export const SOUS_COUCHE_HANDLES = {
  blanche: 'sous-couche-blanche-peinture-biosourcee-murs-et-plafonds',
  grise: 'sous-couche-grise-peinture-biosourcee-murs-et-plafonds',
};

// ==================== TYPES ====================

export interface SurfaceParCouleur {
  couleur: Couleur;
  surfaceTotale: number;
  details: {
    pieceNom: string;
    type: 'murs' | 'plafond' | 'boiseries';
    surface: number;
  }[];
}

export interface CalculContenant {
  contenance: '1L' | '3L' | '12L';
  quantite: number;
  litres: number;
}

export interface CalculPeinture {
  couleur: Couleur;
  surfaceTotale: number;
  litresNecessaires: number;
  litresCommandes: number;
  contenants: CalculContenant[];
  prixEstime?: number;
}

export interface CalculSousCouche {
  type: 'blanche' | 'grise';
  handle: string;
  surfaceTotale: number;
  litresNecessaires: number;
  litresCommandes: number;
  contenants: CalculContenant[];
  prixEstime?: number;
}

export interface CalculKit {
  type: 'petite' | 'grande';
  handle: string;
  titre: string;
  prix: number;
}

export interface ResultatCalcul {
  peintures: CalculPeinture[];
  sousCouches: CalculSousCouche[];
  kit: CalculKit;
  surfaceTotale: number;
  resume: {
    nombrePieces: number;
    nombreCouleurs: number;
    surfaceMurs: number;
    surfacePlafonds: number;
    surfaceBoiseries: number;
  };
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Détermine le type de sous-couche recommandé selon la base de la couleur
 */
export function determinerTypeSousCouche(base: string): 'blanche' | 'grise' {
  // Bases nécessitant une sous-couche grise (couleurs foncées/vives)
  const basesGrises = ['C', 'BLC'];
  return basesGrises.includes(base) ? 'grise' : 'blanche';
}

/**
 * Calcule les litres nécessaires pour une surface donnée
 */
export function calculerLitresNecessaires(surface: number, rendement: number): number {
  return Math.ceil((surface / rendement) * 10) / 10; // Arrondi au dixième supérieur
}

/**
 * Optimise la sélection des contenants pour minimiser le gaspillage
 * Utilise un algorithme glouton du plus grand au plus petit
 */
export function optimiserContenants(litresNecessaires: number): CalculContenant[] {
  const contenants: CalculContenant[] = [];
  let litresRestants = litresNecessaires;

  for (const { contenance, litres } of CONTENANTS_DISPONIBLES) {
    if (litresRestants <= 0) break;

    // Calculer combien de ce contenant on peut utiliser
    const quantite = Math.floor(litresRestants / litres);
    
    if (quantite > 0) {
      contenants.push({
        contenance,
        quantite,
        litres: quantite * litres,
      });
      litresRestants -= quantite * litres;
    }
  }

  // S'il reste des litres, ajouter le plus petit contenant nécessaire
  if (litresRestants > 0) {
    // Trouver le plus petit contenant qui couvre les litres restants
    for (let i = CONTENANTS_DISPONIBLES.length - 1; i >= 0; i--) {
      const { contenance, litres } = CONTENANTS_DISPONIBLES[i];
      if (litres >= litresRestants) {
        // Vérifier si on a déjà ce contenant
        const existant = contenants.find(c => c.contenance === contenance);
        if (existant) {
          existant.quantite += 1;
          existant.litres += litres;
        } else {
          contenants.push({
            contenance,
            quantite: 1,
            litres,
          });
        }
        break;
      }
    }
  }

  // Trier par taille décroissante pour l'affichage
  return contenants.sort((a, b) => {
    const ordre = { '12L': 0, '3L': 1, '1L': 2 };
    return ordre[a.contenance] - ordre[b.contenance];
  });
}

/**
 * Calcule le total de litres commandés
 */
export function calculerLitresCommandes(contenants: CalculContenant[]): number {
  return contenants.reduce((total, c) => total + c.litres, 0);
}

// ==================== FONCTION PRINCIPALE ====================

/**
 * Calcule les quantités de peinture et sous-couche pour toutes les pièces
 */
export function calculerQuantites(pieces: Piece[]): ResultatCalcul {
  // 1. Agréger les surfaces par couleur
  const surfacesParCouleur = agregerSurfacesParCouleur(pieces);

  // 2. Calculer les peintures
  const peintures = calculerPeintures(surfacesParCouleur);

  // 3. Calculer les sous-couches
  const sousCouches = calculerSousCouches(surfacesParCouleur);

  // 4. Calculer la surface totale et déterminer le kit
  const surfaceTotale = calculerSurfaceTotale(pieces);
  const kit = determinerKit(surfaceTotale);

  // 5. Calculer le résumé
  const resume = calculerResume(pieces);

  return {
    peintures,
    sousCouches,
    kit,
    surfaceTotale,
    resume,
  };
}

/**
 * Agrège les surfaces par couleur (même couleur = même calcul)
 */
function agregerSurfacesParCouleur(pieces: Piece[]): SurfaceParCouleur[] {
  const map = new Map<string, SurfaceParCouleur>();

  for (const piece of pieces) {
    // Murs
    const keyMurs = piece.couleurMurs.productHandle;
    if (!map.has(keyMurs)) {
      map.set(keyMurs, {
        couleur: piece.couleurMurs,
        surfaceTotale: 0,
        details: [],
      });
    }
    const entryMurs = map.get(keyMurs)!;
    entryMurs.surfaceTotale += piece.surfaceMurs;
    entryMurs.details.push({
      pieceNom: piece.nom,
      type: 'murs',
      surface: piece.surfaceMurs,
    });

    // Plafond
    if (piece.surfacePlafond && piece.couleurPlafond) {
      const keyPlafond = piece.couleurPlafond.productHandle;
      if (!map.has(keyPlafond)) {
        map.set(keyPlafond, {
          couleur: piece.couleurPlafond,
          surfaceTotale: 0,
          details: [],
        });
      }
      const entryPlafond = map.get(keyPlafond)!;
      entryPlafond.surfaceTotale += piece.surfacePlafond;
      entryPlafond.details.push({
        pieceNom: piece.nom,
        type: 'plafond',
        surface: piece.surfacePlafond,
      });
    }

    // Boiseries
    if (piece.surfaceBoiseries && piece.couleurBoiseries) {
      const keyBoiseries = piece.couleurBoiseries.productHandle;
      if (!map.has(keyBoiseries)) {
        map.set(keyBoiseries, {
          couleur: piece.couleurBoiseries,
          surfaceTotale: 0,
          details: [],
        });
      }
      const entryBoiseries = map.get(keyBoiseries)!;
      entryBoiseries.surfaceTotale += piece.surfaceBoiseries;
      entryBoiseries.details.push({
        pieceNom: piece.nom,
        type: 'boiseries',
        surface: piece.surfaceBoiseries,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Calcule les quantités de peinture pour chaque couleur
 */
function calculerPeintures(surfacesParCouleur: SurfaceParCouleur[]): CalculPeinture[] {
  return surfacesParCouleur.map(({ couleur, surfaceTotale, details }) => {
    const litresNecessaires = calculerLitresNecessaires(surfaceTotale, RENDEMENT_PEINTURE);
    const contenants = optimiserContenants(litresNecessaires);
    const litresCommandes = calculerLitresCommandes(contenants);

    return {
      couleur,
      surfaceTotale,
      litresNecessaires,
      litresCommandes,
      contenants,
    };
  });
}

/**
 * Calcule les quantités de sous-couche par type (blanche/grise)
 */
function calculerSousCouches(surfacesParCouleur: SurfaceParCouleur[]): CalculSousCouche[] {
  // Agréger les surfaces par type de sous-couche
  const surfaceBlanche = surfacesParCouleur
    .filter(s => determinerTypeSousCouche(s.couleur.base) === 'blanche')
    .reduce((sum, s) => sum + s.surfaceTotale, 0);

  const surfaceGrise = surfacesParCouleur
    .filter(s => determinerTypeSousCouche(s.couleur.base) === 'grise')
    .reduce((sum, s) => sum + s.surfaceTotale, 0);

  const sousCouches: CalculSousCouche[] = [];

  if (surfaceBlanche > 0) {
    const litresNecessaires = calculerLitresNecessaires(surfaceBlanche, RENDEMENT_SOUS_COUCHE);
    const contenants = optimiserContenants(litresNecessaires);
    const litresCommandes = calculerLitresCommandes(contenants);

    sousCouches.push({
      type: 'blanche',
      handle: SOUS_COUCHE_HANDLES.blanche,
      surfaceTotale: surfaceBlanche,
      litresNecessaires,
      litresCommandes,
      contenants,
    });
  }

  if (surfaceGrise > 0) {
    const litresNecessaires = calculerLitresNecessaires(surfaceGrise, RENDEMENT_SOUS_COUCHE);
    const contenants = optimiserContenants(litresNecessaires);
    const litresCommandes = calculerLitresCommandes(contenants);

    sousCouches.push({
      type: 'grise',
      handle: SOUS_COUCHE_HANDLES.grise,
      surfaceTotale: surfaceGrise,
      litresNecessaires,
      litresCommandes,
      contenants,
    });
  }

  return sousCouches;
}

/**
 * Calcule la surface totale de toutes les pièces
 */
function calculerSurfaceTotale(pieces: Piece[]): number {
  return pieces.reduce((total, piece) => {
    let surface = piece.surfaceMurs;
    if (piece.surfacePlafond) surface += piece.surfacePlafond;
    if (piece.surfaceBoiseries) surface += piece.surfaceBoiseries;
    return total + surface;
  }, 0);
}

/**
 * Détermine le kit matériel selon la surface totale
 */
function determinerKit(surfaceTotale: number): CalculKit {
  if (surfaceTotale <= SEUIL_SURFACE_KIT) {
    return {
      type: 'petite',
      handle: KIT_HANDLES.petiteSurface,
      titre: 'Kit matériel de peinture - Petite surface',
      prix: 29.90,
    };
  } else {
    return {
      type: 'grande',
      handle: KIT_HANDLES.grandeSurface,
      titre: 'Kit matériel de peinture - Moyenne et grande surface',
      prix: 40.90,
    };
  }
}

/**
 * Calcule le résumé des surfaces
 */
function calculerResume(pieces: Piece[]) {
  const surfaceMurs = pieces.reduce((sum, p) => sum + p.surfaceMurs, 0);
  const surfacePlafonds = pieces.reduce((sum, p) => sum + (p.surfacePlafond || 0), 0);
  const surfaceBoiseries = pieces.reduce((sum, p) => sum + (p.surfaceBoiseries || 0), 0);

  // Compter les couleurs uniques
  const couleursUniques = new Set<string>();
  pieces.forEach(p => {
    couleursUniques.add(p.couleurMurs.productHandle);
    if (p.couleurPlafond) couleursUniques.add(p.couleurPlafond.productHandle);
    if (p.couleurBoiseries) couleursUniques.add(p.couleurBoiseries.productHandle);
  });

  return {
    nombrePieces: pieces.length,
    nombreCouleurs: couleursUniques.size,
    surfaceMurs,
    surfacePlafonds,
    surfaceBoiseries,
  };
}
