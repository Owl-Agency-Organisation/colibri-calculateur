/**
 * Utilitaires partagés des exports Wizart (essai visualiseur, Deployment Kit).
 *
 * Ce module ne fait AUCUN appel réseau à l'import : les fonctions pures
 * (hex, luminance, sélection, CSV) sont testées par `common.test.ts`, et le
 * client Storefront (`lib/shopify.ts`) n'est chargé qu'à l'exécution, après
 * lecture du fichier d'environnement.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ─── Constantes d'export ────────────────────────────────────────────────────

export const BRAND_NAME = 'Colibri Peinture';
export const STORE_PUBLIC_URL = 'https://www.colibripeinture.com';

/**
 * Séparateur CSV. Le gabarit officiel Wizart n'a pas pu être consulté depuis
 * l'environnement de développement : virgule par défaut (CSV standard),
 * à aligner sur le fichier exemple Wizart si celui-ci diffère.
 */
export const CSV_SEPARATOR = ',';

/**
 * `pattern_width` (gabarit PAINT) : flottant en mètres (documentation Wizart :
 * « float, numbers only, up to 15 meters », exemple 0.5). Valeur 1 retenue
 * par le brief faute d'indication spécifique à la peinture.
 */
export const PAINT_PATTERN_WIDTH = '1';

export const PAINT_SAMPLE_PER_COLLECTION = 3;

/**
 * Plafond de lignes. La boutique compte 14 familles de couleurs murales
 * (« Les Blancs », « Les Bleus »…) : 14 × 3 = 42 teintes, plafond posé à 45
 * pour qu'aucune famille ne perde sa teinte foncée (constaté au premier
 * export réel : avec 30 collections et un plafond de 30, seules les teintes
 * claires sortaient).
 */
export const PAINT_SAMPLE_MAX_ROWS = 45;

/**
 * Collections « Les … » écartées de l'échantillon peinture :
 * - « Les laques … » : laques bois et métal, hors murs, donc hors visualiseur ;
 * - « Les Pastels », « Les Peps », « Les Tendances » : sélections thématiques
 *   transverses, dont les teintes appartiennent déjà aux familles de couleurs.
 */
export const PAINT_EXCLUDED_COLLECTIONS = /laque|pastel|peps|tendance/i;

export const WIZART_OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');

export function productLink(handle: string): string {
  return `${STORE_PUBLIC_URL}/products/${handle}`;
}

// ─── Couleur ────────────────────────────────────────────────────────────────

/**
 * Normalise un code hexadécimal en `#RRGGBB` majuscule.
 * Accepte `#abc`, `abc`, `#aabbcc`, `aabbcc` (espaces tolérés).
 * Retourne `null` si la valeur n'est pas un hex valide.
 */
export function normalizeHex(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return `#${value
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(value)) return `#${value.toUpperCase()}`;
  return null;
}

/** Luminance relative (WCAG 2.x, sRGB linéarisé) d'un hex `#RRGGBB`, entre 0 et 1. */
export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Hex invalide : ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(normalized.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ─── Sélection de l'échantillon peinture ────────────────────────────────────

export interface ShadeCandidate {
  handle: string;
  title: string;
  hex: string;
  imageUrl: string | null;
}

export interface CollectionShades {
  title: string;
  handle: string;
  shades: ShadeCandidate[];
}

export type SampleRole = 'plus claire' | 'médiane' | 'plus foncée';

export interface SelectedShade extends ShadeCandidate {
  collectionTitle: string;
  role: SampleRole;
  luminance: number;
}

export interface SampleResult {
  rows: SelectedShade[];
  /** Teintes retenues par collection avant application du plafond. */
  picksBeforeCap: number;
  /** Teintes écartées par le plafond global. */
  droppedByCap: SelectedShade[];
  /** Produits déjà retenus via une autre collection (identifiant unique = handle). */
  duplicates: { handle: string; collectionTitle: string; keptIn: string }[];
}

/**
 * Choisit, dans une liste de teintes, la plus claire, la plus foncée et la
 * médiane (par luminance). Moins de 3 teintes → toutes, sans doublon.
 * Ordre de retour : plus claire, médiane, plus foncée.
 */
export function pickExtremesAndMedian(
  shades: ShadeCandidate[],
): { shade: ShadeCandidate; role: SampleRole; luminance: number }[] {
  const sorted = shades
    .map((shade) => ({ shade, luminance: relativeLuminance(shade.hex) }))
    // Plus claire d'abord ; handle en départage pour un résultat déterministe
    .sort((a, b) => b.luminance - a.luminance || a.shade.handle.localeCompare(b.shade.handle));

  if (sorted.length === 0) return [];
  const last = sorted.length - 1;
  const medianIndex = Math.floor(last / 2);
  const picks: { index: number; role: SampleRole }[] = [
    { index: 0, role: 'plus claire' },
    { index: medianIndex, role: 'médiane' },
    { index: last, role: 'plus foncée' },
  ];
  const seen = new Set<number>();
  return picks
    .filter(({ index }) => {
      if (seen.has(index)) return false;
      seen.add(index);
      return true;
    })
    .map(({ index, role }) => ({ ...sorted[index], role }));
}

/**
 * Construit l'échantillon : 3 teintes par collection (claire, médiane,
 * foncée), un produit n'apparaît qu'une fois (première collection dans
 * l'ordre alphabétique), puis plafond global. Le plafond est appliqué en
 * tourniquet (1re teinte de chaque collection, puis 2e, puis 3e) pour que
 * chaque collection soit représentée avant d'en compléter une autre.
 */
export function buildPaintSample(
  collections: CollectionShades[],
  perCollection = PAINT_SAMPLE_PER_COLLECTION,
  maxRows = PAINT_SAMPLE_MAX_ROWS,
): SampleResult {
  const ordered = [...collections].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  const keptIn = new Map<string, string>();
  const duplicates: SampleResult['duplicates'] = [];
  const perCollectionPicks: SelectedShade[][] = [];

  for (const collection of ordered) {
    const available = collection.shades.filter((shade) => {
      const owner = keptIn.get(shade.handle);
      if (owner && owner !== collection.title) {
        duplicates.push({ handle: shade.handle, collectionTitle: collection.title, keptIn: owner });
        return false;
      }
      return true;
    });
    const picks = pickExtremesAndMedian(available)
      .slice(0, perCollection)
      .map(({ shade, role, luminance }) => ({
        ...shade,
        collectionTitle: collection.title,
        role,
        luminance,
      }));
    for (const pick of picks) keptIn.set(pick.handle, collection.title);
    perCollectionPicks.push(picks);
  }

  const interleaved: SelectedShade[] = [];
  const depth = Math.max(0, ...perCollectionPicks.map((picks) => picks.length));
  for (let rank = 0; rank < depth; rank++) {
    for (const picks of perCollectionPicks) {
      if (picks[rank]) interleaved.push(picks[rank]);
    }
  }
  const kept = new Set(interleaved.slice(0, maxRows));

  // Sortie regroupée par collection (ordre alphabétique), lisible dans le PIM
  const rows = perCollectionPicks.flat().filter((shade) => kept.has(shade));
  const droppedByCap = perCollectionPicks.flat().filter((shade) => !kept.has(shade));
  return { rows, picksBeforeCap: interleaved.length, droppedByCap, duplicates };
}

// ─── CSV / Markdown ─────────────────────────────────────────────────────────

/** Échappe une cellule CSV (RFC 4180) : guillemets si séparateur, guillemet ou saut de ligne. */
export function csvCell(value: string, separator = CSV_SEPARATOR): string {
  if (value.includes(separator) || /["\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Sérialise un tableau en CSV (fin de ligne CRLF, pas de BOM). */
export function toCsv<C extends string>(
  columns: readonly C[],
  rows: Record<C, string>[],
  separator = CSV_SEPARATOR,
): string {
  const lines = [columns, ...rows.map((row) => columns.map((column) => row[column]))].map(
    (cells) => cells.map((cell) => csvCell(cell, separator)).join(separator),
  );
  return `${lines.join('\r\n')}\r\n`;
}

/** Échappe une cellule de tableau Markdown. */
export function mdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function writeOutput(fileName: string, content: string | Uint8Array): string {
  mkdirSync(WIZART_OUT_DIR, { recursive: true });
  const filePath = path.join(WIZART_OUT_DIR, fileName);
  if (typeof content === 'string') writeFileSync(filePath, content, 'utf8');
  else writeFileSync(filePath, content);
  return filePath;
}

// ─── Accès Shopify (exécution uniquement) ───────────────────────────────────

type ShopifyModule = typeof import('../../lib/shopify');

/**
 * Charge `.env.local` (ou `.env`) puis le client Storefront de l'application.
 * Les variables déjà présentes dans l'environnement sont prioritaires.
 * `lib/shopify.ts` lève une erreur à l'import si les variables manquent :
 * on vérifie donc avant pour afficher un message clair.
 */
export async function loadShopifyClient(): Promise<ShopifyModule['shopifyFetch']> {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  for (const file of ['.env.local', '.env']) {
    const envPath = path.join(root, file);
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
      break;
    }
  }
  const missing = [
    'NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN',
    'NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN',
  ].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(', ')} (voir .env.local.example).`,
    );
  }
  const shopifyUrl = pathToFileURL(path.join(root, 'lib', 'shopify.ts')).href;
  const shopify = (await import(shopifyUrl)) as ShopifyModule;
  return shopify.shopifyFetch;
}

export type ShopifyFetch = ShopifyModule['shopifyFetch'];

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Connection<N> {
  pageInfo: PageInfo;
  nodes: N[];
}

/**
 * Parcourt une connexion Storefront paginée par curseur jusqu'à épuisement.
 * `extract` renvoie la connexion à partir de la réponse (ou `null` si absente).
 */
export async function fetchAllPages<T, N>(
  shopifyFetch: ShopifyFetch,
  query: string,
  variables: Record<string, string | number | null>,
  extract: (data: T) => Connection<N> | null | undefined,
): Promise<N[]> {
  const nodes: N[] = [];
  let after: string | null = null;
  // Garde-fou contre une boucle infinie si l'API renvoie toujours le même curseur
  for (let page = 0; page < 200; page++) {
    const { data } = await shopifyFetch<T>({ query, variables: { ...variables, after } });
    const connection = extract(data);
    if (!connection) break;
    nodes.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) return nodes;
    if (connection.pageInfo.endCursor === after) break;
    after = connection.pageInfo.endCursor;
  }
  return nodes;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ─── Gabarit PAINT ──────────────────────────────────────────────────────────

/**
 * Colonnes du gabarit PAINT, exactement dans l'ordre du fichier
 * « Default mapping template_Paint.xlsx » de Wizart (mapping par défaut du
 * PIM, validé au premier import).
 *
 * Méthode image : chaque teinte est fournie comme un aplat PNG uni
 * (`{handle}.png` dans le ZIP, voir `aplats.ts`) et `product_image` = handle,
 * sans extension. La méthode `render_color` est abandonnée : le mapping par
 * défaut exige `product_image` et le formulaire d'import exige un ZIP.
 */
export const PAINT_COLUMNS = [
  'brand_name',
  'collection_name',
  'product_name',
  'unique_sku_id',
  'product_image',
  'pattern_width',
  'product_link',
  'usage',
  'sheen',
  'application_surface',
  'color',
  'product_coverage',
  'coating_type',
  'opacity',
  'interior_type',
  'product_description',
  'country_of_origin',
  'product_availability',
  'price_per_container',
  'promotional_price_per_container',
  'product_context',
  'context_currency',
  'cleanup',
  'features',
  'container_size',
  'drying_time',
  'recommended_coats',
  'warranty',
  'resistance',
  'lifestyle',
  'additional_data',
] as const;

export type PaintColumn = (typeof PAINT_COLUMNS)[number];

/** Nom du fichier aplat d'une teinte dans le ZIP (`product_image` + extension). */
export function aplatFileName(handle: string): string {
  return `${handle}.png`;
}

export function toPaintRow(shade: SelectedShade): Record<PaintColumn, string> {
  const row = Object.fromEntries(PAINT_COLUMNS.map((column) => [column, ''])) as Record<
    PaintColumn,
    string
  >;
  return {
    ...row,
    brand_name: BRAND_NAME,
    collection_name: shade.collectionTitle,
    product_name: shade.title,
    unique_sku_id: shade.handle,
    product_image: shade.handle,
    pattern_width: PAINT_PATTERN_WIDTH,
    product_link: productLink(shade.handle),
    application_surface: 'wall',
    color: shade.hex,
    product_availability: 'in_stock',
  };
}

// ─── Gabarit WALLPAPER ──────────────────────────────────────────────────────

/** Colonnes requises du gabarit WALLPAPER, dans l'ordre du brief. */
export const WALLPAPER_COLUMNS = [
  'brand_name',
  'collection_name',
  'product_name',
  'unique_sku_id',
  'product_image',
  'product_width',
  'repeat_width',
] as const;

export type WallpaperColumn = (typeof WALLPAPER_COLUMNS)[number];

export interface LengthParse {
  /** Longueur en mètres, `null` si la valeur n'est pas exploitable. */
  meters: number | null;
  /** Remarque à reporter (unité supposée, valeur illisible…). */
  note: string | null;
}

const UNIT_TO_METERS: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
};

const UNIT_ALIASES: Record<string, string> = {
  mm: 'mm',
  millimetres: 'mm',
  millimètres: 'mm',
  cm: 'cm',
  centimetres: 'cm',
  centimètres: 'cm',
  m: 'm',
  metre: 'm',
  mètre: 'm',
  metres: 'm',
  mètres: 'm',
  in: 'in',
  inches: 'in',
  ft: 'ft',
  feet: 'ft',
  yd: 'yd',
  yards: 'yd',
};

function roundMeters(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Convertit la valeur d'un metafield de longueur en mètres. Formats acceptés :
 * metafield `dimension` (`{"value":53,"unit":"cm"}`), décimal (`0.53`, `0,53`)
 * ou texte avec unité (`53 cm`, `0,53 m`). Sans unité : centimètres supposés
 * au-delà de 3, mètres en dessous — et la supposition est signalée.
 */
export function parseLengthToMeters(raw: string | null | undefined): LengthParse {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { meters: null, note: 'metafield absent' };
  }
  const text = raw.trim();

  if (text.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && 'value' in parsed && 'unit' in parsed) {
        const { value, unit } = parsed as { value: unknown; unit: unknown };
        const factor = typeof unit === 'string' ? UNIT_TO_METERS[unit.toLowerCase()] : undefined;
        const amount = typeof value === 'number' ? value : Number(value);
        if (factor !== undefined && Number.isFinite(amount)) {
          return { meters: roundMeters(amount * factor), note: null };
        }
      }
    } catch {
      // Valeur non JSON : traitée comme du texte ci-dessous
    }
    return { meters: null, note: `valeur illisible « ${text} »` };
  }

  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zàâéèêîôûç]*)\.?$/i);
  if (!match) return { meters: null, note: `valeur illisible « ${text} »` };
  const amount = Number(match[1].replace(',', '.'));
  const unitLabel = match[2].toLowerCase();
  if (unitLabel) {
    const unit = UNIT_ALIASES[unitLabel];
    if (!unit) return { meters: null, note: `unité inconnue « ${match[2]} »` };
    return { meters: roundMeters(amount * UNIT_TO_METERS[unit]), note: null };
  }
  if (amount > 3) {
    return { meters: roundMeters(amount / 100), note: `unité absente, centimètres supposés (« ${text} »)` };
  }
  return { meters: roundMeters(amount), note: `unité absente, mètres supposés (« ${text} »)` };
}

/** Formate une longueur en mètres pour le CSV (point décimal, sans zéros superflus). */
export function formatMeters(meters: number | null): string {
  return meters === null ? '' : String(meters);
}

export interface WallpaperProduct {
  handle: string;
  title: string;
  collectionTitle: string;
  productWidth: number | null;
  repeatWidth: number | null;
}

export function toWallpaperRow(product: WallpaperProduct): Record<WallpaperColumn, string> {
  return {
    brand_name: BRAND_NAME,
    collection_name: product.collectionTitle,
    product_name: product.title,
    unique_sku_id: product.handle,
    // Nom du fichier texture attendu dans le ZIP, sans extension (= handle)
    product_image: product.handle,
    product_width: formatMeters(product.productWidth),
    repeat_width: formatMeters(product.repeatWidth),
  };
}

/** Repère un intitulé « papier(s) peint(s) » (titre de collection, type produit, tag). */
export function isWallpaperLabel(value: string | null | undefined): boolean {
  return typeof value === 'string' && /papiers?[\s-]+peints?/i.test(value);
}
