/**
 * Système de calcul de peinture Colibri - Version 2.0.0
 * 
 * @module lib/calcul
 * @author Owl Agency
 * @version 2.0.0
 * @description
 * Système complet de calcul de quantités de peinture pour le projet Colibri Assurances.
 * 
 * Fonctionnalités :
 * - Calcul précis des litres nécessaires (rendement 10 m²/L/couche)
 * - Marge de sécurité de 5%
 * - Arrondi intelligent selon règle x,5
 * - Optimisation des contenants (12L > 3L > 1L)
 * - Interrogation dynamique des variants Shopify
 * - Calcul des prix par produit et total
 * 
 * @see README.md pour la documentation complète
 */

import {
  Piece,
  Surface,
  ResultatCalcul,
  CalculPeinture,
  CalculContenant,
  ContenantsDisponibles,
  ShopifyVariant,
  Gamme,
  Finition,
  Contenance,
  TypePeinture,
} from './types';

import {
  RENDEMENT_PEINTURE,
  NOMBRE_COUCHES_SOUS_COUCHE,
  NOMBRE_COUCHES_FINITION,
  MARGE_SECURITE,
  CONTENANCES_DISPONIBLES,
  SEUIL_ARRONDI,
  SOUS_COUCHE_BLANCHE_HANDLE,
  SOUS_COUCHE_GRISE_HANDLE,
  COULEURS_SCHMIDT_SOUS_COUCHE_GRISE,
} from './constants';

// ==============================================================================
// FONCTIONS UTILITAIRES
// ==============================================================================

/**
 * Extrait le code couleur Schmidt depuis le handle du produit
 * 
 * @param productHandle - Handle du produit Shopify (ex: "schmidt-navy-peinture-biosourcee")
 * @returns Code Schmidt (ex: "S16") ou null si non Schmidt
 * 
 * @example
 * extraireCodeSchmidt("schmidt-navy-peinture-biosourcee") // → "S16"
 * extraireCodeSchmidt("blanc-vrai-peinture-biosourcee") // → null
 */
function extraireCodeSchmidt(productHandle: string): string | null {
  const match = productHandle.match(/schmidt-([^-]+)/i);
  if (!match) return null;
  
  // Chercher le code S + numéro dans la chaîne
  const codeMatch = productHandle.match(/S\d+/i);
  return codeMatch ? codeMatch[0].toUpperCase() : null;
}

/**
 * Détermine si une couleur Schmidt nécessite une sous-couche grise
 * 
 * @param productHandle - Handle du produit Shopify
 * @returns true si sous-couche grise nécessaire, false sinon
 * 
 * @see COULEURS_SCHMIDT_SOUS_COUCHE_GRISE
 */
export function necessiteSousCoucheGrise(productHandle: string): boolean {
  const codeSchmidt = extraireCodeSchmidt(productHandle);
  if (!codeSchmidt) return false;
  
  return COULEURS_SCHMIDT_SOUS_COUCHE_GRISE.includes(codeSchmidt);
}

// ==============================================================================
// INTERROGATION SHOPIFY
// ==============================================================================

/**
 * Récupère les variants disponibles pour un produit depuis Shopify
 * 
 * @param productHandle - Handle du produit Shopify
 * @returns Liste des variants du produit
 * @throws Error si le produit n'existe pas ou si l'API Shopify échoue
 * 
 * @remarks
 * Cette fonction fait un appel à l'API Shopify Storefront.
 * En production, ajouter un système de cache pour limiter les appels API.
 */
async function getVariantsShopify(productHandle: string): Promise<ShopifyVariant[]> {
  try {
    // TODO: Remplacer par l'appel réel à votre API Shopify
    const response = await fetch(`/api/shopify/products/${productHandle}/variants`);
    
    if (!response.ok) {
      throw new Error(`Erreur Shopify API : ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.variants || [];
  } catch (error) {
    console.error(`[Calcul] Erreur récupération variants pour ${productHandle}:`, error);
    throw new Error(`Impossible de récupérer les variants du produit ${productHandle}`);
  }
}

/**
 * Extrait les contenants disponibles depuis les variants Shopify
 * 
 * @param productHandle - Handle du produit Shopify
 * @param gamme - Gamme souhaitée ("Biosourcée" ou "Biosourcée et dépolluante")
 * @param finition - Finition souhaitée ("Mat", "Velours", "Satin") - optionnel pour sous-couche
 * @returns Contenants disponibles triés par taille décroissante
 * 
 * @example
 * const contenants = await getContenantsDisponibles(
 *   "blanc-vrai-peinture-biosourcee",
 *   "Biosourcée",
 *   "Mat"
 * );
 * // → [{ contenance: "12L", litres: 12, variantId: "...", price: 199.9, ... }, ...]
 */
export async function getContenantsDisponibles(
  productHandle: string,
  gamme: Gamme,
  finition?: Finition
): Promise<ContenantsDisponibles> {
  const variants = await getVariantsShopify(productHandle);
  
  const contenances = CONTENANCES_DISPONIBLES
    .map(({ contenance, litres }) => {
      // Filtrer les variants correspondant à la gamme, finition et contenance
      const variant = variants.find((v) => {
        const gammeMatch = v.selectedOptions.find(
          (opt) => opt.name === 'Gamme' && opt.value === gamme
        );
        
        const finitionMatch = finition
          ? v.selectedOptions.find(
              (opt) => opt.name === 'Finition' && opt.value === finition
            )
          : true; // Pour sous-couche, pas de finition
        
        const contenanceMatch = v.selectedOptions.find(
          (opt) => opt.name === 'Contenance' && opt.value === contenance
        );
        
        return gammeMatch && finitionMatch && contenanceMatch;
      });
      
      if (!variant) return null;
      
      return {
        contenance,
        litres,
        variantId: variant.id,
        price: parseFloat(variant.price.amount),
        availableForSale: variant.availableForSale,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .filter((c) => c.availableForSale); // Filtrer les variants disponibles uniquement
  
  return {
    productHandle,
    contenances,
  };
}

// ==============================================================================
// CALCUL DES QUANTITÉS
// ==============================================================================

/**
 * Calcule les litres de peinture nécessaires pour une surface donnée
 * 
 * @param surface - Surface à peindre (en m²)
 * @param nombreCouches - Nombre de couches à appliquer
 * @returns Litres nécessaires arrondis selon règle x,5
 * 
 * @description
 * Algorithme de calcul :
 * 1. Calcul brut : (surface / rendement) × nombreCouches
 * 2. Marge de sécurité : litresBruts × (1 + 5%)
 * 3. Arrondi selon règle x,5 :
 *    - Si décimale < 0,5 → arrondir au litre inférieur
 *    - Si décimale >= 0,5 → arrondir au litre supérieur
 * 
 * @example
 * // Calcul pour 55 m² avec 2 couches
 * calculerLitresNecessaires(55, 2);
 * // → Brut : (55 / 10) × 2 = 11 L
 * // → Marge : 11 × 1,05 = 11,55 L
 * // → Arrondi : 12 L (0,55 >= 0,5)
 * 
 * @example
 * // Calcul pour 54 m² avec 2 couches
 * calculerLitresNecessaires(54, 2);
 * // → Brut : (54 / 10) × 2 = 10,8 L
 * // → Marge : 10,8 × 1,05 = 11,34 L
 * // → Arrondi : 11 L (0,34 < 0,5)
 */
export function calculerLitresNecessaires(
  surface: number,
  nombreCouches: number
): {
  litresBruts: number;
  litresAvecMarge: number;
  litresArrondis: number;
} {
  // Étape 1 : Calcul brut
  // Formule : (surface en m² / rendement en m²/L/couche) × nombre de couches
  const litresBruts = (surface / RENDEMENT_PEINTURE) * nombreCouches;
  
  // Étape 2 : Application marge de sécurité 5%
  const litresAvecMarge = litresBruts * (1 + MARGE_SECURITE);
  
  // Étape 3 : Arrondi selon règle x,5
  const partieEntiere = Math.floor(litresAvecMarge);
  const decimale = litresAvecMarge - partieEntiere;
  
  const litresArrondis =
    decimale < SEUIL_ARRONDI
      ? partieEntiere // Arrondir au litre inférieur
      : partieEntiere + 1; // Arrondir au litre supérieur
  
  return {
    litresBruts: Math.round(litresBruts * 100) / 100, // 2 décimales
    litresAvecMarge: Math.round(litresAvecMarge * 100) / 100, // 2 décimales
    litresArrondis,
  };
}

/**
 * Optimise la répartition des contenants selon l'algorithme glouton
 * 
 * @param litresNecessaires - Litres de peinture nécessaires (déjà arrondis)
 * @param contenantsDisponibles - Contenants disponibles pour ce produit
 * @returns Liste des contenants optimisés avec quantités et prix
 * 
 * @description
 * Algorithme glouton (greedy algorithm) :
 * 1. Remplir avec le plus grand contenant tant que possible (12L)
 * 2. Remplir avec le contenant moyen tant que possible (3L)
 * 3. Compléter avec le plus petit contenant (1L)
 * 
 * @remarks
 * L'algorithme glouton ne donne pas toujours le coût optimal, mais il minimise
 * le nombre de pots, ce qui est plus pratique pour l'utilisateur.
 * 
 * @example
 * // Pour 11 L
 * optimiserContenants(11, contenants);
 * // → 3×3L (9L) + 2×1L (2L) = 11L avec 5 pots
 * 
 * // Pour 12 L
 * optimiserContenants(12, contenants);
 * // → 1×12L = 12L avec 1 pot (optimal)
 */
export function optimiserContenants(
  litresNecessaires: number,
  contenantsDisponibles: ContenantsDisponibles
): CalculContenant[] {
  const contenants: CalculContenant[] = [];
  let litresRestants = litresNecessaires;
  
  // Algorithme glouton : du plus grand au plus petit
  for (const contenant of contenantsDisponibles.contenances) {
    if (litresRestants <= 0) break;
    
    const quantite = Math.floor(litresRestants / contenant.litres);
    
    if (quantite > 0) {
      contenants.push({
        contenance: contenant.contenance,
        quantite,
        litres: quantite * contenant.litres,
        variantId: contenant.variantId,
        prixUnitaire: contenant.price,
        prixTotal: quantite * contenant.price,
      });
      
      litresRestants -= quantite * contenant.litres;
    }
  }
  
  // S'il reste des litres (< 1L), ajouter 1 pot de 1L
  if (litresRestants > 0) {
    const pot1L = contenantsDisponibles.contenances.find(
      (c) => c.contenance === '1L'
    );
    
    if (pot1L) {
      const existant1L = contenants.find((c) => c.contenance === '1L');
      
      if (existant1L) {
        existant1L.quantite += 1;
        existant1L.litres += 1;
        existant1L.prixTotal += pot1L.price;
      } else {
        contenants.push({
          contenance: '1L',
          quantite: 1,
          litres: 1,
          variantId: pot1L.variantId,
          prixUnitaire: pot1L.price,
          prixTotal: pot1L.price,
        });
      }
    }
  }
  
  // Trier par taille décroissante pour l'affichage (12L > 3L > 1L)
  return contenants.sort((a, b) => {
    const ordre = { '12L': 0, '3L': 1, '1L': 2 };
    return ordre[a.contenance] - ordre[b.contenance];
  });
}

// ==============================================================================
// CALCUL PRINCIPAL
// ==============================================================================

/**
 * Calcule les quantités de peinture pour toutes les pièces
 * 
 * @param pieces - Liste des pièces avec leurs surfaces
 * @returns Résultat complet du calcul (sous-couches, finitions, prix total)
 * 
 * @description
 * Processus de calcul :
 * 1. Agréger les surfaces par couleur (productHandle + gamme + finition)
 * 2. Déterminer le type de sous-couche nécessaire (blanche ou grise Schmidt)
 * 3. Calculer les litres nécessaires pour chaque couleur
 * 4. Récupérer les variants disponibles depuis Shopify
 * 5. Optimiser les contenants
 * 6. Calculer les prix totaux
 * 
 * @example
 * const pieces = [
 *   {
 *     type: 'chambre',
 *     nom: 'Chambre parentale',
 *     surfaces: [
 *       { type: 'plafond', surface: 20, productHandle: 'blanc-vrai-...', ... },
 *       { type: 'mur', surface: 45, productHandle: 'schmidt-navy-...', ... },
 *     ],
 *   },
 * ];
 * 
 * const resultat = await calculerQuantitesPeinture(pieces);
 * // → { sousCouches: [...], finitions: [...], prixTotal: 450.80, ... }
 */
export async function calculerQuantitesPeinture(
  pieces: Piece[]
): Promise<ResultatCalcul> {
  // ===========================================================================
  // ÉTAPE 1 : AGRÉGER LES SURFACES PAR COULEUR
  // ===========================================================================
  
  const surfacesParCouleur = new Map<string, Surface[]>();
  
  for (const piece of pieces) {
    for (const surface of piece.surfaces) {
      // Clé unique : productHandle + gamme + finition
      const cle = `${surface.productHandle}|${surface.gamme}|${surface.finition}`;
      
      if (!surfacesParCouleur.has(cle)) {
        surfacesParCouleur.set(cle, []);
      }
      
      surfacesParCouleur.get(cle)!.push(surface);
    }
  }
  
  // ===========================================================================
  // ÉTAPE 2 : DÉTERMINER LES SOUS-COUCHES NÉCESSAIRES
  // ===========================================================================
  
  const sousCouchesNecessaires = new Map<string, number>(); // handle → surface totale
  
  for (const [cle, surfaces] of surfacesParCouleur.entries()) {
    const [productHandle] = cle.split('|');
    const surfaceTotale = surfaces.reduce((sum, s) => sum + s.surface, 0);
    
    // Déterminer le type de sous-couche
    const sousCoucheHandle = necessiteSousCoucheGrise(productHandle)
      ? SOUS_COUCHE_GRISE_HANDLE
      : SOUS_COUCHE_BLANCHE_HANDLE;
    
    // Ajouter ou cumuler la surface pour cette sous-couche
    const surfaceActuelle = sousCouchesNecessaires.get(sousCoucheHandle) || 0;
    sousCouchesNecessaires.set(sousCoucheHandle, surfaceActuelle + surfaceTotale);
  }
  
  // ===========================================================================
  // ÉTAPE 3 : CALCULER LES SOUS-COUCHES
  // ===========================================================================
  
  const calculsSousCouches: CalculPeinture[] = [];
  
  for (const [sousCoucheHandle, surfaceTotale] of sousCouchesNecessaires.entries()) {
    const { litresBruts, litresAvecMarge, litresArrondis } =
      calculerLitresNecessaires(surfaceTotale, NOMBRE_COUCHES_SOUS_COUCHE);
    
    // Récupérer les contenants disponibles (pas de gamme/finition pour sous-couche)
    const contenantsDisponibles = await getContenantsDisponibles(
      sousCoucheHandle,
      'Biosourcée' // Sous-couches uniquement en Biosourcée
    );
    
    const contenants = optimiserContenants(litresArrondis, contenantsDisponibles);
    
    const prixTotal = contenants.reduce((sum, c) => sum + c.prixTotal, 0);
    
    calculsSousCouches.push({
      productHandle: sousCoucheHandle,
      couleurTitre: sousCoucheHandle.includes('grise') ? 'Sous-couche grise' : 'Sous-couche blanche',
      gamme: 'Biosourcée',
      finition: 'Mat', // Les sous-couches sont toujours mates
      typePeinture: 'sous-couche',
      surfaceTotale,
      nombreCouches: NOMBRE_COUCHES_SOUS_COUCHE,
      litresBruts,
      litresAvecMarge,
      litresArrondis,
      contenants,
      prixTotal,
    });
  }
  
  // ===========================================================================
  // ÉTAPE 4 : CALCULER LES PEINTURES DE FINITION
  // ===========================================================================
  
  const calculsFinitions: CalculPeinture[] = [];
  
  for (const [cle, surfaces] of surfacesParCouleur.entries()) {
    const [productHandle, gamme, finition] = cle.split('|') as [string, Gamme, Finition];
    
    const surfaceTotale = surfaces.reduce((sum, s) => sum + s.surface, 0);
    const couleurTitre = surfaces[0].couleurTitre;
    
    const { litresBruts, litresAvecMarge, litresArrondis } =
      calculerLitresNecessaires(surfaceTotale, NOMBRE_COUCHES_FINITION);
    
    // Récupérer les contenants disponibles avec gamme et finition
    const contenantsDisponibles = await getContenantsDisponibles(
      productHandle,
      gamme,
      finition
    );
    
    const contenants = optimiserContenants(litresArrondis, contenantsDisponibles);
    
    const prixTotal = contenants.reduce((sum, c) => sum + c.prixTotal, 0);
    
    calculsFinitions.push({
      productHandle,
      couleurTitre,
      gamme,
      finition,
      typePeinture: 'finition',
      surfaceTotale,
      nombreCouches: NOMBRE_COUCHES_FINITION,
      litresBruts,
      litresAvecMarge,
      litresArrondis,
      contenants,
      prixTotal,
    });
  }
  
  // ===========================================================================
  // ÉTAPE 5 : CALCULER LES TOTAUX
  // ===========================================================================
  
  const surfaceTotaleGlobale = pieces.reduce(
    (sum, piece) =>
      sum + piece.surfaces.reduce((s, surface) => s + surface.surface, 0),
    0
  );
  
  const litresTotaux =
    calculsSousCouches.reduce((sum, c) => sum + c.litresArrondis, 0) +
    calculsFinitions.reduce((sum, c) => sum + c.litresArrondis, 0);
  
  const prixTotal =
    calculsSousCouches.reduce((sum, c) => sum + c.prixTotal, 0) +
    calculsFinitions.reduce((sum, c) => sum + c.prixTotal, 0);
  
  const detailsPieces = pieces.map((piece) => ({
    piece,
    surfaceTotale: piece.surfaces.reduce((sum, s) => sum + s.surface, 0),
  }));
  
  // ===========================================================================
  // RÉSULTAT FINAL
  // ===========================================================================
  
  return {
    sousCouches: calculsSousCouches,
    finitions: calculsFinitions,
    surfaceTotaleGlobale,
    litresTotaux,
    prixTotal: Math.round(prixTotal * 100) / 100, // Arrondir à 2 décimales
    detailsPieces,
  };
}
