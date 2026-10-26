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

// Unités acceptées dans l'option « Taille » des papiers peints
const UNIT_TO_METERS: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
};

function roundMeters(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Formate une longueur en mètres pour le CSV (point décimal, sans zéros superflus). */
export function formatMeters(meters: number | null): string {
  return meters === null ? '' : String(meters);
}

/** Repère un intitulé « papier(s) peint(s) » (titre de collection, type produit, tag). */
export function isWallpaperLabel(value: string | null | undefined): boolean {
  return typeof value === 'string' && /papiers?[\s-]+peints?/i.test(value);
}

// ─── Gabarit WALLPAPER : une ligne par coloris (variante « Lé ») ────────────

/**
 * Colonnes exportées : les colonnes requises, puis les colonnes facultatives
 * renseignées (documentation « WALLPAPER (upload requirements) », relue le
 * 21/10/2026) :
 * - `repeat_width` (requis) : « width of the imported pattern », largeur du
 *   motif de la texture importée, en mètres (souvent la largeur du lé) ;
 * - `pattern_repeat` : hauteur du raccord (répétition verticale du motif) ;
 * - `pattern_offset` : décalage entre deux lés pour que le motif raccorde
 *   (0 pour un raccord droit ou libre, la moitié du raccord pour un raccord
 *   sauté) ;
 * - `product_link` : fiche boutique sur la variante ;
 * - prix : colonnes présentes, toujours vides (la boutique est la seule
 *   source de prix) ;
 * - puis toutes les autres colonnes du mapping « default » du type Wallpaper :
 *   l'import du PIM refuse un CSV auquel il en manque une, même vide (constaté
 *   le 22/10/2026). Renseignées : `wallpaper_roll_length` (longueur du lé, lue
 *   dans l'option « Taille »), `reverse` et `mural` (`no`), `product_layout`
 *   (`vertical`), `application_surface` (`wall`) ; les autres restent vides.
 * Le CSV de 35 colonnes a été importé avec succès le 22/10/2026 (12 lignes).
 */
export const WALLPAPER_EXPORT_COLUMNS = [
  ...WALLPAPER_COLUMNS,
  'pattern_repeat',
  'pattern_offset',
  'product_link',
  'product_regular_price',
  'product_promotional_price',
  'wallpaper_roll_length',
  'color',
  'base',
  'coating',
  'interior_type',
  'style',
  'pattern',
  'product_description',
  'texture',
  'country_of_origin',
  'removal_type',
  'product_transparency',
  'reverse',
  'mural',
  'product_availability',
  'product_layout',
  'application_surface',
  'product_context',
  'context_currency',
  'features',
  'pattern_scale',
  'installation_method',
  'additional_data',
] as const;

/** Valeurs fixes des colonnes facultatives renseignées ; les autres restent vides. */
export const WALLPAPER_DEFAULTS: Partial<Record<WallpaperExportColumn, string>> = {
  reverse: 'no',
  mural: 'no',
  product_layout: 'vertical',
  application_surface: 'wall',
};

export type WallpaperExportColumn = (typeof WALLPAPER_EXPORT_COLUMNS)[number];

export const WALLPAPER_COLLECTION_NAME = 'Papiers peints';

/** Raccord d'un papier peint : droit, sauté (décalé) ou libre (sans raccord). */
export type WallpaperMatch = 'droit' | 'saute' | 'libre';

/**
 * Entrée du fichier manuel `papiers-peints.json` (une par SKU), remplie à la
 * main depuis les fichiers de Colibri : ce que Shopify n'a pas. Mesures en
 * mètres ; `null` = pas encore renseigné.
 */
export interface WallpaperManualEntry {
  /** Largeur du motif de la texture fournie → `repeat_width` */
  largeurMotif: number | null;
  /** Hauteur du raccord → `pattern_repeat` */
  hauteurRaccord: number | null;
  /** Type de raccord → `pattern_offset` (0, ou moitié du raccord si sauté) */
  raccord: WallpaperMatch | null;
  /** Décalage explicite (mètres), prioritaire sur le calcul depuis `raccord` */
  decalage: number | null;
}

export type WallpaperManualData = Record<string, WallpaperManualEntry>;

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Lit le fichier manuel. Clés commençant par `_` ignorées (commentaires) ;
 * valeurs invalides traitées comme non renseignées et signalées.
 */
export function parseWallpaperManualData(raw: string): { data: WallpaperManualData; notes: string[] } {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('papiers-peints.json : objet { "{sku}": { … } } attendu');
  }
  const data: WallpaperManualData = {};
  const notes: string[] = [];
  for (const [sku, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (sku.startsWith('_')) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      notes.push(`${sku} : entrée illisible, ignorée`);
      continue;
    }
    const entry = value as Record<string, unknown>;
    const read = (key: string): number | null => {
      const number = positiveNumber(entry[key]);
      if (number === null && entry[key] !== null && entry[key] !== undefined) {
        notes.push(`${sku} : ${key} invalide (nombre en mètres attendu)`);
      }
      return number;
    };
    const match = entry.raccord;
    const raccord = match === 'droit' || match === 'saute' || match === 'libre' ? match : null;
    if (raccord === null && match !== null && match !== undefined) {
      notes.push(`${sku} : raccord invalide (« droit », « saute » ou « libre » attendu)`);
    }
    data[sku.trim().toLowerCase()] = {
      largeurMotif: read('largeurMotif'),
      hauteurRaccord: read('hauteurRaccord'),
      raccord,
      decalage: read('decalage'),
    };
  }
  return { data, notes };
}

export interface VariantOption {
  name: string;
  value: string;
}

function optionValue(options: readonly VariantOption[], name: string): string | null {
  return options.find((option) => option.name.trim().toLowerCase() === name)?.value.trim() || null;
}

/** Variante « Lé » : option « Taille » commençant par « Lé : » (pas l'échantillon A4). */
export function isLeVariant(options: readonly VariantOption[]): boolean {
  return /^l[ée]\s*:/i.test(optionValue(options, 'taille') ?? '');
}

/**
 * Dimensions du lé en mètres, lues dans l'option « Taille »
 * (`Lé : 53x280cm` → largeur 0.53, longueur 2.8). Premier nombre = largeur,
 * second = longueur ; unité après le second (cm par défaut).
 */
export function parseLeSize(value: string | null | undefined): { width: number; length: number } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\b/i);
  if (!match) return null;
  const factor = UNIT_TO_METERS[(match[3] ?? 'cm').toLowerCase()];
  const toMeters = (amount: string) => roundMeters(Number(amount.replace(',', '.')) * factor);
  return { width: toMeters(match[1]), length: toMeters(match[2]) };
}

/** Nom du motif : partie du titre avant « - » (même règle que `nomCourtTeinte` de l'app). */
export function motifName(title: string): string {
  return title.split(/\s+[-–—]\s+/)[0].trim() || title.trim();
}

/**
 * `product_name` : « {Motif} - {Coloris} », sans répéter le motif quand le
 * coloris le contient déjà (« Rayures bleues », « Ombrelle bleu nuit »).
 */
export function wallpaperProductName(motif: string, coloris: string | null): string {
  if (!coloris) return motif;
  return coloris.toLowerCase().startsWith(motif.toLowerCase()) ? coloris : `${motif} - ${coloris}`;
}

/** Id numérique d'un GID Shopify (`gid://shopify/ProductVariant/123` → `123`). */
export function numericId(gid: string): string {
  return gid.split('/').pop() ?? gid;
}

export function wallpaperVariantLink(handle: string, variantGid: string): string {
  return `${productLink(handle)}?variant=${numericId(variantGid)}`;
}

/** Décalage entre deux lés (`pattern_offset`), ou null s'il ne peut pas être déduit. */
export function patternOffset(entry: WallpaperManualEntry): number | null {
  if (entry.decalage !== null) return entry.decalage;
  if (entry.raccord === 'droit' || entry.raccord === 'libre') return 0;
  if (entry.raccord === 'saute' && entry.hauteurRaccord !== null) return roundMeters(entry.hauteurRaccord / 2);
  return null;
}

export interface WallpaperVariantSource {
  handle: string;
  title: string;
  variants: { id: string; sku: string | null; selectedOptions: VariantOption[] }[];
}

export interface WallpaperVariantRow {
  sku: string;
  productHandle: string;
  row: Record<WallpaperExportColumn, string>;
  notes: string[];
}

export interface WallpaperVariantRows {
  rows: WallpaperVariantRow[];
  /** Variantes « Lé » écartées (sans SKU, SKU en double) */
  skipped: string[];
  /** Entrées du fichier manuel sans variante « Lé » correspondante */
  unusedManual: string[];
}

/**
 * Une ligne par variante « Lé » (une par coloris) : `unique_sku_id` et
 * `product_image` = SKU, largeur depuis l'option « Taille », raccord depuis
 * le fichier manuel, prix vides. Les variantes « Echantillon » sont ignorées.
 */
export function buildWallpaperVariantRows(
  products: readonly WallpaperVariantSource[],
  manual: WallpaperManualData,
): WallpaperVariantRows {
  const rows: WallpaperVariantRow[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const product of products) {
    const motif = motifName(product.title);
    for (const variant of product.variants) {
      if (!isLeVariant(variant.selectedOptions)) continue;
      const sku = variant.sku?.trim().toLowerCase() ?? '';
      if (!sku) {
        skipped.push(`${product.handle} (variante ${numericId(variant.id)}) : SKU absent`);
        continue;
      }
      if (seen.has(sku)) {
        skipped.push(`${sku} : SKU en double (${product.handle})`);
        continue;
      }
      seen.add(sku);

      const notes: string[] = [];
      const size = optionValue(variant.selectedOptions, 'taille');
      const dimensions = parseLeSize(size);
      if (dimensions === null) {
        notes.push(`product_width, wallpaper_roll_length : dimensions illisibles dans « ${size ?? ''} »`);
      }
      const coloris = optionValue(variant.selectedOptions, 'couleur');
      if (!coloris) notes.push('option « Couleur » absente');

      const entry = manual[sku];
      let repeatWidth: number | null = null;
      let patternRepeat: number | null = null;
      let offset: number | null = null;
      if (!entry) {
        notes.push('papiers-peints.json : entrée absente (repeat_width, pattern_repeat, pattern_offset vides)');
      } else {
        repeatWidth = entry.largeurMotif;
        patternRepeat = entry.hauteurRaccord;
        offset = patternOffset(entry);
        if (repeatWidth === null) notes.push('repeat_width (requis par Wizart) : largeurMotif non renseignée');
        if (patternRepeat === null) notes.push('pattern_repeat : hauteurRaccord non renseignée');
        if (offset === null) notes.push('pattern_offset : raccord non renseigné');
      }

      const empty = Object.fromEntries(WALLPAPER_EXPORT_COLUMNS.map((column) => [column, ''])) as Record<
        WallpaperExportColumn,
        string
      >;
      rows.push({
        sku,
        productHandle: product.handle,
        notes,
        row: {
          ...empty,
          ...WALLPAPER_DEFAULTS,
          brand_name: BRAND_NAME,
          collection_name: WALLPAPER_COLLECTION_NAME,
          product_name: wallpaperProductName(motif, coloris),
          unique_sku_id: sku,
          // Nom du fichier texture attendu dans le ZIP, sans extension (= SKU)
          product_image: sku,
          product_width: formatMeters(dimensions?.width ?? null),
          repeat_width: formatMeters(repeatWidth),
          pattern_repeat: formatMeters(patternRepeat),
          pattern_offset: formatMeters(offset),
          product_link: wallpaperVariantLink(product.handle, variant.id),
          product_regular_price: '',
          product_promotional_price: '',
          wallpaper_roll_length: formatMeters(dimensions?.length ?? null),
        },
      });
    }
  }

  const unusedManual = Object.keys(manual).filter((sku) => !seen.has(sku));
  return { rows, skipped, unusedManual };
}

/** Extensions de texture acceptées (`{sku}.png` ou `{sku}.jpg`). */
export const TEXTURE_EXTENSIONS = ['.png', '.jpg'] as const;

/**
 * Compare le contenu d'un dossier de textures aux SKU exportés : SKU sans
 * fichier `{sku}.png` / `{sku}.jpg`, et fichiers qui ne correspondent à aucun
 * SKU (fichiers cachés ignorés). Aucun traitement d'image.
 */
export function compareTextures(fileNames: readonly string[], skus: readonly string[]): { missing: string[]; extra: string[] } {
  const expected = new Set(skus.flatMap((sku) => TEXTURE_EXTENSIONS.map((ext) => `${sku}${ext}`)));
  const visible = fileNames.filter((name) => !name.startsWith('.'));
  const present = new Set(visible);
  return {
    missing: skus.filter((sku) => !TEXTURE_EXTENSIONS.some((ext) => present.has(`${sku}${ext}`))),
    extra: visible.filter((name) => !expected.has(name)).sort(),
  };
}
