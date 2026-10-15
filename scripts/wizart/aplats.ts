/**
 * Aplats de couleur pour le PIM Wizart : une image PNG unie par teinte,
 * regroupées dans un ZIP plat.
 *
 * Sans dépendance : encodeur PNG minimal (`node:zlib` pour la compression
 * DEFLATE) et archive ZIP en mode « store » (sans compression, les PNG étant
 * déjà compressés). Module feuille, sans import relatif : il est chargé par
 * import dynamique depuis `export-peintures.ts` (Node, type stripping).
 */
import { deflateSync } from 'node:zlib';

/** Côté des aplats, en pixels (format validé à l'import Wizart). */
export const APLAT_SIZE = 1000;

// ─── CRC32 (polynôme IEEE 802.3, utilisé par PNG et ZIP) ────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── PNG ────────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** Convertit `#RRGGBB` en composantes [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Hex invalide (attendu #RRGGBB) : ${hex}`);
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

/**
 * Encode une image PNG unie, `size`×`size`, RGB 8 bits (sans alpha),
 * non entrelacée, de la couleur `hex` (`#RRGGBB`).
 */
export function solidPng(hex: string, size = APLAT_SIZE): Buffer {
  const [r, g, b] = hexToRgb(hex);

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); // largeur
  header.writeUInt32BE(size, 4); // hauteur
  header[8] = 8; // profondeur : 8 bits par composante
  header[9] = 2; // type de couleur : RGB
  header[10] = 0; // compression : DEFLATE
  header[11] = 0; // filtrage : standard
  header[12] = 0; // pas d'entrelacement

  // Chaque ligne : octet de filtre (0 = aucun) puis size × RGB
  const rowLength = 1 + size * 3;
  const raw = Buffer.alloc(rowLength * size);
  for (let x = 0; x < size; x++) {
    raw[1 + x * 3] = r;
    raw[2 + x * 3] = g;
    raw[3 + x * 3] = b;
  }
  for (let y = 1; y < size; y++) raw.copy(raw, y * rowLength, 0, rowLength);

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── ZIP (mode « store ») ───────────────────────────────────────────────────

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Date DOS fixe (1980-01-01 00:00) : archive identique d'une exécution à l'autre. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
/** Bit 11 : noms de fichiers encodés en UTF-8. */
const UTF8_FLAG = 0x0800;

/**
 * Construit une archive ZIP plate (aucun dossier), entrées stockées sans
 * compression. Les noms doivent être uniques et sans séparateur de chemin.
 */
export function zipStore(entries: ZipEntry[]): Buffer {
  const seen = new Set<string>();
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (!entry.name || /[\\/]/.test(entry.name)) {
      throw new Error(`Nom d'entrée ZIP invalide (archive plate attendue) : « ${entry.name} »`);
    }
    if (seen.has(entry.name)) throw new Error(`Entrée ZIP en double : « ${entry.name} »`);
    seen.add(entry.name);

    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature en-tête local
    local.writeUInt16LE(20, 4); // version minimale : 2.0
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(0, 8); // méthode : store
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // taille compressée
    local.writeUInt32LE(data.length, 22); // taille d'origine
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // champ extra
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature répertoire central
    central.writeUInt16LE(20, 4); // créé par : 2.0
    central.writeUInt16LE(20, 6); // version minimale
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(0, 10); // méthode : store
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    // extra, commentaire, disque, attributs internes/externes : 0
    central.writeUInt32LE(offset, 42); // position de l'en-tête local
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
    if (offset > 0xffffffff) throw new Error('Archive trop volumineuse pour un ZIP sans ZIP64');
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // signature fin de répertoire central
  end.writeUInt16LE(entries.length, 8); // entrées sur ce disque
  end.writeUInt16LE(entries.length, 10); // entrées au total
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16); // début du répertoire central

  return Buffer.concat([...localParts, centralDirectory, end]);
}
