import type { TypePiece } from '@/lib/types';

/**
 * Libellés des types de pièce, dans l'ordre de l'écran « Type de pièce ».
 * Le script hébergé (`embed/colibri.js`) reprend la même liste (libellés et
 * images) pour la question « Quelle pièce ? » de la page Simulateur : un test
 * vérifie qu'elles concordent.
 */
export const LIBELLES_PIECES: Record<TypePiece, string> = {
  'piece-de-vie': 'Pièce de vie',
  'chambre': 'Chambre',
  'cuisine': 'Cuisine',
  'salle-de-bain': 'Salle de bain',
  'toilettes': 'Toilettes',
  'entree': 'Entrée',
  'couloir': 'Couloir',
};

/** Images des types de pièce (CDN Shopify), mêmes ordre et clés que les libellés. */
export const IMAGES_PIECES: Record<TypePiece, string> = {
  'piece-de-vie': 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P01_vie.png?v=1769015678',
  'chambre': 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P02_chambre.png?v=1769015679',
  'cuisine': 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P03_cuisine.png?v=1769015679',
  'salle-de-bain': 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P04_salledebain.png?v=1769015678',
  'toilettes': 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P05_toilettes.png?v=1769015679',
  'entree': 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P06_entree.png?v=1769015680',
  'couloir': 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/ColibriAssurances_P07_couloir.png?v=1769015679',
};

export function estTypePiece(valeur: unknown): valeur is TypePiece {
  return typeof valeur === 'string' && Object.prototype.hasOwnProperty.call(LIBELLES_PIECES, valeur);
}
