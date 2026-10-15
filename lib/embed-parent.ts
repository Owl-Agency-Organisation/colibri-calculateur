'use client';

import { useSyncExternalStore } from 'react';
import {
  CAPACITE_SIMULATEUR,
  lireMessagePage,
  type MessageSimulateurFerme,
  type MessageSimulateurSelection,
} from '@/lib/embed-messages';
import { estMessageDuParent } from '@/lib/navigation';

/**
 * État du parent Shopify, alimenté par les messages page → app (écoute posée
 * par EmbedBridge, monté dans le layout racine). Store minimal en mémoire :
 * l'annonce `colibri:parent:pret` est renvoyée à chaque chargement de l'iframe.
 */

type EvenementSimulateur = MessageSimulateurSelection | MessageSimulateurFerme;

let capacites: readonly string[] = [];
const abonnesCapacites = new Set<() => void>();
const abonnesSimulateur = new Set<(evenement: EvenementSimulateur) => void>();

function definirCapacites(suivantes: readonly string[]): void {
  if (suivantes.length === capacites.length && suivantes.every((c, i) => c === capacites[i])) return;
  capacites = suivantes;
  abonnesCapacites.forEach((abonne) => abonne());
}

/** Traite un message reçu par la fenêtre (filtre origine + forme). */
export function traiterMessageParent(event: MessageEvent): void {
  if (!estMessageDuParent(event)) return;
  const message = lireMessagePage(event.data);
  if (!message) return;

  if (message.type === 'colibri:parent:pret') {
    definirCapacites(message.capacites);
    return;
  }
  abonnesSimulateur.forEach((abonne) => abonne(message));
}

function sAbonnerCapacites(abonne: () => void): () => void {
  abonnesCapacites.add(abonne);
  return () => { abonnesCapacites.delete(abonne); };
}

const AUCUNE_CAPACITE: readonly string[] = [];

/** Vrai seulement si la page parente a annoncé la capacité `simulateur`. */
export function useSimulateurDisponible(): boolean {
  const liste = useSyncExternalStore(sAbonnerCapacites, () => capacites, () => AUCUNE_CAPACITE);
  return liste.includes(CAPACITE_SIMULATEUR);
}

/** Abonnement aux retours du simulateur (sélection ou fermeture). */
export function ecouterSimulateur(abonne: (evenement: EvenementSimulateur) => void): () => void {
  abonnesSimulateur.add(abonne);
  return () => { abonnesSimulateur.delete(abonne); };
}
