'use client';

import { createContext, useContext } from 'react';
import type { Assure, Piece, Calcul } from '@/lib/types';

// Clés localStorage
export const STORAGE_KEYS = {
  ASSURE: 'colibri-sinistre-assure',
  PIECES: 'colibri-sinistre-pieces',
  CALCUL: 'colibri-sinistre-calcul',
  OPTIONS: 'colibri-sinistre-options',
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

export function getStoredPieces(): Piece[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PIECES);
    return stored ? JSON.parse(stored) : [];
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
