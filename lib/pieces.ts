import type { TypePiece } from '@/lib/types';

/**
 * Libellés des types de pièce, dans l'ordre de l'écran « Type de pièce ».
 * Le script hébergé (`embed/colibri.js`) reprend la même liste pour la question
 * « Quelle pièce ? » de la page Simulateur : un test vérifie qu'elles concordent.
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

export function estTypePiece(valeur: unknown): valeur is TypePiece {
  return typeof valeur === 'string' && Object.prototype.hasOwnProperty.call(LIBELLES_PIECES, valeur);
}
