import { nomCourtTeinte } from '@/lib/couleur';
import { estHandleTeinte } from '@/lib/embed-messages';
import { PARENT_ORIGIN } from '@/lib/navigation';

/**
 * Papiers peints essayés dans le simulateur (décision du 21/10/2026).
 *
 * Référence Wizart d'un papier peint = SKU Shopify de sa variante « Lé »
 * (ex. `pp-montg-terracotta-le`) : une référence reçue du simulateur est soit
 * un handle de teinte, soit un SKU de variante papier peint. La résolution
 * d'un SKU se fait côté serveur (Admin API, `lib/shopify-papiers-peints.ts`) :
 * la Storefront API ne filtre pas les produits par SKU.
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

/** Fiche boutique d'une variante, dans la fenêtre principale. */
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
 * Papier peint à partir de la variante trouvée pour un SKU. Null si la
 * variante est absente, si son SKU ne correspond pas exactement (la recherche
 * Shopify est permissive) ou si son produit n'est pas un papier peint.
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

/** Terme de recherche Admin `sku:"…"` (valeur déjà validée : handle Shopify). */
export function rechercheSku(sku: string): string {
  return `sku:"${sku}"`;
}

/**
 * Requête Admin : un alias par SKU (valeurs en variables, jamais
 * interpolées). Quelques résultats par SKU : la correspondance exacte est
 * vérifiée par `versPapierPeint`.
 */
export function requetePapiersPeints(nombre: number): string {
  const variables = Array.from({ length: nombre }, (_, i) => `$q${i}: String!`).join(', ');
  const champs = Array.from({ length: nombre }, (_, i) =>
    `v${i}: productVariants(first: 5, query: $q${i}) { nodes { ...VariantePapierPeint } }`,
  ).join('\n');
  return `query PapiersPeints(${variables}) {\n${champs}\n}
fragment VariantePapierPeint on ProductVariant {
  id legacyResourceId sku
  selectedOptions { name value }
  image { url }
  product { handle title productType featuredImage { url } }
}`;
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
