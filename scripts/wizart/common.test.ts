import { describe, expect, it } from 'vitest';

import {
  PAINT_COLUMNS,
  buildPaintSample,
  csvCell,
  normalizeHex,
  parseLengthToMeters,
  pickExtremesAndMedian,
  relativeLuminance,
  toCsv,
  toPaintRow,
  toWallpaperRow,
  type CollectionShades,
  type ShadeCandidate,
} from './common';

function shade(handle: string, hex: string): ShadeCandidate {
  return { handle, title: handle, hex, imageUrl: null };
}

describe('normalizeHex', () => {
  it('normalise en #RRGGBB majuscule', () => {
    expect(normalizeHex('#a1b2c3')).toBe('#A1B2C3');
    expect(normalizeHex(' a1b2c3 ')).toBe('#A1B2C3');
    expect(normalizeHex('#fff')).toBe('#FFFFFF');
  });

  it('rejette les valeurs invalides ou absentes', () => {
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('rouge')).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('vaut 1 pour le blanc et 0 pour le noir', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1);
    expect(relativeLuminance('#000000')).toBeCloseTo(0);
  });

  it('pondère le vert plus que le bleu', () => {
    expect(relativeLuminance('#00FF00')).toBeGreaterThan(relativeLuminance('#0000FF'));
  });
});

describe('pickExtremesAndMedian', () => {
  it('retient la plus claire, la médiane et la plus foncée', () => {
    const picks = pickExtremesAndMedian([
      shade('gris', '#808080'),
      shade('noir', '#000000'),
      shade('blanc', '#FFFFFF'),
      shade('gris-clair', '#C0C0C0'),
      shade('gris-fonce', '#404040'),
    ]);
    expect(picks.map((p) => [p.shade.handle, p.role])).toEqual([
      ['blanc', 'plus claire'],
      ['gris', 'médiane'],
      ['noir', 'plus foncée'],
    ]);
  });

  it('ne duplique pas une teinte quand la collection en compte moins de 3', () => {
    expect(pickExtremesAndMedian([shade('seule', '#123456')])).toHaveLength(1);
    expect(pickExtremesAndMedian([shade('a', '#FFFFFF'), shade('b', '#000000')]).map((p) => p.role)).toEqual([
      'plus claire',
      'plus foncée',
    ]);
    expect(pickExtremesAndMedian([])).toEqual([]);
  });
});

describe('buildPaintSample', () => {
  const collection = (title: string, count: number): CollectionShades => ({
    title,
    handle: title.toLowerCase().replace(/\s+/g, '-'),
    shades: Array.from({ length: count }, (_, i) => {
      const level = Math.round((255 * i) / Math.max(1, count - 1))
        .toString(16)
        .padStart(2, '0');
      return shade(`${title}-${i}`.toLowerCase().replace(/\s+/g, '-'), `#${level}${level}${level}`);
    }),
  });

  it('prend 3 teintes par collection, regroupées par collection', () => {
    const { rows, droppedByCap } = buildPaintSample([collection('Les Verts', 6), collection('Les Bleus', 4)]);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.collectionTitle)).toEqual([
      'Les Bleus',
      'Les Bleus',
      'Les Bleus',
      'Les Verts',
      'Les Verts',
      'Les Verts',
    ]);
    expect(droppedByCap).toEqual([]);
  });

  it('plafonne en tourniquet pour représenter chaque collection', () => {
    const collections = Array.from({ length: 12 }, (_, i) => collection(`Les C${String(i).padStart(2, '0')}`, 5));
    const { rows, droppedByCap, picksBeforeCap } = buildPaintSample(collections, 3, 30);
    expect(picksBeforeCap).toBe(36);
    expect(rows).toHaveLength(30);
    expect(droppedByCap).toHaveLength(6);
    // Toutes les collections gardent au moins leurs 2 premières teintes
    expect(new Set(rows.map((r) => r.collectionTitle)).size).toBe(12);
    expect(droppedByCap.every((s) => s.role === 'plus foncée')).toBe(true);
  });

  it("n'exporte un handle qu'une fois s'il appartient à plusieurs collections", () => {
    const partage = shade('partage', '#FFFFFF');
    const { rows, duplicates } = buildPaintSample([
      { title: 'Les Blancs', handle: 'les-blancs', shades: [partage, shade('b2', '#EEEEEE')] },
      { title: 'Les Neutres', handle: 'les-neutres', shades: [partage, shade('n2', '#888888')] },
    ]);
    expect(rows.filter((r) => r.handle === 'partage')).toHaveLength(1);
    expect(duplicates).toEqual([{ handle: 'partage', collectionTitle: 'Les Neutres', keptIn: 'Les Blancs' }]);
  });
});

describe('CSV', () => {
  it('échappe séparateur, guillemets et sauts de ligne', () => {
    expect(csvCell('simple')).toBe('simple');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('dit "bleu"')).toBe('"dit ""bleu"""');
    expect(csvCell('a;b', ';')).toBe('"a;b"');
  });

  it('produit une ligne PAINT avec render_color et sans product_image ni prix', () => {
    const [selected] = buildPaintSample([
      { title: 'Les Bleus', handle: 'les-bleus', shades: [shade('bleu-nuit', '#1A2B3C')] },
    ]).rows;
    const row = toPaintRow(selected);
    expect(row).toMatchObject({
      brand_name: 'Colibri Peinture',
      collection_name: 'Les Bleus',
      unique_SKU_ID: 'bleu-nuit',
      render_color: '#1A2B3C',
      product_link: 'https://www.colibripeinture.com/products/bleu-nuit',
      pattern_width: '1',
      price: '',
      description: '',
      product_image: '',
    });
    const csv = toCsv(PAINT_COLUMNS, [row]);
    expect(csv.split('\r\n')[0]).toBe(PAINT_COLUMNS.join(','));
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

describe('parseLengthToMeters', () => {
  it('convertit un metafield dimension', () => {
    expect(parseLengthToMeters('{"value":53,"unit":"cm"}')).toEqual({ meters: 0.53, note: null });
    expect(parseLengthToMeters('{"value":0.7,"unit":"m"}')).toEqual({ meters: 0.7, note: null });
  });

  it('convertit un texte avec unité', () => {
    expect(parseLengthToMeters('53 cm').meters).toBe(0.53);
    expect(parseLengthToMeters('0,53 m').meters).toBe(0.53);
    expect(parseLengthToMeters('640mm').meters).toBe(0.64);
  });

  it("signale l'unité supposée quand elle est absente", () => {
    expect(parseLengthToMeters('53')).toMatchObject({ meters: 0.53 });
    expect(parseLengthToMeters('53').note).toMatch(/centimètres supposés/);
    expect(parseLengthToMeters('0.53').note).toMatch(/mètres supposés/);
  });

  it('laisse vide et signale une valeur absente ou illisible', () => {
    expect(parseLengthToMeters(null)).toEqual({ meters: null, note: 'metafield absent' });
    expect(parseLengthToMeters('10,05 x 0,53 m').meters).toBeNull();
    expect(parseLengthToMeters('{"value":53,"unit":"pouces-romains"}').meters).toBeNull();
  });
});

describe('toWallpaperRow', () => {
  it('utilise le handle comme identifiant et nom de texture sans extension', () => {
    expect(
      toWallpaperRow({
        handle: 'papier-peint-jungle',
        title: 'Papier peint Jungle',
        collectionTitle: 'Tropical',
        productWidth: 0.53,
        repeatWidth: null,
      }),
    ).toEqual({
      brand_name: 'Colibri Peinture',
      collection_name: 'Tropical',
      product_name: 'Papier peint Jungle',
      unique_sku_id: 'papier-peint-jungle',
      product_image: 'papier-peint-jungle',
      product_width: '0.53',
      repeat_width: '',
    });
  });
});
