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

// Verrou de gamme : les fiches Colibri exposent deux gammes pour un même coloris —
// « Biosourcée » (standard) et « Biosourcée dépolluante ». Elles partagent contenance
// ET finition, donc un simple `.find(contenance + finition)` retiendrait la première
// dans l'ordre de l'API (non déterministe → écart de prix, ex. Schmidt Blanc 3L Mate
// 92,68 € vs Dépolluante 107,65 €). On sélectionne donc explicitement la gamme
// standard en excluant la Dépolluante (marqueur fiable quel que soit le libellé exact,
// « Dépolluante » seul ou « Biosourcée dépolluante »).
const MARQUEURS_DEPOLLUANTE = ['dépollu', 'depollu'];

/**
 * Vrai si le variant appartient à la gamme standard (Biosourcée), c.-à-d. n'est PAS
 * de la gamme Dépolluante. Sert de verrou de gamme lors de la sélection du variant.
 */
export function estVariantGammeStandard(title?: string): boolean {
  const t = (title || '').toLowerCase();
  return !MARQUEURS_DEPOLLUANTE.some((m) => t.includes(m));
}

/**
 * Parmi des variants déjà filtrés sur contenance + finition, retient la gamme standard
 * (Biosourcée) quand le produit expose les deux gammes ; sinon garde l'unique gamme
 * disponible (produits mono-gamme intacts). Déterministe : ne dépend jamais de l'ordre
 * de retour de l'API.
 */
export function selectionnerVariantGammeStandard<T extends { title?: string }>(
  candidats: T[]
): T | undefined {
  if (candidats.length === 0) return undefined;
  const standard = candidats.filter((v) => estVariantGammeStandard(v.title));
  return (standard.length > 0 ? standard : candidats)[0];
}

/**
 * SÉLECTION DE VARIANTE UNIQUE ET PARTAGÉE (contenance + finition + gamme).
 *
 * C'est LA voie de sélection : la table de prix de l'optimiseur de contenants,
 * le prix affiché (`calculerPrixTotal`) et la ligne mise au panier
 * (`cart-mapper.findVariant`) passent tous par cette fonction. Le prix qui a
 * guidé le choix, le prix montré et le produit commandé proviennent donc du
 * même variant par construction — même classe de verrou que la gamme en Phase 2.
 *
 * Filtre contenance + finition (insensible à la casse), verrou gamme Biosourcée ;
 * si aucune correspondance avec la finition, repli sur la contenance seule
 * (toujours gamme-verrouillé) — identique pour le prix et le panier.
 */
export function selectionnerVariantContenance<T extends { title?: string }>(
  variants: T[] | undefined | null,
  contenance: string,
  finition?: string
): T | undefined {
  if (!variants || variants.length === 0) return undefined;

  const contenanceCible = contenance.toLowerCase();
  const finitionCible = finition?.toLowerCase();

  if (finitionCible) {
    const candidats = variants.filter((v) => {
      const title = (v.title || '').toLowerCase();
      return title.includes(contenanceCible) && title.includes(finitionCible);
    });
    const variant = selectionnerVariantGammeStandard(candidats);
    if (variant) return variant;
  }

  // Repli : contenance seule (sous-couches, ou finition absente des titres)
  const candidats = variants.filter((v) =>
    (v.title || '').toLowerCase().includes(contenanceCible)
  );
  return selectionnerVariantGammeStandard(candidats);
}

// Handles des kits matériels sur Shopify
export const KIT_HANDLES = {
  petiteSurface: 'kit-peinture-petite-surface',
  grandeSurface: 'kit-materiel-de-peinture-moyenne-et-grande-surface-1',
};

/**
 * Sélectionne le variant d'un produit kit (bundle Shopify à variant unique).
 * Verrou : les kits n'ont qu'un seul variant par construction. Si la boutique
 * en ajoutait un deuxième (nouvelle déclinaison), la sélection deviendrait
 * ambiguë — on le signale bruyamment dans les logs plutôt que de choisir en
 * silence. Utilisé par le calcul du prix ET le mapping panier, pour que le
 * prix affiché et la ligne envoyée à Shopify ne divergent jamais.
 */
export function selectionnerVariantKit<T>(variants: T[] | undefined | null): T | undefined {
  if (!variants || variants.length === 0) return undefined;
  if (variants.length > 1) {
    console.error(
      `Kit bundle : ${variants.length} variants détectés alors qu'un seul est attendu — ` +
        'vérifier la fiche produit boutique (le premier variant est retenu par défaut).'
    );
  }
  return variants[0];
}

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
  /** Explication quand la composition dépasse le besoin par choix de prix */
  justification?: string;
}

export interface CalculSousCouche {
  type: 'blanche' | 'grise';
  handle: string;
  surfaceTotale: number;
  litresNecessaires: number;
  litresCommandes: number;
  contenants: CalculContenant[];
  prixTotal: number;
  /** Explication quand la composition dépasse le besoin par choix de prix */
  justification?: string;
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

// ==================== OPTIMISATION PAR LE PRIX ====================

export interface OptimisationContenants {
  contenants: CalculContenant[];
  /**
   * Explication affichée quand la composition retenue dépasse le besoin suite
   * à un choix de prix (ex. « Le format 12 L revient moins cher que 3×3 L »).
   * Absente quand la composition est celle du glouton historique.
   */
  justification?: string;
}

// Tolérance du garde-fou "nombre de pots" : à moins de 5 % d'écart de prix,
// la composition avec le moins de pots gagne (évite les 11×1L "optimaux"
// mais absurdes si une promo rendait le litre en 1L moins cher).
const TOLERANCE_POTS_NUM = 21; // coût ≤ C* × 21/20 ⇔ +5 %, en arithmétique entière
const TOLERANCE_POTS_DEN = 20;

const ORDRE_CONTENANCES: Record<'1L' | '3L' | '12L', number> = { '12L': 0, '3L': 1, '1L': 2 };

/** Formate une composition pour la justification : « 12 L », « 3×3 L + 2×1 L » */
function formaterComposition(contenants: CalculContenant[]): string {
  return contenants
    .map((c) => (c.quantite === 1 ? c.contenance.replace('L', ' L') : `${c.quantite}×${c.contenance.replace('L', ' L')}`))
    .join(' + ');
}

/** Coût en centimes d'une composition selon la table de prix ; undefined si un prix manque */
function coutComposition(
  contenants: CalculContenant[],
  prixCentimes: Partial<Record<'1L' | '3L' | '12L', number>>
): number | undefined {
  let total = 0;
  for (const c of contenants) {
    const prix = prixCentimes[c.contenance];
    if (prix === undefined) return undefined;
    total += prix * c.quantite;
  }
  return total;
}

/**
 * Optimise la sélection des contenants PAR LE PRIX : retient la combinaison la
 * moins chère parmi celles qui couvrent le litrage nécessaire (programmation
 * dynamique type rendu de monnaie sur les litres), avec garde-fou sur le
 * nombre de pots (à moins de 5 % d'écart, moins de pots gagne).
 *
 * L'optimiseur ne sélectionne JAMAIS de variante : il consomme une table de
 * prix par contenance construite via `selectionnerVariantContenance` — la même
 * voie que le prix affiché et la ligne panier (aucune divergence possible).
 *
 * Garde-fous :
 * - couvre toujours au moins le litrage nécessaire ;
 * - sans prix exploitables (variants absents, API en échec), repli sur le
 *   glouton historique `optimiserContenants` — jamais de panier vide ;
 * - ne travaille que sur les contenances réellement disponibles pour la couleur.
 */
export function optimiserContenantsParPrix(
  litresCibles: number,
  contenancesDisponibles: ('1L' | '3L' | '12L')[] = ['12L', '3L', '1L'],
  variants: any[] = [],
  finition?: string
): OptimisationContenants {
  const glouton = optimiserContenants(litresCibles, contenancesDisponibles);
  if (litresCibles <= 0) return { contenants: glouton };

  // Table de prix par contenance — l'unique voie de sélection de variante
  const tailles: Record<'1L' | '3L' | '12L', number> = { '1L': 1, '3L': 3, '12L': 12 };
  const prixCentimes: Partial<Record<'1L' | '3L' | '12L', number>> = {};
  for (const contenance of contenancesDisponibles) {
    const variant = selectionnerVariantContenance(variants, contenance, finition);
    const brut = variant ? parseFloat(variant.price?.amount ?? variant.price) : NaN;
    if (Number.isFinite(brut) && brut > 0) {
      prixCentimes[contenance] = Math.round(brut * 100);
    }
  }

  const disponibles = contenancesDisponibles.filter((c) => prixCentimes[c] !== undefined);
  if (disponibles.length === 0) {
    // Aucun prix exploitable : comportement historique inchangé
    return { contenants: glouton };
  }

  // DP exacte sur l'état (litres atteints, nombre de pots) → coût minimal.
  // Bornes : tout optimum couvre < besoin + plus grande contenance (au-delà,
  // retirer un pot couvre encore le besoin en coûtant moins cher).
  const tailleMax = Math.max(...disponibles.map((c) => tailles[c]));
  const tMax = litresCibles + tailleMax;
  const INFINI = Number.POSITIVE_INFINITY;

  // cout[t][n] : coût minimal pour atteindre exactement t litres avec n pots
  const cout: number[][] = Array.from({ length: tMax + 1 }, () => Array(tMax + 1).fill(INFINI));
  const choix: ('1L' | '3L' | '12L' | null)[][] = Array.from({ length: tMax + 1 }, () =>
    Array(tMax + 1).fill(null)
  );
  cout[0][0] = 0;

  for (let t = 1; t <= tMax; t++) {
    for (let n = 1; n <= t; n++) {
      for (const contenance of disponibles) {
        const taille = tailles[contenance];
        if (t < taille) continue;
        const precedent = cout[t - taille][n - 1];
        if (precedent === INFINI) continue;
        const candidat = precedent + (prixCentimes[contenance] as number);
        if (candidat < cout[t][n]) {
          cout[t][n] = candidat;
          choix[t][n] = contenance;
        }
      }
    }
  }

  // Candidates : tous les états couvrant le besoin
  interface Candidat { t: number; n: number; cout: number }
  const candidats: Candidat[] = [];
  let coutMinimal = INFINI;
  for (let t = litresCibles; t <= tMax; t++) {
    for (let n = 0; n <= t; n++) {
      if (cout[t][n] !== INFINI) {
        candidats.push({ t, n, cout: cout[t][n] });
        if (cout[t][n] < coutMinimal) coutMinimal = cout[t][n];
      }
    }
  }
  if (candidats.length === 0) return { contenants: glouton };

  // Garde-fou pots : fenêtre de tolérance +5 % autour du coût minimal, puis
  // moins de pots → moins cher → moindre excès de litres
  const fenetre = candidats.filter(
    (c) => c.cout * TOLERANCE_POTS_DEN <= coutMinimal * TOLERANCE_POTS_NUM
  );
  fenetre.sort((a, b) => a.n - b.n || a.cout - b.cout || a.t - b.t);
  const retenu = fenetre[0];

  // Reconstruction de la composition
  const quantites: Partial<Record<'1L' | '3L' | '12L', number>> = {};
  let t = retenu.t;
  let n = retenu.n;
  while (t > 0 && n > 0) {
    const contenance = choix[t][n];
    if (!contenance) break; // défensif : ne peut pas arriver sur un état atteignable
    quantites[contenance] = (quantites[contenance] || 0) + 1;
    t -= tailles[contenance];
    n -= 1;
  }

  const contenants: CalculContenant[] = (Object.keys(quantites) as ('1L' | '3L' | '12L')[])
    .sort((a, b) => ORDRE_CONTENANCES[a] - ORDRE_CONTENANCES[b])
    .map((contenance) => ({
      contenance,
      quantite: quantites[contenance] as number,
      litres: (quantites[contenance] as number) * tailles[contenance],
    }));

  // Justification à l'écran : uniquement quand la composition diffère du
  // glouton ET dépasse le besoin (sinon un 12 L pour 9 L passe pour un bug)
  const identiqueAuGlouton =
    contenants.length === glouton.length &&
    contenants.every((c) =>
      glouton.some((g) => g.contenance === c.contenance && g.quantite === c.quantite)
    );

  let justification: string | undefined;
  if (!identiqueAuGlouton && calculerLitresCommandes(contenants) > litresCibles) {
    const coutGlouton = coutComposition(glouton, prixCentimes);
    if (coutGlouton !== undefined) {
      if (retenu.cout < coutGlouton) {
        justification = `Le format ${formaterComposition(contenants)} revient moins cher que ${formaterComposition(glouton)}.`;
      } else if (retenu.cout === coutGlouton) {
        justification = `Le format ${formaterComposition(contenants)} est au même prix que ${formaterComposition(glouton)}, en moins de pots.`;
      } else {
        justification = `Le format ${formaterComposition(contenants)} limite le nombre de pots pour un écart de prix inférieur à 5 %.`;
      }
    }
  }

  return { contenants, justification };
}

/**
 * Détermine le type de sous-couche recommandé selon la base de la couleur
 */
export function determinerTypeSousCouche(base: string): 'blanche' | 'grise' {
  const b = base.toUpperCase();
  return (b === 'C') ? 'grise' : 'blanche';
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
    // Voie de sélection unique (contenance + finition + gamme) partagée avec la
    // table de prix de l'optimiseur et le mapping panier : le prix affiché ne
    // peut pas diverger du produit commandé.
    const variant = selectionnerVariantContenance(variants, c.contenance, finition);
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

    // Composition la moins chère couvrant le besoin (repli glouton sans prix)
    const { contenants, justification } = optimiserContenantsParPrix(
      litresNecessaires,
      contenancesDisponibles,
      variants,
      s.couleur.finition
    );
    return {
      couleur: s.couleur,
      surfaceTotale: s.surfaceTotale,
      litresNecessaires,
      litresCommandes: calculerLitresCommandes(contenants),
      contenants,
      prixTotal: calculerPrixTotal(contenants, variants, s.couleur.finition),
      justification,
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

    // Même optimisation par le prix que les peintures (sans finition)
    const { contenants, justification } = optimiserContenantsParPrix(
      litresNecessaires,
      contenancesDisponibles,
      variants
    );
    sousCouches.push({
      type,
      handle,
      surfaceTotale: surface,
      litresNecessaires,
      litresCommandes: calculerLitresCommandes(contenants),
      contenants,
      prixTotal: calculerPrixTotal(contenants, variants),
      justification,
    });
  });

  // 3. Calcul de la surface totale et du kit
  const surfaceTotale = pieces.reduce((sum, p) => {
    const surfaceMurs = p.murs.reduce((total, mur) => total + mur.surface, 0);
    return sum + surfaceMurs + (p.surfacePlafond || 0) + (p.surfaceBoiseries || 0);
  }, 0);

  const kitType = surfaceTotale <= SEUIL_SURFACE_KIT ? 'petite' : 'grande';
  const kitHandle = surfaceTotale <= SEUIL_SURFACE_KIT ? KIT_HANDLES.petiteSurface : KIT_HANDLES.grandeSurface;
  const kitVariant = selectionnerVariantKit<any>(shopifyData?.[kitHandle]?.variants);
  const kitPrix = kitVariant ? parseFloat(kitVariant.price.amount || kitVariant.price) : 0;
  
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
 * (exportée pour les tests : la clé d'agrégation productHandle+finition est
 * un invariant critique — deux finitions d'un même produit ne doivent JAMAIS
 * être fusionnées, leurs prix diffèrent)
 */
export function agregerSurfacesParCouleur(pieces: Piece[]): SurfaceParCouleur[] {
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
