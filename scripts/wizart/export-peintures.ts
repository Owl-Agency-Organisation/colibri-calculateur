/**
 * Export d'un échantillon de teintes Colibri au gabarit PAINT de Wizart.
 *
 * Usage : pnpm wizart:export-peintures
 *
 * Source : Storefront API (variables de `.env.local`), collections
 * `title:Les *` hors laques et sélections thématiques
 * (`PAINT_EXCLUDED_COLLECTIONS`), produits paginés par curseur. Pour chaque
 * collection : teinte la plus claire, la plus foncée et la médiane (luminance
 * calculée depuis le metafield `custom.code_hexadecimal`), plafond
 * `PAINT_SAMPLE_MAX_ROWS` lignes.
 *
 * Sorties : scripts/wizart/out/colibri-peintures-echantillon.{csv,md}
 */
import path from 'node:path';

import type {
  CollectionShades,
  Connection,
  SampleResult,
  ShadeCandidate,
} from './common';

// Import dynamique avec extension : exécuté par Node (type stripping natif),
// qui ne résout pas les imports relatifs sans extension.
const common = (await import(new URL('./common.ts', import.meta.url).href)) as typeof import('./common');

const CSV_FILE = 'colibri-peintures-echantillon.csv';
const REPORT_FILE = 'colibri-peintures-echantillon.md';

const COLLECTIONS_QUERY = `
  query WizartPaintCollections($after: String) {
    collections(first: 50, after: $after, query: "title:Les *") {
      pageInfo { hasNextPage endCursor }
      nodes { id title handle }
    }
  }
`;

const COLLECTION_PRODUCTS_QUERY = `
  query WizartPaintProducts($handle: String!, $after: String) {
    collection(handle: $handle) {
      products(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          handle
          title
          featuredImage { url }
          metafield(namespace: "custom", key: "code_hexadecimal") { value }
        }
      }
    }
  }
`;

interface CollectionNode {
  id: string;
  title: string;
  handle: string;
}

interface ProductNode {
  handle: string;
  title: string;
  featuredImage: { url: string } | null;
  metafield: { value: string } | null;
}

interface CollectionsData {
  collections: Connection<CollectionNode>;
}

interface CollectionProductsData {
  collection: { products: Connection<ProductNode> } | null;
}

interface Exclusion {
  collectionTitle: string;
  handle: string;
  title: string;
  reason: string;
}

async function main(): Promise<void> {
  const shopifyFetch = await common.loadShopifyClient();

  const allCollections = await common.fetchAllPages<CollectionsData, CollectionNode>(
    shopifyFetch,
    COLLECTIONS_QUERY,
    {},
    (data) => data.collections,
  );
  // La recherche Storefront est permissive : on ne garde que les titres « Les … »
  const lesCollections = allCollections.filter((c) => /^Les\s/i.test(c.title));
  const ignoredCollections = allCollections.filter((c) => !/^Les\s/i.test(c.title));
  // Laques (bois et métal) et sélections thématiques transverses : hors échantillon
  const excludedCollections = lesCollections.filter((c) => common.PAINT_EXCLUDED_COLLECTIONS.test(c.title));
  const collections = lesCollections.filter((c) => !common.PAINT_EXCLUDED_COLLECTIONS.test(c.title));

  const shadesByCollection: CollectionShades[] = [];
  const exclusions: Exclusion[] = [];
  const productCounts = new Map<string, number>();

  for (const collection of collections) {
    const products = await common.fetchAllPages<CollectionProductsData, ProductNode>(
      shopifyFetch,
      COLLECTION_PRODUCTS_QUERY,
      { handle: collection.handle },
      (data) => data.collection?.products,
    );
    productCounts.set(collection.title, products.length);

    const shades: ShadeCandidate[] = [];
    for (const product of products) {
      const raw = product.metafield?.value;
      const hex = common.normalizeHex(raw);
      if (!hex) {
        exclusions.push({
          collectionTitle: collection.title,
          handle: product.handle,
          title: product.title,
          reason: raw ? `hex invalide « ${raw} »` : 'metafield custom.code_hexadecimal absent',
        });
        continue;
      }
      shades.push({
        handle: product.handle,
        title: product.title,
        hex,
        imageUrl: product.featuredImage?.url ?? null,
      });
    }
    shadesByCollection.push({ title: collection.title, handle: collection.handle, shades });
  }

  const sample = common.buildPaintSample(shadesByCollection);
  const csv = common.toCsv(common.PAINT_COLUMNS, sample.rows.map(common.toPaintRow));
  const csvPath = common.writeOutput(CSV_FILE, csv);

  const report = buildReport({
    collections: shadesByCollection,
    productCounts,
    ignoredCollections,
    excludedCollections,
    exclusions,
    sample,
  });
  const reportPath = common.writeOutput(REPORT_FILE, report);

  console.log(`✔ ${sample.rows.length} teinte(s) exportée(s) depuis ${collections.length} collection(s)`);
  console.log(`✔ ${exclusions.length} produit(s) exclu(s) (hex absent ou invalide)`);
  console.log(`→ ${path.relative(process.cwd(), csvPath)}`);
  console.log(`→ ${path.relative(process.cwd(), reportPath)}`);
}

function buildReport(input: {
  collections: CollectionShades[];
  productCounts: Map<string, number>;
  ignoredCollections: CollectionNode[];
  excludedCollections: CollectionNode[];
  exclusions: Exclusion[];
  sample: SampleResult;
}): string {
  const { mdCell } = common;
  const { collections, productCounts, ignoredCollections, excludedCollections, exclusions, sample } = input;
  const lines: string[] = [];

  lines.push('# Échantillon teintes Colibri — export Wizart (gabarit PAINT)');
  lines.push('');
  lines.push(`Généré le ${new Date().toISOString()} depuis la Storefront API.`);
  lines.push(
    `Règle : par collection « Les … », teinte la plus claire, médiane et la plus foncée (luminance relative WCAG calculée depuis le hex), plafond ${common.PAINT_SAMPLE_MAX_ROWS} lignes.`,
  );
  lines.push('');
  lines.push(`**${sample.rows.length} teinte(s)** exportée(s) dans \`${CSV_FILE}\`.`);
  lines.push('');

  lines.push('## Teintes par collection');
  lines.push('');
  lines.push('| Collection | Produits | Hex valides | Exportées |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const collection of [...collections].sort((a, b) => a.title.localeCompare(b.title, 'fr'))) {
    const exported = sample.rows.filter((row) => row.collectionTitle === collection.title).length;
    lines.push(
      `| ${mdCell(collection.title)} | ${productCounts.get(collection.title) ?? 0} | ${collection.shades.length} | ${exported} |`,
    );
  }
  lines.push('');

  lines.push('## Échantillon exporté');
  lines.push('');
  lines.push('| Collection | Teinte | Rôle | Hex | Luminance | Handle |');
  lines.push('| --- | --- | --- | --- | ---: | --- |');
  for (const row of sample.rows) {
    lines.push(
      `| ${mdCell(row.collectionTitle)} | ${mdCell(row.title)} | ${row.role} | \`${row.hex}\` | ${row.luminance.toFixed(3)} | \`${row.handle}\` |`,
    );
  }
  lines.push('');

  lines.push('## Exclusions');
  lines.push('');
  if (exclusions.length === 0) {
    lines.push('Aucun produit exclu : tous les produits ont un hex valide.');
  } else {
    lines.push('Produits sans `custom.code_hexadecimal` exploitable (non éligibles à `render_color`) :');
    lines.push('');
    lines.push('| Collection | Produit | Handle | Raison |');
    lines.push('| --- | --- | --- | --- |');
    for (const exclusion of exclusions) {
      lines.push(
        `| ${mdCell(exclusion.collectionTitle)} | ${mdCell(exclusion.title)} | \`${exclusion.handle}\` | ${mdCell(exclusion.reason)} |`,
      );
    }
  }
  lines.push('');

  if (sample.duplicates.length > 0) {
    lines.push('## Produits présents dans plusieurs collections');
    lines.push('');
    lines.push("Un handle n'est exporté qu'une fois (identifiant unique Wizart) :");
    lines.push('');
    for (const duplicate of sample.duplicates) {
      lines.push(
        `- \`${duplicate.handle}\` écarté de « ${mdCell(duplicate.collectionTitle)} », déjà retenu dans « ${mdCell(duplicate.keptIn)} »`,
      );
    }
    lines.push('');
  }

  if (sample.droppedByCap.length > 0) {
    lines.push('## Écartées par le plafond');
    lines.push('');
    for (const shade of sample.droppedByCap) {
      lines.push(`- ${mdCell(shade.collectionTitle)} — ${mdCell(shade.title)} (${shade.role}, \`${shade.handle}\`)`);
    }
    lines.push('');
  }

  if (excludedCollections.length > 0) {
    lines.push('## Collections « Les … » hors échantillon');
    lines.push('');
    lines.push('Laques bois et métal (hors murs) et sélections thématiques transverses (Pastels, Peps, Tendances), dont les teintes appartiennent déjà aux familles de couleurs :');
    lines.push('');
    for (const collection of excludedCollections) {
      lines.push(`- ${mdCell(collection.title)} (\`${collection.handle}\`)`);
    }
    lines.push('');
  }

  if (ignoredCollections.length > 0) {
    lines.push('## Collections renvoyées par la recherche mais ignorées');
    lines.push('');
    lines.push('Titre ne commençant pas par « Les » :');
    lines.push('');
    for (const collection of ignoredCollections) {
      lines.push(`- ${mdCell(collection.title)} (\`${collection.handle}\`)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

try {
  await main();
} catch (error) {
  console.error(`✖ Export peintures interrompu : ${common.formatError(error)}`);
  process.exitCode = 1;
}
