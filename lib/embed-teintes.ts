import { nomCourtTeinte } from '@/lib/couleur';
import { normaliserTeintes } from '@/lib/embed-messages';
import { PARENT_ORIGIN } from '@/lib/navigation';
import { libellePapierPeint, type PapierPeint } from '@/lib/papierPeint';

/**
 * Références de la barre du simulateur (`embed/colibri.js`) :
 * `GET /api/embed/teintes?handles=r1,r2` → `[{ handle, nom, hex, type, image, lien }]`.
 * Une référence est un handle de teinte (couleur lue dans le metafield
 * `custom.code_hexadecimal`) ou un SKU de variante papier peint (image et
 * fiche de la variante). Rien d'autre n'est renvoyé (pas de prix). Logique
 * pure, testée ; la route l'assemble.
 */

export interface TeinteEmbed {
  handle: string;
  nom: string;
  /** `#rrggbb` (ou `#rgb`), null si le metafield est absent ou invalide */
  hex: string | null;
}

export type TypeReference = 'peinture' | 'papier-peint';

/** Référence renvoyée à la barre : teinte (hex) ou papier peint (image, fiche) */
export interface ReferenceEmbed extends TeinteEmbed {
  type: TypeReference;
  /** Image de la variante papier peint, null pour une teinte */
  image: string | null;
  /** Fiche boutique de la variante papier peint, null pour une teinte */
  lien: string | null;
}

/** Produit tel que lu dans la Storefront API (champs utilisés) */
export interface ProduitTeinte {
  handle: string;
  title: string;
  hex: { value: string | null } | null;
}

export const MAX_HANDLES_TEINTES = 50;

const MOTIF_HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Handles demandés : valides, dans l'ordre, sans doublon, bornés. */
export function lireHandlesDemandes(parametre: string | null): string[] {
  return normaliserTeintes((parametre ?? '').split(','), MAX_HANDLES_TEINTES);
}

/** Code hexadécimal normalisé (`#` + minuscules), null s'il est invalide. */
export function normaliserHex(valeur: string | null | undefined): string | null {
  const correspondance = typeof valeur === 'string' ? MOTIF_HEX.exec(valeur.trim()) : null;
  return correspondance ? `#${correspondance[1].toLowerCase()}` : null;
}

/**
 * Origines autorisées : la boutique et l'app elle-même (labo). Sans en-tête
 * `Origin` (requête de même origine, navigation) : autorisé, sans CORS.
 */
export function origineAutorisee(origine: string | null, origineApp: string): boolean {
  return origine === null || origine === PARENT_ORIGIN || origine === origineApp;
}

export function versTeinteEmbed(produit: ProduitTeinte): TeinteEmbed {
  return {
    handle: produit.handle,
    nom: nomCourtTeinte(produit.title),
    hex: normaliserHex(produit.hex?.value),
  };
}

export function versReferencePeinture(produit: ProduitTeinte): ReferenceEmbed {
  return { ...versTeinteEmbed(produit), type: 'peinture', image: null, lien: null };
}

/** Papier peint : `handle` = SKU reçu, nom « {Motif} {Coloris} », sans couleur. */
export function versReferencePapierPeint(papier: PapierPeint): ReferenceEmbed {
  return {
    handle: papier.sku,
    nom: libellePapierPeint(papier.motif, papier.coloris, ' '),
    hex: null,
    type: 'papier-peint',
    image: papier.imageUrl,
    lien: papier.lien,
  };
}

/** Requête Storefront : un alias par handle (variables, jamais d'interpolation de valeur). */
export function requeteTeintes(nombre: number): string {
  const variables = Array.from({ length: nombre }, (_, i) => `$h${i}: String!`).join(', ');
  const champs = Array.from({ length: nombre }, (_, i) =>
    `t${i}: product(handle: $h${i}) { handle title hex: metafield(namespace: "custom", key: "code_hexadecimal") { value } }`,
  ).join('\n');
  return `query TeintesEmbed(${variables}) {\n${champs}\n}`;
}
