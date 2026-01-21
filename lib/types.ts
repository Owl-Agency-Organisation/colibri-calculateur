/**
 * Types TypeScript pour l'application Colibri Assurances
 */

// ========== ASSURÉ ==========
export interface Assure {
  civilite: 'M' | 'Mme';
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
}

// ========== PIÈCE ==========
export type TypePiece =
  | 'piece-de-vie'
  | 'chambre'
  | 'cuisine'
  | 'salle-de-bain'
  | 'toilettes'
  | 'entree'
  | 'couloir';

export interface Piece {
  id: string;
  typePiece: TypePiece;
  nom: string;
  surfaceMurs: number;
  surfacePlafond?: number;
  surfaceBoiseries?: number;
  couleurMurs: Couleur;
  couleurPlafond?: Couleur;
  couleurBoiseries?: Couleur;
}

// ========== SURFACE ==========
export type Finition = 'mat' | 'velours' | 'satin';
export type Gamme = 'biosourcee' | 'biosourcee-depolluante';

export interface Surface {
  id: string;
  type: 'plafond' | 'mur';
  superficie: number;
  couleur: Couleur;
  finition: Finition;
  gamme: Gamme;
}

// ========== COULEUR ==========
export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  availableForSale: boolean;
}

export interface Couleur {
  productId: string;
  productHandle: string;
  titre: string;
  collection: string;
  base: 'Blanc' | 'BLC' | 'B' | 'C';
  sousCouche: 'grise' | 'blanche';
  codeHex: string;
  imageUrl: string;
  variants?: ShopifyVariant[];
}

// ========== CALCUL ==========
export interface Calcul {
  peintures: PeintureCalculee[];
  sousCouches: SousCoucheCalculee[];
  kit: Kit;
  options: Option[];
}

export interface PeintureCalculee {
  productId: string;
  titre: string;
  finition: Finition;
  gamme: Gamme;
  quantiteTotale: number;
  contenants: Contenant[];
}

export interface Contenant {
  variantId: string;
  sku: string;
  contenance: '1L' | '3L' | '12L';
  quantite: number;
  prix: number;
}

export interface SousCoucheCalculee {
  type: 'grise' | 'blanche';
  productId: string;
  titre: string;
  quantiteTotale: number;
  contenants: Contenant[];
}

export interface Kit {
  productId: string;
  titre: string;
  prix: number;
}

export interface Option {
  titre: string;
  selectionne: boolean;
  produits: ProduitOption[];
}

export interface ProduitOption {
  variantId: string;
  titre: string;
  quantite: number;
  prix: number;
}