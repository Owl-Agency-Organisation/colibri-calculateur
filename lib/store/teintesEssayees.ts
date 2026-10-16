'use client';

import { normaliserTeintes } from '@/lib/embed-messages';
import { STORAGE_KEYS } from '@/lib/store/projetStore';

/**
 * Teintes essayées dans le simulateur : handles Shopify sans doublon, la plus
 * récente en tête. Stockées avec le projet (purgées par clearProjetData).
 */

// Au-delà, les plus anciennes sont oubliées : le bloc de la popup reste lisible
export const MAX_TEINTES_ESSAYEES = 12;

/**
 * Fusion pure : les nouvelles teintes passent en tête (dans leur ordre), les
 * anciennes suivent sans doublon, la liste est bornée.
 */
export function fusionnerTeintes(existantes: readonly string[], nouvelles: readonly string[]): string[] {
  const entrantes = normaliserTeintes(nouvelles);
  const suite = existantes.filter((handle) => !entrantes.includes(handle));
  return normaliserTeintes([...entrantes, ...suite], MAX_TEINTES_ESSAYEES);
}

/**
 * Fusion d'une sélection du simulateur, reçue dans l'ordre d'application (la
 * dernière est la plus récente) : la plus récente passe en tête du bloc.
 */
export function fusionnerSelectionSimulateur(existantes: readonly string[], ordreApplication: readonly string[]): string[] {
  return fusionnerTeintes(existantes, [...ordreApplication].reverse());
}

/** Lecture tolérante du contenu stocké (JSON invalide ou altéré → liste vide). */
export function lireTeintesStockees(brut: string | null): string[] {
  if (!brut) return [];
  try {
    const valeur: unknown = JSON.parse(brut);
    return Array.isArray(valeur) ? normaliserTeintes(valeur, MAX_TEINTES_ESSAYEES) : [];
  } catch {
    return [];
  }
}

export function getTeintesEssayees(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return lireTeintesStockees(localStorage.getItem(STORAGE_KEYS.TEINTES_ESSAYEES));
  } catch {
    return [];
  }
}

function enregistrer(suivantes: string[]): string[] {
  if (typeof window === 'undefined') return suivantes;
  try {
    localStorage.setItem(STORAGE_KEYS.TEINTES_ESSAYEES, JSON.stringify(suivantes));
  } catch (error) {
    console.error('Error saving tried colors to localStorage:', error);
  }
  return suivantes;
}

/** Ajoute des teintes (en tête, dans leur ordre) et retourne la liste à jour. */
export function ajouterTeintesEssayees(handles: readonly string[]): string[] {
  return enregistrer(fusionnerTeintes(getTeintesEssayees(), handles));
}

/** Ajoute une sélection du simulateur (ordre d'application) et retourne la liste à jour. */
export function ajouterSelectionSimulateur(ordreApplication: readonly string[]): string[] {
  return enregistrer(fusionnerSelectionSimulateur(getTeintesEssayees(), ordreApplication));
}
