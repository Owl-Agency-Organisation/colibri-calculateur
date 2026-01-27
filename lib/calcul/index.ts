/**
 * Algorithme de calcul des quantités de peinture (v2.0)
 * 
 * Règles métier :
 * - Peinture (2 couches) : (Surface × 2 / 10) + 5% de marge, arrondi au litre le plus proche.
 * - Sous-couche (1 couche) : (Surface × 1 / 10) + 5% de marge, arrondi au litre le plus proche.
 * - Optimisation dynamique : Utilise uniquement les contenants réellement disponibles sur Shopify pour chaque couleur.
 * - Kit petite surface (≤30m²) : Prix dynamique depuis Shopify
 * - Kit moyenne/grande surface (>30m²) : Prix dynamique depuis Shopify
 */

import type { Piece, Couleur } from '@/lib/types';

// ==================== CONSTANTES ====================
const RENDEMENT_M2_PAR_LITRE = 10; // m²/L pour une couche

// Règles de finition par type de pièce
export const REGLES_FINITION: Record<string, { murs: string; plafond: string }> = {
  'piece-de-vie': { murs: 'Velours', plafond: 'Mate' },
  'chambre': { murs: 'Velours', plafond: 'Mate' },
  'cuisine': { murs: 'Satin', plafond: 'Mate' },
  'salle-de-bain': { murs: 'Satin', plafond: 'Satin' },
  'toilettes': { murs: 'Satin', plafond: 'Mate' },
  'entree': { murs: 'Velours', plafond: 'Mate' },
  'couloir': { murs: 'Velours', plafond: 'Mate' },
};
const MARGE_SECURITE = 0.05; // +5%
const SEUIL_SURFACE_KIT = 30; // m²

// Handles des kits matériels sur Shopify
export const KIT_HANDLES = {
  petiteSurface: 'kit-peinture-petite-surface',
  grandeSurface: 'kit-materiel-de-peinture-moyenne-et-grande-surface-1',
};

// Handles des sous-couches sur Shopify
export const SOUS_COUCHE_HANDLES = {
  blanche: 'sous-couche-blanche-peinture-biosourcee-murs-et-plafonds',
  grise: 'sous-couche-grise-peinture-biosourcee-murs-et-plafonds',
};

// Contenances standards disponibles (fallback si pas de variants Shopify)
const CONTENANTS_DISPONIBLES: ('12L' | '3L' | '1L')[] = ['12L', '3L', '1L'];

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
  prixTotal: number;
}

export interface CalculSousCouche {
  type: 'blanche' | 'grise';
  handle: string;
  surfaceTotale: number;
  litresNecessaires: number;
  litresCommandes: number;
  contenants: CalculContenant[];
  prixTotal: number;
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

// ==================== FONCTIONS DE CALCUL ====================

/**
 * Calcule le litrage nécessaire selon la surface, le nombre de couches et la marge de 5%
 * Arrondi au litre le plus proche.
 */
export function calculerLitresNecessaires(surface: number, couches: number): number {
  const surfaceACouvrir = surface * couches;
  const litresTheoriques = surfaceACouvrir / RENDEMENT_M2_PAR_LITRE;
  const avecMarge = litresTheoriques * (1 + MARGE_SECURITE);
  return Math.round(avecMarge); // Arrondi au litre le plus proche
}

/**
 * Extrait les contenances disponibles depuis les variants Shopify
 * Retourne les contenances en ordre décroissant (12L, 3L, 1L)
 */
export function extraireContenancesDisponibles(variants: any[]): ('1L' | '3L' | '12L')[] {
  if (!variants || variants.length === 0) {
    // Fallback : contenances standards
    return ['12L', '3L', '1L'];
  }

  const contenances = new Set<'1L' | '3L' | '12L'>();
  
  variants.forEach(variant => {
    const titre = variant.title || '';
    if (titre.includes('12L')) contenances.add('12L');
    if (titre.includes('3L')) contenances.add('3L');
    if (titre.includes('1L')) contenances.add('1L');
  });

  // Si aucune contenances détectée, utiliser les standards
  if (contenances.size === 0) {
    return ['12L', '3L', '1L'];
  }

  // Retourner en ordre décroissant
  const ordre: Record<'1L' | '3L' | '12L', number> = { '12L': 0, '3L': 1, '1L': 2 };
  return Array.from(contenances).sort((a, b) => ordre[a] - ordre[b]);
}

/**
 * Optimise la sélection des contenants pour atteindre le litrage cible
 * Utilise les contenances réellement disponibles sur Shopify
 */
export function optimiserContenants(
  litresCibles: number,
  contenancesDisponibles: ('1L' | '3L' | '12L')[] = ['12L', '3L', '1L']
): CalculContenant[] {
  const contenants: CalculContenant[] = [];
  let restant = litresCibles;

  // Créer un mapping des contenances disponibles
  const formats: Record<'1L' | '3L' | '12L', number> = { '1L': 1, '3L': 3, '12L': 12 };

  // Parcourir les contenances disponibles en ordre décroissant
  for (const contenance of contenancesDisponibles) {
    const valeur = formats[contenance];
    if (restant >= valeur) {
      const n = Math.floor(restant / valeur);
      contenants.push({
        contenance,
        quantite: n,
        litres: n * valeur,
      });
      restant -= n * valeur;
    }
  }

  // S'il reste du litrage (inférieur à la plus petite contenante), ajouter un pot
  if (restant > 0) {
    // Trouver la plus petite contenante disponible
    const plusPetite = contenancesDisponibles[contenancesDisponibles.length - 1];
    const existant = contenants.find(c => c.contenance === plusPetite);
    
    if (existant) {
      existant.quantite += 1;
      existant.litres += formats[plusPetite];
    } else {
      contenants.push({
        contenance: plusPetite,
        quantite: 1,
        litres: formats[plusPetite],
      });
    }
  }

  return contenants;
}

/**
 * Calcule le total de litres commandés
 */
export function calculerLitresCommandes(contenants: CalculContenant[]): number {
  return contenants.reduce((total, c) => total + c.litres, 0);
}

/**
 * Détermine le type de sous-couche recommandé selon la base de la couleur
 */
export function determinerTypeSousCouche(base: string): 'blanche' | 'grise' {
  const b = base.toUpperCase();
  return (b === 'C' || b === 'BLC') ? 'grise' : 'blanche';
}

// ==================== FONCTION PRINCIPALE ====================

/**
 * Calcule le prix total pour un ensemble de contenants basés sur les variants Shopify
 * Filtre sur la contenance ET la finition pour garantir le bon prix
 */
export function calculerPrixTotal(
  contenants: CalculContenant[], 
  variants: any[], 
  finition?: string
): number {
  if (!variants || variants.length === 0) return 0;
  
  return contenants.reduce((total, c) => {
    let variant;
    
    if (finition) {
      // Filtrer sur contenance + finition
      variant = variants.find(v => {
        const title = v.title || '';
        return title.includes(c.contenance) && title.includes(finition);
      });
    } else {
      // Fallback : filtrer uniquement sur la contenance (pour sous-couches)
      variant = variants.find(v => (v.title || '').includes(c.contenance));
    }
    
    const prix = variant ? parseFloat(variant.price.amount || variant.price) : 0;
    return total + (prix * c.quantite);
  }, 0);
}

/**
 * Calcule les quantités de peinture et sous-couche pour toutes les pièces
 * Utilise les variants réels de Shopify pour l'optimisation des contenants
 */
export function calculerQuantites(pieces: Piece[], shopifyData?: Record<string, any>): ResultatCalcul {
  const surfacesParCouleur = agregerSurfacesParCouleur(pieces);

  // 1. Calcul des peintures (2 couches)
  const peintures = surfacesParCouleur.map(s => {
    const litresNecessaires = calculerLitresNecessaires(s.surfaceTotale, 2);
    
    // Utiliser les variants dynamiques si disponibles, sinon fallback
    const variants = shopifyData?.[s.couleur.productHandle]?.variants || s.couleur.variants || [];
    const contenancesDisponibles = extraireContenancesDisponibles(variants);
    
    const contenants = optimiserContenants(litresNecessaires, contenancesDisponibles);
    return {
      couleur: s.couleur,
      surfaceTotale: s.surfaceTotale,
      litresNecessaires,
      litresCommandes: calculerLitresCommandes(contenants),
      contenants,
      prixTotal: calculerPrixTotal(contenants, variants, s.couleur.finition)
    };
  });

  // 2. Calcul des sous-couches (1 couche)
  const surfacesSousCouche = new Map<'blanche' | 'grise', number>();
  surfacesParCouleur.forEach(s => {
    const type = determinerTypeSousCouche(s.couleur.base);
    surfacesSousCouche.set(type, (surfacesSousCouche.get(type) || 0) + s.surfaceTotale);
  });

  const sousCouches: CalculSousCouche[] = [];
  surfacesSousCouche.forEach((surface, type) => {
    const handle = type === 'blanche' ? SOUS_COUCHE_HANDLES.blanche : SOUS_COUCHE_HANDLES.grise;
    const litresNecessaires = calculerLitresNecessaires(surface, 1);
    
    const variants = shopifyData?.[handle]?.variants || [];
    const contenancesDisponibles = extraireContenancesDisponibles(variants);
    
    const contenants = optimiserContenants(litresNecessaires, contenancesDisponibles);
    sousCouches.push({
      type,
      handle,
      surfaceTotale: surface,
      litresNecessaires,
      litresCommandes: calculerLitresCommandes(contenants),
      contenants,
      prixTotal: calculerPrixTotal(contenants, variants)
    });
  });

  // 3. Calcul de la surface totale et du kit
  const surfaceTotale = pieces.reduce((sum, p) => {
    const surfaceMurs = p.murs.reduce((total, mur) => total + mur.surface, 0);
    return sum + surfaceMurs + (p.surfacePlafond || 0) + (p.surfaceBoiseries || 0);
  }, 0);

  const kitType = surfaceTotale <= SEUIL_SURFACE_KIT ? 'petite' : 'grande';
  const kitHandle = surfaceTotale <= SEUIL_SURFACE_KIT ? KIT_HANDLES.petiteSurface : KIT_HANDLES.grandeSurface;
  const kitVariants = shopifyData?.[kitHandle]?.variants || [];
  const kitPrix = kitVariants.length > 0 ? parseFloat(kitVariants[0].price.amount || kitVariants[0].price) : 0;
  
  const kit: CalculKit = {
    type: kitType,
    handle: kitHandle,
    titre: surfaceTotale <= SEUIL_SURFACE_KIT ? 'Kit matériel de peinture - Petite surface' : 'Kit matériel de peinture - Moyenne et grande surface',
    prix: kitPrix,
  };

  // 4. Résumé
  const resume = {
    nombrePieces: pieces.length,
    nombreCouleurs: surfacesParCouleur.length,
    surfaceMurs: pieces.reduce((sum, p) => {
      return sum + p.murs.reduce((total, mur) => total + mur.surface, 0);
    }, 0),
    surfacePlafonds: pieces.reduce((sum, p) => sum + (p.surfacePlafond || 0), 0),
    surfaceBoiseries: pieces.reduce((sum, p) => sum + (p.surfaceBoiseries || 0), 0),
  };

  return {
    peintures,
    sousCouches,
    kit,
    surfaceTotale,
    resume,
  };
}

/**
 * Agrège les surfaces par couleur unique
 * Supporte le nouveau modèle multi-murs avec agrégation automatique
 */
function agregerSurfacesParCouleur(pieces: Piece[]): SurfaceParCouleur[] {
  const map = new Map<string, SurfaceParCouleur>();

  for (const piece of pieces) {
    // Traiter chaque mur individuellement
    piece.murs.forEach((mur) => {
      // Normalisation de la finition pour la clé
      const finitionKey = (mur.couleur.finition || 'default').toLowerCase().trim();
      // La clé inclut le productHandle ET la finition pour garantir la séparation
      const key = `${mur.couleur.productHandle}-${finitionKey}`;
      if (!map.has(key)) {
        map.set(key, { couleur: mur.couleur, surfaceTotale: 0, details: [] });
      }
      const entry = map.get(key)!;
      entry.surfaceTotale += mur.surface;
      entry.details.push({ 
        pieceNom: piece.nom, 
        type: 'murs', 
        surface: mur.surface 
      });
    });
    
    // Traiter le plafond (optionnel)
    if (piece.surfacePlafond && piece.couleurPlafond) {
      const finitionKey = (piece.couleurPlafond.finition || 'default').toLowerCase().trim();
      const key = `${piece.couleurPlafond.productHandle}-${finitionKey}`;
      if (!map.has(key)) {
        map.set(key, { couleur: piece.couleurPlafond, surfaceTotale: 0, details: [] });
      }
      const entry = map.get(key)!;
      entry.surfaceTotale += piece.surfacePlafond;
      entry.details.push({ 
        pieceNom: piece.nom, 
        type: 'plafond', 
        surface: piece.surfacePlafond 
      });
    }
    
    // Traiter les boiseries (optionnel)
    if (piece.surfaceBoiseries && piece.couleurBoiseries) {
      const finitionKey = (piece.couleurBoiseries.finition || 'default').toLowerCase().trim();
      const key = `${piece.couleurBoiseries.productHandle}-${finitionKey}`;
      if (!map.has(key)) {
        map.set(key, { couleur: piece.couleurBoiseries, surfaceTotale: 0, details: [] });
      }
      const entry = map.get(key)!;
      entry.surfaceTotale += piece.surfaceBoiseries;
      entry.details.push({ 
        pieceNom: piece.nom, 
        type: 'boiseries', 
        surface: piece.surfaceBoiseries 
      });
    }
  }

  return Array.from(map.values());
}
