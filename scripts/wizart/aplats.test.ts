import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { APLAT_SIZE, crc32, hexToRgb, solidPng, zipStore } from './aplats';

/** Lecteur ZIP minimal pour les tests : répertoire central + en-têtes locaux. */
function readZip(archive: Buffer): { name: string; method: number; data: Buffer; crc: number }[] {
  const endOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(endOffset).toBeGreaterThanOrEqual(0);
  const count = archive.readUInt16LE(endOffset + 10);
  let cursor = archive.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    expect(archive.readUInt32LE(cursor)).toBe(0x02014b50);
    const method = archive.readUInt16LE(cursor + 10);
    const crc = archive.readUInt32LE(cursor + 16);
    const size = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    expect(archive.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    expect(archive.toString('utf8', localOffset + 30, localOffset + 30 + localNameLength)).toBe(name);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = archive.subarray(dataStart, dataStart + size);

    entries.push({ name, method, data, crc });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Décode un PNG RGB 8 bits non filtré (format produit par `solidPng`). */
function readPng(png: Buffer): { width: number; height: number; colorType: number; pixels: Buffer } {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    // CRC de chaque chunk (type + données)
    expect(png.readUInt32BE(offset + 8 + length)).toBe(crc32(png.subarray(offset + 4, offset + 8 + length)));
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect(body[8]).toBe(8);
      colorType = body[9];
    }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return { width, height, colorType, pixels: inflateSync(Buffer.concat(idat)) };
}

describe('crc32', () => {
  it('donne la valeur de référence IEEE', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe('hexToRgb', () => {
  it('convertit #RRGGBB', () => {
    expect(hexToRgb('#1A2B3C')).toEqual([0x1a, 0x2b, 0x3c]);
  });

  it('refuse un hex non normalisé', () => {
    expect(() => hexToRgb('#abc')).toThrow();
    expect(() => hexToRgb('bleu')).toThrow();
  });
});

describe('solidPng', () => {
  it('produit un PNG 1000×1000 RGB uni de la couleur demandée', () => {
    const { width, height, colorType, pixels } = readPng(solidPng('#1A2B3C'));
    expect([width, height]).toEqual([APLAT_SIZE, APLAT_SIZE]);
    expect(APLAT_SIZE).toBe(1000);
    expect(colorType).toBe(2); // RGB, sans alpha

    const rowLength = 1 + width * 3;
    expect(pixels.length).toBe(rowLength * height);
    for (let y = 0; y < height; y++) {
      expect(pixels[y * rowLength]).toBe(0); // filtre « aucun »
    }
    // Pixels échantillonnés : coins, centre, dernier
    for (const [x, y] of [
      [0, 0],
      [999, 0],
      [500, 500],
      [0, 999],
      [999, 999],
    ]) {
      const index = y * rowLength + 1 + x * 3;
      expect([...pixels.subarray(index, index + 3)]).toEqual([0x1a, 0x2b, 0x3c]);
    }
  });

  it('reste léger grâce à la compression DEFLATE', () => {
    expect(solidPng('#FFFFFF').length).toBeLessThan(20_000);
  });
});

describe('zipStore', () => {
  const teintes = [
    { handle: 'bleu-nuit', hex: '#1A2B3C' },
    { handle: 'blanc-pur', hex: '#F4F1EE' },
    { handle: 'rouge-brique', hex: '#8C2F1B' },
  ];
  const archive = zipStore(teintes.map((t) => ({ name: `${t.handle}.png`, data: solidPng(t.hex) })));

  it("s'ouvre avec le bon nombre d'entrées, des noms {handle}.png et sans dossier", () => {
    const entries = readZip(archive);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.name)).toEqual(['bleu-nuit.png', 'blanc-pur.png', 'rouge-brique.png']);
    expect(entries.every((e) => !e.name.includes('/'))).toBe(true);
  });

  it('stocke les entrées sans compression, CRC32 exacts, PNG lisibles', () => {
    for (const [i, entry] of readZip(archive).entries()) {
      expect(entry.method).toBe(0);
      expect(entry.crc).toBe(crc32(entry.data));
      const { width, pixels } = readPng(entry.data);
      expect(width).toBe(1000);
      expect([...pixels.subarray(1, 4)]).toEqual(hexToRgb(teintes[i].hex));
    }
  });

  it('est déterministe', () => {
    const again = zipStore(teintes.map((t) => ({ name: `${t.handle}.png`, data: solidPng(t.hex) })));
    expect(again.equals(archive)).toBe(true);
  });

  it('refuse les dossiers et les doublons', () => {
    const data = Buffer.from('x');
    expect(() => zipStore([{ name: 'dossier/teinte.png', data }])).toThrow();
    expect(() => zipStore([{ name: 'a.png', data }, { name: 'a.png', data }])).toThrow();
  });
});
