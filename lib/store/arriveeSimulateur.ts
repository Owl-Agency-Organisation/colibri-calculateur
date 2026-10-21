'use client';

import type { Couleur } from '@/lib/types';

/**
 * Passage de relais entre l'écran d'arrivée du simulateur
 * (`/calculateur/simulateur`) et la page Surfaces, le temps d'une navigation
 * (sessionStorage, comme `colibri-temp-piece-type`) : la couleur du mur à
 * pré-remplir et le nombre de teintes reçues du simulateur (bandeau).
 */
const CLE = 'colibri-temp-teintes-simulateur';

export interface ArriveeSimulateur {
  /** Couleurs des murs créés à l'arrivée (un seul : la dernière teinte appliquée) */
  couleurs: Couleur[];
  /** Nombre de teintes reçues du simulateur (toutes rejoignent « Vos teintes essayées ») */
  teintesRecues: number;
}

const AUCUNE_ARRIVEE: ArriveeSimulateur = { couleurs: [], teintesRecues: 0 };

/**
 * Mur créé à l'arrivée depuis le simulateur : Wizart n'expose pas l'état de
 * la scène (nombre de murs, teinte de chaque mur), seulement l'ordre
 * d'application. Un seul mur, avec la dernière teinte appliquée (la plus
 * récente) ; les autres restent au choix dans « Vos teintes essayées ».
 */
export function couleursMurArrivee<T>(ordreApplication: readonly T[]): T[] {
  return ordreApplication.length > 0 ? [ordreApplication[ordreApplication.length - 1]] : [];
}

function estCouleur(valeur: unknown): valeur is Couleur {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const c = valeur as Record<string, unknown>;
  return typeof c.productId === 'string'
    && typeof c.productHandle === 'string'
    && typeof c.titre === 'string'
    && typeof c.codeHex === 'string';
}

/** Lecture tolérante du contenu stocké (absent, invalide ou altéré → aucune arrivée). */
export function lireArriveeStockee(brut: string | null): ArriveeSimulateur {
  if (!brut) return AUCUNE_ARRIVEE;
  try {
    const valeur: unknown = JSON.parse(brut);
    if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return AUCUNE_ARRIVEE;
    const objet = valeur as Record<string, unknown>;
    const couleurs = Array.isArray(objet.couleurs) ? objet.couleurs.filter(estCouleur) : [];
    const recues = typeof objet.teintesRecues === 'number' && Number.isInteger(objet.teintesRecues)
      ? objet.teintesRecues
      : couleurs.length;
    return { couleurs, teintesRecues: Math.max(recues, couleurs.length) };
  } catch {
    return AUCUNE_ARRIVEE;
  }
}

export function setArriveeSimulateur(arrivee: ArriveeSimulateur): void {
  try {
    sessionStorage.setItem(CLE, JSON.stringify(arrivee));
  } catch (error) {
    console.error('Error saving simulator colors to sessionStorage:', error);
  }
}

export function getArriveeSimulateur(): ArriveeSimulateur {
  try {
    return lireArriveeStockee(sessionStorage.getItem(CLE));
  } catch {
    return AUCUNE_ARRIVEE;
  }
}

export function clearCouleursArrivee(): void {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    // sessionStorage indisponible : rien à nettoyer
  }
}
