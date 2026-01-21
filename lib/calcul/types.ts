/**
 * Types et interfaces pour le système de calcul de peinture Colibri
 * 
 * @module lib/calcul/types
 * @author Owl Agency
 * @version 2.0.0
 */

/**
 * Type de surface à peindre
 */
export type TypeSurface = 'plafond' | 'mur' | 'boiserie';

/**
 * Type de pièce (détermine la finition recommandée)
 */
export type TypePiece = 'vie' | 'chambre' | 'cuisine' | 'sdb' | 'wc' | 'couloir' | 'entree';

/**
 * Finition de peinture disponible
 */
export type Finition = 'Mat' | 'Velours' | 'Satin';

/**
 * Gamme de peinture disponible
 */
export type Gamme = 'Biosourcée' | 'Biosourcée et dépolluante';

/**
 * Contenance de pot disponible (en litres)
 */
export type Contenance = '1L' | '3L' | '12L';

/**
 * Type de peinture (sous-couche ou finition)
 */
export type TypePeinture = 'sous-couche' | 'finition';

/**
 * Informations sur une surface à peindre
 */
export interface Surface {
  /** Type de surface (plafond, mur, boiserie) */
  type: TypeSurface;
  /** Surface en m² */
  surface: number;
  /** Handle du produit Shopify sélectionné */
  productHandle: string;
  /** Titre de la couleur pour affichage */
  couleurTitre: string;
  /** Gamme de peinture sélectionnée */
  gamme: Gamme;
  /** Finition sélectionnée */
  finition: Finition;
}

/**
 * Informations sur une pièce
 */
export interface Piece {
  /** Type de pièce */
  type: TypePiece;
  /** Nom personnalisé de la pièce */
  nom: string;
  /** Surfaces de la pièce */
  surfaces: Surface[];
}

/**
 * Variant Shopify simplifié pour le calcul
 */
export interface ShopifyVariant {
  /** ID Shopify du variant */
  id: string;
  /** Titre du variant (ex: "Biosourcée / Mat / 3L") */
  title: string;
  /** SKU du variant */
  sku: string | null;
  /** Disponible à la vente */
  availableForSale: boolean;
  /** Quantité disponible en stock */
  quantityAvailable: number;
  /** Prix du variant */
  price: {
    amount: string;
    currencyCode: string;
  };
  /** Options sélectionnées (Gamme, Finition, Contenance) */
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Contenants disponibles pour un produit
 */
export interface ContenantsDisponibles {
  /** Handle du produit Shopify */
  productHandle: string;
  /** Liste des contenances disponibles */
  contenances: Array<{
    /** Contenance (1L, 3L, 12L) */
    contenance: Contenance;
    /** Litres correspondants */
    litres: number;
    /** ID du variant Shopify */
    variantId: string;
    /** Prix */
    price: number;
    /** Disponible en stock */
    availableForSale: boolean;
  }>;
}

/**
 * Résultat du calcul pour un contenant
 */
export interface CalculContenant {
  /** Contenance du pot */
  contenance: Contenance;
  /** Nombre de pots nécessaires */
  quantite: number;
  /** Litres totaux (quantite × litres par pot) */
  litres: number;
  /** ID du variant Shopify */
  variantId: string;
  /** Prix unitaire */
  prixUnitaire: number;
  /** Prix total (quantite × prixUnitaire) */
  prixTotal: number;
}

/**
 * Résultat du calcul de peinture pour une couleur
 */
export interface CalculPeinture {
  /** Handle du produit Shopify */
  productHandle: string;
  /** Titre de la couleur */
  couleurTitre: string;
  /** Gamme sélectionnée */
  gamme: Gamme;
  /** Finition sélectionnée */
  finition: Finition;
  /** Type de peinture (sous-couche ou finition) */
  typePeinture: TypePeinture;
  /** Surface totale à peindre (m²) */
  surfaceTotale: number;
  /** Nombre de couches à appliquer */
  nombreCouches: number;
  /** Litres bruts calculés (avant marge) */
  litresBruts: number;
  /** Litres avec marge de sécurité 5% */
  litresAvecMarge: number;
  /** Litres arrondis selon règle x,5 */
  litresArrondis: number;
  /** Contenants optimisés */
  contenants: CalculContenant[];
  /** Prix total de cette couleur */
  prixTotal: number;
}

/**
 * Résultat complet du calcul pour toutes les pièces
 */
export interface ResultatCalcul {
  /** Calculs pour les sous-couches */
  sousCouches: CalculPeinture[];
  /** Calculs pour les peintures de finition */
  finitions: CalculPeinture[];
  /** Surface totale de toutes les pièces (m²) */
  surfaceTotaleGlobale: number;
  /** Litres totaux nécessaires (tous produits confondus) */
  litresTotaux: number;
  /** Prix total de toutes les peintures */
  prixTotal: number;
  /** Détails par pièce */
  detailsPieces: Array<{
    piece: Piece;
    surfaceTotale: number;
  }>;
}
