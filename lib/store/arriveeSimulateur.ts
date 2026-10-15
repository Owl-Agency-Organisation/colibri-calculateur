'use client';

import type { Couleur } from '@/lib/types';

/**
 * Passage de relais entre l'écran d'arrivée du simulateur
 * (`/calculateur/simulateur`) et la page Surfaces : les couleurs des murs à
 * pré-remplir, le temps d'une navigation (sessionStorage, comme
 * `colibri-temp-piece-type`).
 */
const CLE = 'colibri-temp-teintes-simulateur';

function estCouleur(valeur: unknown): valeur is Couleur {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const c = valeur as Record<string, unknown>;
  return typeof c.productId === 'string'
    && typeof c.productHandle === 'string'
    && typeof c.titre === 'string'
    && typeof c.codeHex === 'string';
}

export function setCouleursArrivee(couleurs: Couleur[]): void {
  try {
    sessionStorage.setItem(CLE, JSON.stringify(couleurs));
  } catch (error) {
    console.error('Error saving simulator colors to sessionStorage:', error);
  }
}

export function getCouleursArrivee(): Couleur[] {
  try {
    const brut = sessionStorage.getItem(CLE);
    if (!brut) return [];
    const valeur: unknown = JSON.parse(brut);
    return Array.isArray(valeur) ? valeur.filter(estCouleur) : [];
  } catch {
    return [];
  }
}

export function clearCouleursArrivee(): void {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    // sessionStorage indisponible : rien à nettoyer
  }
}
