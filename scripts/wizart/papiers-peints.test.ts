import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WALLPAPER_EXPORT_COLUMNS,
  buildWallpaperVariantRows,
  compareTextures,
  isLeVariant,
  parseLeSize,
  parseWallpaperManualData,
  patternOffset,
  toCsv,
  wallpaperProductName,
  type WallpaperVariantSource,
} from './common';

/** Les 3 papiers peints de la boutique, relevés sur l'Admin API (option « Taille » corrigée le 22/10/2026) */
function produit(handle: string, title: string, largeur: number, coloris: [string, string, string][]): WallpaperVariantSource {
  return {
    handle,
    title,
    variants: coloris.flatMap(([couleur, code, id]) => [
      {
        id: `gid://shopify/ProductVariant/${id}`,
        sku: `${code}-le`,
        selectedOptions: [{ name: 'Couleur', value: couleur }, { name: 'Taille', value: `Lé : ${largeur}x280cm` }],
      },
      {
        id: `gid://shopify/ProductVariant/${id}0`,
        sku: `${code}-ech`,
        selectedOptions: [{ name: 'Couleur', value: couleur }, { name: 'Taille', value: 'Echantillon : A4' }],
      },
    ]),
  };
}

const PRODUITS: WallpaperVariantSource[] = [
  produit('papier-peint-montgolfiere', 'Montgolfières - Papier peint écologique enfant', 53, [
    ['Terracotta', 'pp-montg-terracotta', '57106064965977'],
    ['Blanc', 'pp-montg-blanc', '57106064933209'],
    ['Rose', 'pp-montg-rose', '57106064998745'],
    ['Bleu', 'pp-montg-bleu', '57106065031513'],
  ]),
  produit('rayures-papier-peint-ecologique', 'Rayures - Papier peint écologique', 53, [
    ['Rayures bleues', 'pp-rayur-bleu', '57166674919769'],
    ['Rayures jaunes', 'pp-rayur-jaune', '57166674723161'],
    ['Rayures terracotta', 'pp-rayur-terracotta', '57166674788697'],
    ['Rayures vertes', 'pp-rayur-vert', '57166674854233'],
  ]),
  produit('ombrelle-papier-peint-ecologique', 'Ombrelle - Papier peint écologique', 53, [
    ['Ombrelle bleu nuit', 'pp-ombre-bleunuit', '57173225832793'],
    ['Ombrelle vert forêt', 'pp-ombre-vertforet', '57173225898329'],
    ['Ombrelle bleue', 'pp-ombre-bleu', '57173225963865'],
    ['Ombrelle jaune', 'pp-ombre-jaune', '57173226029401'],
  ]),
];

const MANUEL = parseWallpaperManualData(readFileSync(path.join(__dirname, 'papiers-peints.json'), 'utf8')).data;

describe('export WALLPAPER — une ligne par coloris', () => {
  it('12 lignes, une par variante « Lé », SKU comme identifiant et nom de texture', () => {
    const { rows, skipped, unusedManual } = buildWallpaperVariantRows(PRODUITS, MANUEL);
    expect(rows).toHaveLength(12);
    expect(skipped).toEqual([]);
    expect(unusedManual).toEqual([]);
    expect(rows.map((r) => r.row.unique_sku_id)).toEqual(Object.keys(MANUEL));
    expect(rows.every((r) => r.row.product_image === r.row.unique_sku_id)).toBe(true);
    expect(rows.some((r) => r.sku.endsWith('-ech'))).toBe(false);
  });

  it('lé de 53 × 280 cm (confirmé le 22/10/2026) : product_width 0.53, wallpaper_roll_length 2.8', () => {
    const { rows } = buildWallpaperVariantRows(PRODUITS, MANUEL);
    expect(rows.every((r) => r.row.product_width === '0.53' && r.row.wallpaper_roll_length === '2.8')).toBe(true);
  });

  it('largeur et longueur suivent l’option « Taille » de chaque produit', () => {
    const source = produit('test', 'Test - Papier peint', 60, [['Bleu', 'pp-test-bleu', '1']]);
    source.variants[0].selectedOptions[1].value = 'Lé : 60x1000cm';
    const { rows } = buildWallpaperVariantRows([source], MANUEL);
    expect(rows[0].row).toMatchObject({ product_width: '0.6', wallpaper_roll_length: '10' });
  });

  it('dimensions illisibles : product_width et wallpaper_roll_length vides, signalées', () => {
    const source = produit('test', 'Test - Papier peint', 53, [['Bleu', 'pp-test-bleu', '1']]);
    source.variants[0].selectedOptions[1].value = 'Lé : grand format';
    const { rows } = buildWallpaperVariantRows([source], MANUEL);
    expect(rows[0].row).toMatchObject({ product_width: '', wallpaper_roll_length: '' });
    expect(rows[0].notes[0]).toContain('dimensions illisibles');
  });

  it('ligne complète : 35 colonnes, valeurs par défaut, prix et colonnes non renseignées vides', () => {
    const { rows } = buildWallpaperVariantRows(PRODUITS, MANUEL);
    const vides = Object.fromEntries(WALLPAPER_EXPORT_COLUMNS.map((c) => [c, '']));
    expect(rows[0].row).toEqual({
      ...vides,
      brand_name: 'Colibri Peinture',
      collection_name: 'Papiers peints',
      product_name: 'Montgolfières - Terracotta',
      unique_sku_id: 'pp-montg-terracotta-le',
      product_image: 'pp-montg-terracotta-le',
      product_width: '0.53',
      repeat_width: '0.53',
      pattern_repeat: '0.64',
      pattern_offset: '0',
      product_link: 'https://www.colibripeinture.com/products/papier-peint-montgolfiere?variant=57106064965977',
      product_regular_price: '',
      product_promotional_price: '',
      wallpaper_roll_length: '2.8',
      reverse: 'no',
      mural: 'no',
      product_layout: 'vertical',
      application_surface: 'wall',
    });
    expect(Object.keys(rows[0].row)).toHaveLength(35);
    expect(rows.every((r) => r.row.product_link.includes('?variant='))).toBe(true);
    expect(rows.find((r) => r.sku === 'pp-rayur-bleu-le')?.row.product_name).toBe('Rayures bleues');
  });

  it('entrée du JSON manuel absente : cellules vides et signalement', () => {
    const { 'pp-montg-blanc-le': _retire, ...partiel } = MANUEL;
    const { rows, unusedManual } = buildWallpaperVariantRows(PRODUITS, partiel);
    const blanc = rows.find((r) => r.sku === 'pp-montg-blanc-le');
    expect(blanc?.row.repeat_width).toBe('');
    expect(blanc?.notes).toContain('papiers-peints.json : entrée absente (repeat_width, pattern_repeat, pattern_offset vides)');
    expect(unusedManual).toEqual([]);
  });

  it('valeurs non renseignées (null) : signalées, repeat_width marqué requis', () => {
    const vide = { largeurMotif: null, hauteurRaccord: null, raccord: null, decalage: null };
    const { rows } = buildWallpaperVariantRows(PRODUITS, { ...MANUEL, 'pp-montg-terracotta-le': vide });
    expect(rows[0].row.repeat_width).toBe('');
    expect(rows[0].notes).toContain('repeat_width (requis par Wizart) : largeurMotif non renseignée');
  });

  it('fichier manuel du 22/10/2026 : motif utile 53 × 64 cm, raccord droit, aucun signalement', () => {
    const { rows } = buildWallpaperVariantRows(PRODUITS, MANUEL);
    expect(rows.every((r) => r.row.repeat_width === '0.53' && r.row.pattern_repeat === '0.64' && r.row.pattern_offset === '0'))
      .toBe(true);
    expect(rows.flatMap((r) => r.notes)).toEqual([]);
  });

  it('raccord renseigné : repeat_width, pattern_repeat et pattern_offset', () => {
    const manuel = {
      ...MANUEL,
      'pp-montg-terracotta-le': { largeurMotif: 0.6, hauteurRaccord: 0.64, raccord: 'saute' as const, decalage: null },
      'pp-rayur-bleu-le': { largeurMotif: 0.6, hauteurRaccord: 0.5, raccord: 'droit' as const, decalage: null },
    };
    const { rows } = buildWallpaperVariantRows(PRODUITS, manuel);
    const montgolfiere = rows.find((r) => r.sku === 'pp-montg-terracotta-le');
    expect(montgolfiere?.row).toMatchObject({ repeat_width: '0.6', pattern_repeat: '0.64', pattern_offset: '0.32' });
    expect(montgolfiere?.notes).toEqual([]);
    expect(rows.find((r) => r.sku === 'pp-rayur-bleu-le')?.row.pattern_offset).toBe('0');
  });

  it('CSV : en-tête exact des 35 colonnes du mapping « default » Wallpaper, une ligne par coloris', () => {
    const { rows } = buildWallpaperVariantRows(PRODUITS, MANUEL);
    const csv = toCsv(WALLPAPER_EXPORT_COLUMNS, rows.map((r) => r.row));
    const lignes = csv.trimEnd().split('\r\n');
    expect(lignes).toHaveLength(13);
    expect(lignes[0]).toBe(
      'brand_name,collection_name,product_name,unique_sku_id,product_image,product_width,repeat_width,'
      + 'pattern_repeat,pattern_offset,product_link,product_regular_price,product_promotional_price,'
      + 'wallpaper_roll_length,color,base,coating,interior_type,style,pattern,product_description,texture,'
      + 'country_of_origin,removal_type,product_transparency,reverse,mural,product_availability,product_layout,'
      + 'application_surface,product_context,context_currency,features,pattern_scale,installation_method,'
      + 'additional_data',
    );
    expect(lignes[0].split(',')).toHaveLength(35);
    expect(lignes.slice(1).every((ligne) => ligne.split(',').length === 35)).toBe(true);
  });
});

describe('export WALLPAPER — lecture', () => {
  it('lé : largeur et longueur lues dans l’option « Taille »', () => {
    expect(parseLeSize('Lé : 53x280cm')).toEqual({ width: 0.53, length: 2.8 });
    expect(parseLeSize('Lé : 60x280cm')).toEqual({ width: 0.6, length: 2.8 });
    expect(parseLeSize('Lé : 0,53 x 2,8 m')).toEqual({ width: 0.53, length: 2.8 });
    expect(parseLeSize('Lé : 530 x 2800 mm')).toEqual({ width: 0.53, length: 2.8 });
    expect(parseLeSize('Echantillon : A4')).toBeNull();
    expect(isLeVariant([{ name: 'Taille', value: 'Lé : 60x280cm' }])).toBe(true);
    expect(isLeVariant([{ name: 'Taille', value: 'Echantillon : A4' }])).toBe(false);
  });

  it('nom du produit sans répéter le motif', () => {
    expect(wallpaperProductName('Montgolfières', 'Terracotta')).toBe('Montgolfières - Terracotta');
    expect(wallpaperProductName('Ombrelle', 'Ombrelle vert forêt')).toBe('Ombrelle vert forêt');
    expect(wallpaperProductName('Rayures', null)).toBe('Rayures');
  });

  it('décalage : explicite, droit/libre = 0, sauté = moitié du raccord', () => {
    const base = { largeurMotif: null, hauteurRaccord: 0.64, raccord: null, decalage: null };
    expect(patternOffset({ ...base, raccord: 'libre' })).toBe(0);
    expect(patternOffset({ ...base, raccord: 'saute' })).toBe(0.32);
    expect(patternOffset({ ...base, raccord: 'saute', decalage: 0.2 })).toBe(0.2);
    expect(patternOffset({ ...base, raccord: 'saute', hauteurRaccord: null })).toBeNull();
    expect(patternOffset(base)).toBeNull();
  });

  it('fichier manuel : commentaires ignorés, valeurs invalides signalées', () => {
    const { data, notes } = parseWallpaperManualData(JSON.stringify({
      _lisezmoi: 'texte',
      'PP-X-LE': { largeurMotif: '60 cm', hauteurRaccord: 0.5, raccord: 'oblique', decalage: null },
    }));
    expect(Object.keys(data)).toEqual(['pp-x-le']);
    expect(data['pp-x-le']).toEqual({ largeurMotif: null, hauteurRaccord: 0.5, raccord: null, decalage: null });
    expect(notes).toHaveLength(2);
    expect(() => parseWallpaperManualData('[]')).toThrow();
  });

  it('le fichier manuel versionné couvre les 12 SKU, sans aucun prix', () => {
    const brut = readFileSync(path.join(__dirname, 'papiers-peints.json'), 'utf8');
    expect(Object.keys(MANUEL)).toHaveLength(12);
    expect(brut).not.toMatch(/prix|price/i);
  });
});

describe('export WALLPAPER — option --textures', () => {
  const skus = ['pp-montg-terracotta-le', 'pp-montg-blanc-le', 'pp-ombre-bleunuit-le'];

  it('liste les textures manquantes et les fichiers en trop', () => {
    expect(compareTextures(['pp-montg-terracotta-le.png', 'pp-ombre-bleunuit-le.jpg', 'pp-montg-blanc-le.webp', 'notes.txt', '.DS_Store'], skus))
      .toEqual({ missing: ['pp-montg-blanc-le'], extra: ['notes.txt', 'pp-montg-blanc-le.webp'] });
  });

  it('dossier complet : rien de manquant ni en trop', () => {
    expect(compareTextures(skus.map((s) => `${s}.png`), skus)).toEqual({ missing: [], extra: [] });
  });
});
