'use client';

import { createContext, useContext } from 'react';
import type { Assure, Piece, Calcul } from '@/lib/types';

// Clés localStorage
export const STORAGE_KEYS = {
  ASSURE: 'colibri-sinistre-assure',
  PIECES: 'colibri-sinistre-pieces',
  CALCUL: 'colibri-sinistre-calcul',
  OPTIONS: 'colibri-sinistre-options',
  SHOPIFY_DATA: 'colibri-sinistre-shopify-data',
} as const;

// État initial de l'assuré
export const initialAssure: Assure = {
  civilite: 'M',
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  adresse: '',
  codePostal: '',
  ville: '',
  assureur: '',
};

// Fonctions utilitaires pour la gestion du localStorage
export function getStoredAssure(): Assure {
  if (typeof window === 'undefined') return initialAssure;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ASSURE);
    return stored ? JSON.parse(stored) : initialAssure;
  } catch {
    return initialAssure;
  }
}

export function setStoredAssure(assure: Assure): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ASSURE, JSON.stringify(assure));
  } catch (error) {
    console.error('Error saving assure to localStorage:', error);
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

export function clearSinistreData(): void {
  if (typeof window === 'undefined') return;
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing sinistre data:', error);
  }
}

// Alias pour clearSinistreData
export const clearAllData = clearSinistreData;
