/**
 * Utilitaires pour la normalisation des numéros de téléphone
 */

/**
 * Normalise un numéro de téléphone français au format international E.164
 * 
 * Exemples :
 * - "0612345678" → "+33612345678"
 * - "06 12 34 56 78" → "+33612345678"
 * - "+33612345678" → "+33612345678" (déjà normalisé)
 * - "33612345678" → "+33612345678"
 * 
 * @param phone - Numéro de téléphone à normaliser
 * @returns Numéro au format E.164 ou null si invalide
 */
export function normalizeFrenchPhone(phone: string | undefined): string | null {
  if (!phone) return null;

  // Supprimer tous les espaces, points, tirets
  let cleaned = phone.replace(/[\s.\-()]/g, '');

  // Si commence par +33, c'est déjà au bon format
  if (cleaned.startsWith('+33')) {
    // Vérifier que le numéro a 12 caractères (+33 + 9 chiffres)
    if (cleaned.length === 12 && /^\+33[1-9]\d{8}$/.test(cleaned)) {
      return cleaned;
    }
    return null; // Format invalide
  }

  // Si commence par 33 (sans +), ajouter le +
  if (cleaned.startsWith('33')) {
    cleaned = '+' + cleaned;
    if (cleaned.length === 12 && /^\+33[1-9]\d{8}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  // Si commence par 0, remplacer par +33
  if (cleaned.startsWith('0')) {
    cleaned = '+33' + cleaned.substring(1);
    if (cleaned.length === 12 && /^\+33[1-9]\d{8}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  // Format non reconnu
  return null;
}
