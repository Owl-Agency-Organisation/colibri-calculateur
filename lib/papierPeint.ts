import { nomCourtTeinte } from '@/lib/couleur';
import { estHandleTeinte } from '@/lib/embed-messages';
import { PARENT_ORIGIN } from '@/lib/navigation';

/**
 * Papiers peints essayés dans le simulateur (décision du 21/10/2026).
 *
 * Référence Wizart d'un papier peint = SKU Shopify de sa variante « Lé »
 * (ex. `pp-montg-terracotta-le`) : une référence reçue du simulateur est soit
 * un handle de teinte, soit un SKU de variante papier peint. La résolution
 * d'un SKU se fait côté serveur, dans le catalogue des papiers peints lu dans
 * l'Admin API et gardé en cache (`lib/shopify-papiers-peints.ts`) : la
 * Storefront API ne filtre pas les produits par SKU.
 *
 * Un papier peint ne se calcule pas : il s'affiche avec un lien vers sa fiche
 * boutique, où le client le commande. Aucun prix ici.
 */

export interface PapierPeint {
  /** SKU de la variante (référence Wizart) */
  sku: string;
  /** Handle du produit Shopify */
  handle: string;
  /** Titre du produit Shopify */
  titre: string;
  /** Nom du motif : partie du titre avant « - » (« Montgolfières ») */
  motif: string;
  /** Option « Couleur » de la variante (« Terracotta », « Rayures bleues ») */
  coloris: string;
  /** Image de la variante (à défaut, image principale du produit) */
  imageUrl: string | null;
  /** GID de la variante (`gid://shopify/ProductVariant/…`) */
  variantId: string;
  /** Fiche boutique sur la variante : `…/products/{handle}?variant={id}` */
  lien: string;
}

/** Variante telle que lue dans l'Admin API (champs utilisés) */
export interface VariantePapierPeintAdmin {
  id: string;
  legacyResourceId: string;
  sku: string | null;
  selectedOptions: { name: string; value: string }[];
  image: { url: string } | null;
  product: {
    handle: string;
    title: string;
    productType: string;
    featuredImage: { url: string } | null;
  };
}

/** `productType` des papiers peints de la boutique (« Papier peint ») */
export function estTypePapierPeint(productType: string | null | undefined): boolean {
  return typeof productType === 'string' && /^\s*papiers?[\s-]+peints?\s*$/i.test(productType);
}

/** Fiche boutique d'une variante. */
export function lienFichePapierPeint(handle: string, idVariante: string): string {
  return `${PARENT_ORIGIN}/products/${encodeURIComponent(handle)}?variant=${encodeURIComponent(idVariante)}`;
}

/**
 * Libellé d'un papier peint : « {Motif}{séparateur}{Coloris} », sans répéter
 * le motif quand le coloris le contient déjà (« Rayures bleues »,
 * « Ombrelle bleu nuit »).
 */
export function libellePapierPeint(motif: string, coloris: string, separateur = ', '): string {
  if (!coloris) return motif;
  if (!motif || coloris.toLowerCase().startsWith(motif.toLowerCase())) return coloris;
  return `${motif}${separateur}${coloris}`;
}

function valeurOption(options: readonly { name: string; value: string }[], nom: string): string | null {
  return options.find((option) => option.name.trim().toLowerCase() === nom)?.value.trim() || null;
}

/**
 * Papier peint à partir d'une variante et de son SKU. Null si la variante est
 * absente, si son SKU ne correspond pas exactement ou si son produit n'est
 * pas un papier peint.
 */
export function versPapierPeint(sku: string, variante: VariantePapierPeintAdmin | null | undefined): PapierPeint | null {
  if (!variante || variante.sku?.trim().toLowerCase() !== sku) return null;
  if (!estTypePapierPeint(variante.product.productType)) return null;
  const { product } = variante;
  return {
    sku,
    handle: product.handle,
    titre: product.title,
    motif: nomCourtTeinte(product.title),
    coloris: valeurOption(variante.selectedOptions, 'couleur') ?? '',
    imageUrl: variante.image?.url || product.featuredImage?.url || null,
    variantId: variante.id,
    lien: lienFichePapierPeint(product.handle, variante.legacyResourceId),
  };
}

/** Produit papier peint tel que lu dans l'Admin API, avec ses variantes */
export interface ProduitPapierPeintAdmin {
  handle: string;
  title: string;
  productType: string;
  featuredImage: { url: string } | null;
  variants: { nodes: Omit<VariantePapierPeintAdmin, 'product'>[] };
}

/**
 * Requête Admin du catalogue des papiers peints : tous les produits de type
 * « Papier peint » et leurs variantes, en une fois (paginée par curseur).
 * Aucune valeur reçue de l'extérieur n'y entre : une référence inconnue ne
 * déclenche jamais de requête.
 */
export const REQUETE_CATALOGUE_PAPIERS_PEINTS = `query CataloguePapiersPeints($after: String) {
  products(first: 50, after: $after, query: "product_type:'Papier peint'") {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle title productType featuredImage { url }
      variants(first: 100) {
        nodes { id legacyResourceId sku selectedOptions { name value } image { url } }
      }
    }
  }
}`;

/**
 * Table SKU → papier peint du catalogue (toutes les variantes portant un
 * SKU). Les produits qui ne sont pas des papiers peints sont écartés
 * (`versPapierPeint`) ; à SKU en double, la première variante l'emporte.
 */
export function cataloguePapiersPeints(produits: readonly ProduitPapierPeintAdmin[]): Map<string, PapierPeint> {
  const table = new Map<string, PapierPeint>();
  for (const { variants, ...product } of produits) {
    for (const variante of variants.nodes) {
      const sku = variante.sku?.trim().toLowerCase();
      if (!sku || table.has(sku)) continue;
      const papier = versPapierPeint(sku, { ...variante, product });
      if (papier) table.set(sku, papier);
    }
  }
  return table;
}

/** Libellé accessible de « Voir la fiche » (la fiche s'ouvre dans un nouvel onglet). */
export const LIBELLE_VOIR_FICHE = 'Voir la fiche (nouvel onglet)';

/**
 * Ouvre la fiche boutique dans un nouvel onglet : l'app tourne dans une
 * iframe, et quitter la page ferait perdre la saisie en cours (page Surfaces).
 */
export function ouvrirFichePapierPeint(lien: string): void {
  window.open(lien, '_blank', 'noopener');
}

/** Erreur réseau ou serveur (≠ papier peint inconnu de la boutique) */
export class ErreurChargementPapierPeint extends Error {}

/**
 * Charge un papier peint par son SKU (route serveur de l'app). SKU inconnu
 * de la boutique : ignoré (null) et signalé en console.
 */
export async function chargerPapierPeint(
  sku: string,
  options: { /** false : pas d'avertissement si inconnu (l'appelant le signale) */ signalerInconnu?: boolean } = {},
): Promise<PapierPeint | null> {
  if (!estHandleTeinte(sku)) return null;
  const response = await fetch(`/api/shopify/papier-peint/${encodeURIComponent(sku)}`);
  if (response.status === 404) {
    if (options.signalerInconnu !== false) console.warn(`Papier peint inconnu de la boutique, ignoré : ${sku}`);
    return null;
  }
  if (!response.ok) throw new ErreurChargementPapierPeint('Erreur lors du chargement du papier peint');
  return response.json();
}

/**
 * Charge plusieurs papiers peints en parallèle, dans l'ordre ; les inconnus
 * et ceux en erreur sont écartés (signalés en console).
 */
export async function chargerPapiersPeints(skus: readonly string[]): Promise<PapierPeint[]> {
  const resultats = await Promise.all(
    skus.map((sku) =>
      chargerPapierPeint(sku).catch((err: unknown) => {
        console.error(`Impossible de charger le papier peint ${sku}`, err);
        return null;
      })
    )
  );
  return resultats.filter((papier): papier is PapierPeint => papier !== null);
}
