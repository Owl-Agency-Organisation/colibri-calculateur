'use client';

import type { Client, Piece } from '@/lib/types';

// Clés localStorage
export const STORAGE_KEYS = {
  CLIENT: 'colibri-projet-client',
  PIECES: 'colibri-projet-pieces',
  CALCUL: 'colibri-projet-calcul',
  OPTIONS: 'colibri-projet-options',
  SHOPIFY_DATA: 'colibri-projet-shopify-data',
} as const;

// Clés localStorage héritées des anciennes versions (étape identification,
// supprimée en Phase 4). Plus jamais écrites ; purgées à chaque reset de projet.
const LEGACY_KEYS = ['CUSTOMER_ID', 'USER_DATA'];

// Clés techniques liées au panier Shopify en cours (hors STORAGE_KEYS car
// gérées par les pages panier/options)
const CART_KEYS = ['SHOPIFY_CART_ID', 'SHOPIFY_CART_DATA_HASH', 'KIT_TYPE'];

// Fonctions utilitaires pour la gestion du localStorage
export function getStoredClient(): Client | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CLIENT);
    if (!stored) return null;
    const client: Client = JSON.parse(stored);
    return client.email ? client : null;
  } catch {
    return null;
  }
}

export function setStoredClient(client: Client): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.CLIENT, JSON.stringify(client));
  } catch (error) {
    console.error('Error saving client to localStorage:', error);
  }
}

// Type pour l'ancien format de Piece (avant multi-murs)
interface OldPiece {
  id: string;
  typePiece: string;
  nom: string;
  surfaceMurs?: number;
  couleurMurs?: any;
  murs?: any[];
  surfacePlafond?: number;
  surfaceBoiseries?: number;
  couleurPlafond?: any;
  couleurBoiseries?: any;
}

/**
 * Migre une pièce de l'ancien format vers le nouveau format multi-murs
 */
function migratePieceToNewFormat(oldPiece: OldPiece): Piece {
  // Si la pièce a déjà le nouveau format (avec murs array), la retourner telle quelle
  if (oldPiece.murs && Array.isArray(oldPiece.murs)) {
    return oldPiece as Piece;
  }

  // Sinon, convertir l'ancien format (surfaceMurs + couleurMurs) vers le nouveau
  const murs = [];
  if (oldPiece.surfaceMurs && oldPiece.couleurMurs) {
    murs.push({
      id: '1',
      surface: oldPiece.surfaceMurs,
      couleur: oldPiece.couleurMurs,
    });
  }

  return {
    id: oldPiece.id,
    typePiece: oldPiece.typePiece as any,
    nom: oldPiece.nom,
    murs,
    surfacePlafond: oldPiece.surfacePlafond,
    surfaceBoiseries: oldPiece.surfaceBoiseries,
    couleurPlafond: oldPiece.couleurPlafond,
    couleurBoiseries: oldPiece.couleurBoiseries,
  };
}

export function getStoredPieces(): Piece[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PIECES);
    if (!stored) return [];

    const pieces: OldPiece[] = JSON.parse(stored);

    // Migrer automatiquement les pièces vers le nouveau format
    const migratedPieces = pieces.map(migratePieceToNewFormat);

    // Sauvegarder les pièces migrées pour éviter de refaire la migration à chaque fois
    const needsMigration = pieces.some(p => p.surfaceMurs !== undefined && !p.murs);
    if (needsMigration) {
      setStoredPieces(migratedPieces);
    }

    return migratedPieces;
  } catch {
    return [];
  }
}

export function setStoredPieces(pieces: Piece[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.PIECES, JSON.stringify(pieces));
  } catch (error) {
    console.error('Error saving pieces to localStorage:', error);
  }
}

export function clearProjetData(): void {
  if (typeof window === 'undefined') return;
  try {
    [...Object.values(STORAGE_KEYS), ...CART_KEYS, ...LEGACY_KEYS].forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing projet data:', error);
  }
}

// Alias pour clearProjetData
export const clearAllData = clearProjetData;
