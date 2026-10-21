/**
 * Export des papiers peints Colibri au gabarit WALLPAPER de Wizart : une
 * ligne par coloris, c'est-à-dire par variante « Lé » (les variantes
 * « Echantillon » ne vont pas dans Wizart).
 *
 * Usage :
 *   pnpm wizart:export-papiers-peints --product-type "Papier peint"
 *   pnpm wizart:export-papiers-peints --product-type "Papier peint" --textures ~/textures-colibri
 *
 * Repérage par défaut (cumulatif, chaque produit garde la trace du critère) :
 *   1. collections dont le titre ou le handle contient « papier(s) peint(s) » ;
 *   2. produits dont le productType contient « papier(s) peint(s) » ;
 *   3. produits portant un tag contenant « papier(s) peint(s) ».
 * Options `--collection <handle>`, `--product-type <valeur>`, `--tag <valeur>`
 * (répétables) : remplacent le repérage par défaut par des critères exacts.
 *
 * Référence Wizart = SKU de la variante « Lé » (`unique_sku_id`, et
 * `product_image` = nom du fichier texture sans extension). Largeur du lé lue
 * dans l'option « Taille » ; raccord lu dans le fichier manuel
 * `papiers-peints.json` (Shopify ne l'a pas). `--textures <dossier>` vérifie
 * que chaque SKU a son fichier `{sku}.png` ou `{sku}.jpg` (aucun traitement
 * d'image). Prix vides.
 *
 * Sorties : scripts/wizart/out/colibri-papiers-peints.{csv,md}
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import type { Connection, WallpaperManualData, WallpaperVariantRows } from './common';

// Import dynamique avec extension : exécuté par Node (type stripping natif),
// qui ne résout pas les imports relatifs sans extension.
const common = (await import(new URL('./common.ts', import.meta.url).href)) as typeof import('./common');

const CSV_FILE = 'colibri-papiers-peints.csv';
const REPORT_FILE = 'colibri-papiers-peints.md';
const MANUAL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'papiers-peints.json');

const PRODUCT_FIELDS = `
  handle
  title
  productType
  tags
  variants(first: 50) { nodes { id sku selectedOptions { name value } } }
`;

const ALL_COLLECTIONS_QUERY = `
  query WizartAllCollections($after: String) {
    collections(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { title handle }
    }
  }
`;

const COLLECTION_PRODUCTS_QUERY = `
  query WizartWallpaperCollection($handle: String!, $after: String) {
    collection(handle: $handle) {
      products(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { ${PRODUCT_FIELDS} }
      }
    }
  }
`;

const PRODUCTS_SEARCH_QUERY = `
  query WizartWallpaperSearch($query: String!, $after: String) {
    products(first: 100, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes { ${PRODUCT_FIELDS} }
    }
  }
`;

interface CollectionRef {
  title: string;
  handle: string;
}

interface ProductNode {
  handle: string;
  title: string;
  productType: string;
  tags: string[];
  variants: { nodes: { id: string; sku: string | null; selectedOptions: { name: string; value: string }[] }[] };
}

interface CollectionsData {
  collections: Connection<CollectionRef>;
}

interface CollectionProductsData {
  collection: { products: Connection<ProductNode> } | null;
}

interface ProductsSearchData {
  products: Connection<ProductNode>;
}

interface Detected {
  product: ProductNode;
  criteria: Set<string>;
}

interface Options {
  custom: boolean;
  collections: string[];
  productTypes: string[];
  tags: string[];
  textures: string | null;
}

function readOptions(): Options {
  const { values } = parseArgs({
    options: {
      collection: { type: 'string', multiple: true },
      'product-type': { type: 'string', multiple: true },
      tag: { type: 'string', multiple: true },
      textures: { type: 'string' },
    },
  });
  const collections = values.collection ?? [];
  const productTypes = values['product-type'] ?? [];
  const tags = values.tag ?? [];
  return {
    custom: collections.length + productTypes.length + tags.length > 0,
    collections,
    productTypes,
    tags,
    textures: values.textures ?? null,
  };
}

/** Échappe une valeur pour la syntaxe de recherche Shopify (`champ:"valeur"`). */
function searchTerm(field: string, value: string): string {
  return `${field}:"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function readManual(): { data: WallpaperManualData; notes: string[] } {
  if (!existsSync(MANUAL_FILE)) {
    return { data: {}, notes: [`${path.basename(MANUAL_FILE)} absent : raccords vides`] };
  }
  return common.parseWallpaperManualData(readFileSync(MANUAL_FILE, 'utf8'));
}

function readTextureDir(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`--textures : dossier introuvable « ${dir} »`);
  }
  return readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isFile());
}

async function main(): Promise<void> {
  const options = readOptions();
  const shopifyFetch = await common.loadShopifyClient();
  const detected = new Map<string, Detected>();
  const add = (product: ProductNode, criterion: string) => {
    const entry = detected.get(product.handle) ?? { product, criteria: new Set<string>() };
    entry.criteria.add(criterion);
    detected.set(product.handle, entry);
  };

  // 1. Collections
  let wallpaperCollections: CollectionRef[];
  if (options.custom) {
    wallpaperCollections = options.collections.map((handle) => ({ title: handle, handle }));
  } else {
    const all = await common.fetchAllPages<CollectionsData, CollectionRef>(
      shopifyFetch,
      ALL_COLLECTIONS_QUERY,
      {},
      (data) => data.collections,
    );
    wallpaperCollections = all.filter(
      (c) => common.isWallpaperLabel(c.title) || common.isWallpaperLabel(c.handle.replace(/-/g, ' ')),
    );
  }
  const collectionSizes = new Map<string, number>();
  for (const collection of wallpaperCollections) {
    const products = await common.fetchAllPages<CollectionProductsData, ProductNode>(
      shopifyFetch,
      COLLECTION_PRODUCTS_QUERY,
      { handle: collection.handle },
      (data) => data.collection?.products,
    );
    collectionSizes.set(collection.handle, products.length);
    for (const product of products) add(product, `collection:${collection.handle}`);
  }

  // 2 et 3. productType et tags (recherche Storefront, confirmée côté script
  // car la recherche plein texte est permissive)
  const productTypes = options.custom ? options.productTypes : ['Papier peint', 'Papiers peints'];
  const tags = options.custom ? options.tags : ['Papier peint', 'Papiers peints'];
  const searchParts = [
    ...productTypes.map((value) => searchTerm('product_type', value)),
    ...tags.map((value) => searchTerm('tag', value)),
  ];
  if (searchParts.length > 0) {
    const results = await common.fetchAllPages<ProductsSearchData, ProductNode>(
      shopifyFetch,
      PRODUCTS_SEARCH_QUERY,
      { query: searchParts.join(' OR ') },
      (data) => data.products,
    );
    const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    for (const product of results) {
      const typeMatch = options.custom
        ? productTypes.some((t) => sameLabel(t, product.productType))
        : common.isWallpaperLabel(product.productType);
      if (typeMatch) add(product, `productType:${product.productType}`);
      const matchingTags = product.tags.filter((tag) =>
        options.custom ? tags.some((t) => sameLabel(t, tag)) : common.isWallpaperLabel(tag),
      );
      for (const tag of matchingTags) add(product, `tag:${tag}`);
    }
  }

  const entries = [...detected.values()].sort((a, b) => a.product.title.localeCompare(b.product.title, 'fr'));
  const manual = readManual();
  const result = common.buildWallpaperVariantRows(
    entries.map(({ product }) => ({ handle: product.handle, title: product.title, variants: product.variants.nodes })),
    manual.data,
  );
  const textures = options.textures
    ? { dir: options.textures, ...common.compareTextures(readTextureDir(options.textures), result.rows.map((r) => r.sku)) }
    : null;

  const csv = common.toCsv(common.WALLPAPER_EXPORT_COLUMNS, result.rows.map((r) => r.row));
  const csvPath = common.writeOutput(CSV_FILE, csv);
  const report = buildReport({ options, wallpaperCollections, collectionSizes, productTypes, tags, entries, result, manualNotes: manual.notes, textures });
  const reportPath = common.writeOutput(REPORT_FILE, report);

  const flagged = result.rows.filter((r) => r.notes.length > 0).length;
  console.log(`✔ ${result.rows.length} coloris de papier peint exporté(s) (${entries.length} produit(s))`);
  if (flagged > 0) console.log(`⚠ ${flagged} ligne(s) avec signalements (voir le rapport)`);
  if (textures) console.log(`Textures : ${textures.missing.length} manquante(s), ${textures.extra.length} fichier(s) en trop`);
  console.log(`→ ${path.relative(process.cwd(), csvPath)}`);
  console.log(`→ ${path.relative(process.cwd(), reportPath)}`);
}

function buildReport(input: {
  options: Options;
  wallpaperCollections: CollectionRef[];
  collectionSizes: Map<string, number>;
  productTypes: string[];
  tags: string[];
  entries: Detected[];
  result: WallpaperVariantRows;
  manualNotes: string[];
  textures: { dir: string; missing: string[]; extra: string[] } | null;
}): string {
  const { mdCell } = common;
  const { options, wallpaperCollections, collectionSizes, productTypes, tags, entries, result, manualNotes, textures } = input;
  const lines: string[] = [];

  lines.push('# Papiers peints Colibri — export Wizart (gabarit WALLPAPER)');
  lines.push('');
  lines.push(`Généré le ${new Date().toISOString()} depuis la Storefront API. Une ligne par coloris (variante « Lé »).`);
  lines.push('');

  lines.push('## Repérage dans Shopify');
  lines.push('');
  lines.push(options.custom ? 'Critères fournis en ligne de commande (correspondance exacte) :' : 'Critères par défaut (« papier(s) peint(s) », insensible à la casse) :');
  lines.push('');
  if (wallpaperCollections.length === 0) {
    lines.push('- Collections : aucune collection correspondante');
  } else {
    for (const c of wallpaperCollections) {
      lines.push(`- Collection « ${mdCell(c.title)} » (\`${c.handle}\`) : ${collectionSizes.get(c.handle) ?? 0} produit(s)`);
    }
  }
  lines.push(`- productType recherchés : ${productTypes.map((t) => `« ${t} »`).join(', ') || '—'}`);
  lines.push(`- Tags recherchés : ${tags.map((t) => `« ${t} »`).join(', ') || '—'}`);
  lines.push('');
  if (entries.length === 0) {
    lines.push('Aucun produit repéré : préciser le mode de repérage avec `--collection`, `--product-type` ou `--tag`.');
  } else {
    for (const { product, criteria } of entries) {
      lines.push(`- \`${product.handle}\` (${mdCell(product.title)}) : ${[...criteria].map((c) => `\`${mdCell(c)}\``).join(', ')}`);
    }
  }
  lines.push('');

  lines.push(`## Lignes exportées (${result.rows.length})`);
  lines.push('');
  if (result.rows.length > 0) {
    lines.push('| SKU | product_name | product_width | repeat_width | pattern_repeat | pattern_offset | Signalements |');
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
    for (const { sku, row, notes } of result.rows) {
      lines.push(
        `| \`${sku}\` | ${mdCell(row.product_name)} | ${row.product_width} | ${row.repeat_width} | ${row.pattern_repeat} | ${row.pattern_offset} | ${mdCell(notes.join(' ; '))} |`,
      );
    }
    lines.push('');
  }
  if (result.skipped.length > 0) {
    lines.push('Variantes « Lé » écartées :');
    lines.push('');
    for (const note of result.skipped) lines.push(`- ${mdCell(note)}`);
    lines.push('');
  }

  lines.push('## Fichier manuel `papiers-peints.json`');
  lines.push('');
  lines.push('Raccords saisis à la main depuis les fichiers de Colibri (Shopify ne les a pas).');
  lines.push('');
  const missing = result.rows.filter((r) => r.notes.some((n) => n.startsWith('papiers-peints.json'))).map((r) => r.sku);
  lines.push(`- Entrées absentes : ${missing.length === 0 ? 'aucune' : missing.map((s) => `\`${s}\``).join(', ')}`);
  lines.push(`- Entrées sans variante « Lé » correspondante : ${result.unusedManual.length === 0 ? 'aucune' : result.unusedManual.map((s) => `\`${s}\``).join(', ')}`);
  for (const note of manualNotes) lines.push(`- ${mdCell(note)}`);
  lines.push('');

  lines.push('## Textures');
  lines.push('');
  lines.push('Un fichier par ligne, nommé `{sku}.png` ou `{sku}.jpg` (colonne `product_image` + extension), préparé par Owl à partir des motifs raccordables de Colibri. Les images Shopify (mises en situation) ne sont pas des textures.');
  lines.push('');
  if (!textures) {
    lines.push('Vérification non demandée : relancer avec `--textures <dossier>`.');
  } else {
    lines.push(`Dossier vérifié : \`${mdCell(textures.dir)}\``);
    lines.push('');
    lines.push(`- Manquantes (${textures.missing.length}) : ${textures.missing.length === 0 ? 'aucune' : textures.missing.map((s) => `\`${s}\``).join(', ')}`);
    lines.push(`- Fichiers en trop (${textures.extra.length}) : ${textures.extra.length === 0 ? 'aucun' : textures.extra.map((s) => `\`${mdCell(s)}\``).join(', ')}`);
  }
  lines.push('');

  return lines.join('\n');
}

try {
  await main();
} catch (error) {
  console.error(`✖ Export papiers peints interrompu : ${common.formatError(error)}`);
  process.exitCode = 1;
}
