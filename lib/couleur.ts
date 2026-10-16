import type { Couleur, ShopifyVariant } from '@/lib/types';

/**
 * Construction d'une `Couleur` à partir d'un handle de teinte et d'une
 * finition cible. Logique extraite telle quelle de la popup couleur
 * (CouleurModal, sélection d'un produit), partagée avec l'arrivée depuis le
 * simulateur et le bloc « Vos teintes essayées ».
 */

interface OptionSelectionnee {
  name: string;
  value: string;
}

export interface VarianteDetail extends ShopifyVariant {
  selectedOptions?: OptionSelectionnee[];
}

/** Réponse de `/api/shopify/product/{handle}` (champs utilisés) */
export interface DetailProduit {
  id: string;
  handle: string;
  title: string;
  images?: { edges: { node: { url: string } }[] };
  variants?: VarianteDetail[];
  base?: string | null;
  sousCouche?: string | null;
  codeHex?: string | null;
}

/** Identité du produit telle qu'affichée là où il a été choisi */
export interface ProduitChoisi {
  id: string;
  handle: string;
  title: string;
  imageUrl: string;
}

const BASES: readonly Couleur['base'][] = ['Blanc', 'BLC', 'B', 'C'];

function normaliserBase(valeur: string | null | undefined): Couleur['base'] {
  if (!valeur) return 'Blanc';
  return BASES.find((base) => base.toUpperCase() === valeur.toUpperCase()) ?? 'Blanc';
}

function normaliserSousCouche(valeur: string | null | undefined): Couleur['sousCouche'] {
  return valeur?.toLowerCase() === 'grise' ? 'grise' : 'blanche';
}

function valeurFinition(variante: VarianteDetail): string | undefined {
  return variante.selectedOptions?.find((opt) => opt.name.toLowerCase() === 'finition')?.value;
}

/**
 * Finition retenue — source de vérité unique : l'option « Finition » des
 * variantes Shopify. 1. variante correspondant exactement à la finition cible ;
 * 2. à défaut, finition de la première variante qui en porte une.
 */
export function choisirFinition(
  variantes: readonly VarianteDetail[] | undefined,
  targetFinition: string | undefined,
): string | undefined {
  if (!variantes || variantes.length === 0) return undefined;
  const correspondante = variantes.find((v) =>
    v.selectedOptions?.some((opt) =>
      opt.name.toLowerCase() === 'finition' &&
      opt.value.toLowerCase() === targetFinition?.toLowerCase()
    )
  );
  if (correspondante) return valeurFinition(correspondante);
  const premiere = variantes.find((v) => valeurFinition(v) !== undefined);
  return premiere ? valeurFinition(premiere) : undefined;
}

export function construireCouleur(
  detail: DetailProduit,
  options: { targetFinition?: string; collection?: string; produit?: ProduitChoisi },
): Couleur {
  const produit: ProduitChoisi = options.produit ?? {
    id: detail.id,
    handle: detail.handle,
    title: detail.title,
    imageUrl: detail.images?.edges[0]?.node.url || '',
  };
  return {
    productId: produit.id,
    productHandle: produit.handle,
    titre: produit.title,
    collection: options.collection || '',
    base: normaliserBase(detail.base),
    sousCouche: normaliserSousCouche(detail.sousCouche),
    codeHex: detail.codeHex || '#FFFFFF',
    finition: choisirFinition(detail.variants, options.targetFinition),
    imageUrl: produit.imageUrl,
    variants: detail.variants || [],
  };
}

/**
 * Nom court d'une teinte : partie du titre avant « - » (ex. « Deguesde -
 * Peinture biosourcée murs et plafonds » → « Deguesde »). Même règle que les
 * pastilles de la barre du simulateur (embed/colibri.js).
 */
export function nomCourtTeinte(titre: string): string {
  return titre.split(/\s+[-–—]\s+/)[0].trim() || titre.trim();
}

/** Erreur réseau ou serveur (≠ teinte inconnue de la boutique) */
export class ErreurChargementCouleur extends Error {}

/**
 * Charge une teinte de la boutique et construit sa `Couleur`.
 * Handle inconnu de la boutique : ignoré (null) et signalé en console.
 */
export async function chargerCouleur(
  handle: string,
  options: { targetFinition?: string; collection?: string; produit?: ProduitChoisi } = {},
): Promise<Couleur | null> {
  const response = await fetch(`/api/shopify/product/${encodeURIComponent(handle)}`);
  if (response.status === 404) {
    console.warn(`Teinte inconnue de la boutique, ignorée : ${handle}`);
    return null;
  }
  if (!response.ok) throw new ErreurChargementCouleur('Erreur lors du chargement du produit');
  const detail: DetailProduit = await response.json();
  return construireCouleur(detail, options);
}

/**
 * Charge plusieurs teintes en parallèle, dans l'ordre ; les inconnues et
 * celles en erreur sont écartées (signalées en console).
 */
export async function chargerCouleurs(
  handles: readonly string[],
  options: { targetFinition?: string } = {},
): Promise<Couleur[]> {
  const resultats = await Promise.all(
    handles.map((handle) =>
      chargerCouleur(handle, options).catch((err: unknown) => {
        console.error(`Impossible de charger la teinte ${handle}`, err);
        return null;
      })
    )
  );
  return resultats.filter((couleur): couleur is Couleur => couleur !== null);
}
