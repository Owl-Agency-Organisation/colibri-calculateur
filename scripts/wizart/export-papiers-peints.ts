/**
 * Squelette d'export des papiers peints Colibri au gabarit WALLPAPER de Wizart.
 *
 * Usage :
 *   pnpm wizart:export-papiers-peints
 *   pnpm wizart:export-papiers-peints --collection papiers-peints --tag "Papier peint"
 *
 * Repérage par défaut (cumulatif, chaque produit garde la trace du critère) :
 *   1. collections dont le titre ou le handle contient « papier(s) peint(s) » ;
 *   2. produits dont le productType contient « papier(s) peint(s) » ;
 *   3. produits portant un tag contenant « papier(s) peint(s) ».
 * Options `--collection <handle>`, `--product-type <valeur>`, `--tag <valeur>`
 * (répétables) : remplacent le repérage par défaut par des critères exacts.
 *
 * Les images Shopify ne sont PAS des textures raccordables : elles sont
 * seulement listées dans le rapport. `product_image` = handle (sans
 * extension), nom attendu du fichier texture fourni par le fabricant.
 *
 * Sorties : scripts/wizart/out/colibri-papiers-peints-squelette.{csv,md}
 */
import path from 'node:path';
import { parseArgs } from 'node:util';

import type { Connection, WallpaperProduct } from './common';

// Import dynamique avec extension : exécuté par Node (type stripping natif),
// qui ne résout pas les imports relatifs sans extension.
const common = (await import(new URL('./common.ts', import.meta.url).href)) as typeof import('./common');

const CSV_FILE = 'colibri-papiers-peints-squelette.csv';
const REPORT_FILE = 'colibri-papiers-peints-squelette.md';

/**
 * Metafields candidats (namespace.key), lus dans l'ordre : le premier non vide
 * l'emporte. Ils doivent être exposés au Storefront API dans l'admin Shopify
 * (Paramètres → Données personnalisées → accès Storefront), sinon ils
 * remontent vides.
 */
const PRODUCT_WIDTH_KEYS = [
  'custom.largeur',
  'custom.largeur_rouleau',
  'custom.largeur_lai',
  'custom.laize',
  'custom.product_width',
] as const;
const REPEAT_WIDTH_KEYS = [
  'custom.raccord',
  'custom.largeur_raccord',
  'custom.raccord_motif',
  'custom.repeat',
  'custom.repeat_width',
] as const;

const METAFIELD_IDENTIFIERS = [...PRODUCT_WIDTH_KEYS, ...REPEAT_WIDTH_KEYS]
  .map((id) => {
    const [namespace, key] = id.split('.');
    return `{ namespace: "${namespace}", key: "${key}" }`;
  })
  .join(', ');

const PRODUCT_FIELDS = `
  handle
  title
  productType
  tags
  featuredImage { url }
  images(first: 20) { nodes { url } }
  collections(first: 20) { nodes { title handle } }
  metafields(identifiers: [${METAFIELD_IDENTIFIERS}]) { namespace key value type }
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
  featuredImage: { url: string } | null;
  images: { nodes: { url: string }[] };
  collections: { nodes: CollectionRef[] };
  metafields: ({ namespace: string; key: string; value: string; type: string } | null)[];
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

interface Criteria {
  custom: boolean;
  collections: string[];
  productTypes: string[];
  tags: string[];
}

function readCriteria(): Criteria {
  const { values } = parseArgs({
    options: {
      collection: { type: 'string', multiple: true },
      'product-type': { type: 'string', multiple: true },
      tag: { type: 'string', multiple: true },
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
  };
}

/** Échappe une valeur pour la syntaxe de recherche Shopify (`champ:"valeur"`). */
function searchTerm(field: string, value: string): string {
  return `${field}:"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function readMetafield(product: ProductNode, keys: readonly string[]): { key: string; value: string } | null {
  for (const id of keys) {
    const found = product.metafields.find((m) => m && `${m.namespace}.${m.key}` === id && m.value);
    if (found) return { key: id, value: found.value };
  }
  return null;
}

async function main(): Promise<void> {
  const criteria = readCriteria();
  const shopifyFetch = await common.loadShopifyClient();
  const detected = new Map<string, Detected>();
  const add = (product: ProductNode, criterion: string) => {
    const entry = detected.get(product.handle) ?? { product, criteria: new Set<string>() };
    entry.criteria.add(criterion);
    detected.set(product.handle, entry);
  };

  // 1. Collections
  let wallpaperCollections: CollectionRef[];
  if (criteria.custom) {
    wallpaperCollections = criteria.collections.map((handle) => ({ title: handle, handle }));
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
  const productTypes = criteria.custom ? criteria.productTypes : ['Papier peint', 'Papiers peints'];
  const tags = criteria.custom ? criteria.tags : ['Papier peint', 'Papiers peints'];
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
      const typeMatch = criteria.custom
        ? productTypes.some((t) => sameLabel(t, product.productType))
        : common.isWallpaperLabel(product.productType);
      if (typeMatch) add(product, `productType:${product.productType}`);
      const matchingTags = product.tags.filter((tag) =>
        criteria.custom ? tags.some((t) => sameLabel(t, tag)) : common.isWallpaperLabel(tag),
      );
      for (const tag of matchingTags) add(product, `tag:${tag}`);
    }
  }

  const wallpaperHandles = new Set(wallpaperCollections.map((c) => c.handle));
  const entries = [...detected.values()].sort((a, b) => a.product.title.localeCompare(b.product.title, 'fr'));
  const rows: WallpaperProduct[] = [];
  const notes = new Map<string, string[]>();

  for (const { product } of entries) {
    const productNotes: string[] = [];
    // Collection « de gamme » : la première qui n'est pas une collection
    // générique papiers peints ; à défaut la première tout court
    const ranged = product.collections.nodes.filter(
      (c) => !wallpaperHandles.has(c.handle) && !common.isWallpaperLabel(c.title),
    );
    const collection = ranged[0] ?? product.collections.nodes[0];
    if (!collection) productNotes.push('aucune collection : collection_name vide');

    const width = readMetafield(product, PRODUCT_WIDTH_KEYS);
    const repeat = readMetafield(product, REPEAT_WIDTH_KEYS);
    const widthParse = common.parseLengthToMeters(width?.value);
    const repeatParse = common.parseLengthToMeters(repeat?.value);
    if (widthParse.note) productNotes.push(`product_width : ${widthParse.note}${width ? ` (${width.key})` : ''}`);
    if (repeatParse.note) productNotes.push(`repeat_width : ${repeatParse.note}${repeat ? ` (${repeat.key})` : ''}`);
    notes.set(product.handle, productNotes);

    rows.push({
      handle: product.handle,
      title: product.title,
      collectionTitle: collection?.title ?? '',
      productWidth: widthParse.meters,
      repeatWidth: repeatParse.meters,
    });
  }

  const csv = common.toCsv(common.WALLPAPER_COLUMNS, rows.map(common.toWallpaperRow));
  const csvPath = common.writeOutput(CSV_FILE, csv);
  const report = buildReport({ criteria, wallpaperCollections, collectionSizes, productTypes, tags, entries, rows, notes });
  const reportPath = common.writeOutput(REPORT_FILE, report);

  console.log(`✔ ${rows.length} papier(s) peint(s) repéré(s)`);
  console.log(`→ ${path.relative(process.cwd(), csvPath)}`);
  console.log(`→ ${path.relative(process.cwd(), reportPath)}`);
}

function buildReport(input: {
  criteria: Criteria;
  wallpaperCollections: CollectionRef[];
  collectionSizes: Map<string, number>;
  productTypes: string[];
  tags: string[];
  entries: Detected[];
  rows: WallpaperProduct[];
  notes: Map<string, string[]>;
}): string {
  const { mdCell } = common;
  const { criteria, wallpaperCollections, collectionSizes, productTypes, tags, entries, rows, notes } = input;
  const lines: string[] = [];

  lines.push('# Papiers peints Colibri — squelette export Wizart (gabarit WALLPAPER)');
  lines.push('');
  lines.push(`Généré le ${new Date().toISOString()} depuis la Storefront API.`);
  lines.push('');

  lines.push('## Repérage dans Shopify');
  lines.push('');
  lines.push(criteria.custom ? 'Critères fournis en ligne de commande (correspondance exacte) :' : 'Critères par défaut (« papier(s) peint(s) », insensible à la casse) :');
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

  const byCriterion = new Map<string, number>();
  for (const entry of entries) {
    for (const criterion of entry.criteria) byCriterion.set(criterion, (byCriterion.get(criterion) ?? 0) + 1);
  }
  lines.push('Produits repérés par critère :');
  lines.push('');
  if (byCriterion.size === 0) {
    lines.push('- aucun produit repéré : préciser le mode de repérage avec `--collection`, `--product-type` ou `--tag`.');
  } else {
    for (const [criterion, count] of [...byCriterion].sort((a, b) => b[1] - a[1])) {
      lines.push(`- \`${mdCell(criterion)}\` : ${count}`);
    }
  }
  lines.push('');

  lines.push(`## Lignes exportées (${rows.length})`);
  lines.push('');
  if (rows.length > 0) {
    lines.push('| Produit | Handle | Collection | product_width (m) | repeat_width (m) | Signalements |');
    lines.push('| --- | --- | --- | ---: | ---: | --- |');
    for (const row of rows) {
      lines.push(
        `| ${mdCell(row.title)} | \`${row.handle}\` | ${mdCell(row.collectionTitle)} | ${common.formatMeters(row.productWidth)} | ${common.formatMeters(row.repeatWidth)} | ${mdCell((notes.get(row.handle) ?? []).join(' ; '))} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Textures');
  lines.push('');
  lines.push(
    "Les textures raccordables viennent du fournisseur : un fichier par produit, nommé d'après la colonne `product_image` (= handle) avec son extension.",
  );
  lines.push('Les images Shopify ci-dessous sont des visuels produits (photos, mises en situation), listées pour information : ne pas les utiliser comme textures.');
  lines.push('');
  for (const { product } of entries) {
    const urls = [
      ...new Set([product.featuredImage?.url, ...product.images.nodes.map((image) => image.url)].filter((url): url is string => Boolean(url))),
    ];
    lines.push(`- \`${product.handle}\`${urls.length === 0 ? ' : aucune image' : ''}`);
    for (const url of urls) lines.push(`  - ${url}`);
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
