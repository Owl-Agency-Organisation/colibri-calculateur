'use client';

import { STORAGE_KEYS } from '@/lib/store/projetStore';
import {
  enregistrerListeEssayee,
  fusionnerSelectionSimulateur,
  lireListeEssayee,
} from '@/lib/store/teintesEssayees';

/**
 * Papiers peints essayés dans le simulateur : SKU de variante sans doublon,
 * le plus récent en tête, 12 au plus (même mécanique que les teintes
 * essayées). Stockés avec le projet (purgés par clearProjetData). Ils ne se
 * calculent pas : affichés avec un lien vers leur fiche boutique.
 */

export function getPapiersPeintsEssayes(): string[] {
  return lireListeEssayee(STORAGE_KEYS.PAPIERS_PEINTS_ESSAYES);
}

/** Ajoute des papiers peints reçus du simulateur (ordre d'application) et retourne la liste à jour. */
export function ajouterPapiersPeintsSimulateur(ordreApplication: readonly string[]): string[] {
  return enregistrerListeEssayee(
    STORAGE_KEYS.PAPIERS_PEINTS_ESSAYES,
    fusionnerSelectionSimulateur(getPapiersPeintsEssayes(), ordreApplication),
  );
}
