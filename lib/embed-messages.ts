import type { TypePiece } from '@/lib/types';
import { estTypePiece } from '@/lib/pieces';

/**
 * Contrat postMessage entre l'app (iframe) et la page Shopify qui l'embarque.
 *
 * Côté page, tout est géré par le script hébergé `/embed/colibri.js`
 * (source : `embed/colibri.js`), qui n'accepte que les messages de l'origine de
 * l'iframe. Côté app, seuls les messages de l'origine parente sont acceptés
 * (`getParentOrigin()`, lib/navigation). Jamais `*`, dans aucun sens.
 *
 * Messages historiques (contrat figé, déjà en production) :
 * - `colibri:resize`, `colibri:scrollTop`, `colibri:redirect` (app → page)
 *
 * Pont simulateur (ce module) :
 * - `colibri:simulateur:ouvrir` (app → page) : ouvrir le simulateur en
 *   surimpression, éventuellement sur une teinte
 * - `colibri:simulateur:selection` (page → app) : teintes appliquées sur les
 *   murs pendant la session du simulateur, envoyées par « Utiliser… » de la
 *   barre Colibri (handles Shopify, ordre d'application, sans doublon : une
 *   teinte réappliquée passe en dernier, la dernière est la plus récente)
 * - `colibri:simulateur:ferme` (page → app) : simulateur fermé sans sélection
 *   (« ← Retour au calculateur » de la barre, bouton retour de Wizart, ou
 *   impossible à charger)
 * - `colibri:parent:pret` (page → app) : la page est équipée du script hébergé ;
 *   `capacites` contient `simulateur` seulement si le simulateur est utilisable.
 *   L'ancienne page n'envoie rien : sans ce message, l'app n'affiche aucune
 *   entrée vers le simulateur.
 */

export const CAPACITE_SIMULATEUR = 'simulateur';

// Bornes défensives : un message ne doit jamais faire exploser l'UI
const MAX_TEINTES_MESSAGE = 50;
const MAX_CAPACITES = 20;
const MAX_LONGUEUR_HANDLE = 255;

// Handle Shopify : minuscules, chiffres et tirets (ce que Wizart renvoie comme
// référence produit pour Colibri)
const MOTIF_HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------- App → page ----------

export interface MessageResize {
  type: 'colibri:resize';
  height: number;
}

export interface MessageScrollTop {
  type: 'colibri:scrollTop';
}

export interface MessageRedirect {
  type: 'colibri:redirect';
  url: string;
}

export interface MessageSimulateurOuvrir {
  type: 'colibri:simulateur:ouvrir';
  piece: TypePiece;
  /** Handle de la teinte sur laquelle ouvrir le simulateur */
  teinte?: string;
}

export type MessageAppVersPage =
  | MessageResize
  | MessageScrollTop
  | MessageRedirect
  | MessageSimulateurOuvrir;

// ---------- Page → app ----------

export interface MessageParentPret {
  type: 'colibri:parent:pret';
  capacites: string[];
}

export interface MessageSimulateurSelection {
  type: 'colibri:simulateur:selection';
  /**
   * Handles des teintes, ordre d'application dans le simulateur, sans
   * doublon : la dernière est la plus récente (posée sur le mur ciblé)
   */
  teintes: string[];
}

export interface MessageSimulateurFerme {
  type: 'colibri:simulateur:ferme';
}

export type MessagePageVersApp =
  | MessageParentPret
  | MessageSimulateurSelection
  | MessageSimulateurFerme;

// ---------- Validation ----------

export function estHandleTeinte(valeur: unknown): valeur is string {
  return typeof valeur === 'string'
    && valeur.length <= MAX_LONGUEUR_HANDLE
    && MOTIF_HANDLE.test(valeur);
}

/**
 * Garde les handles valides, dans l'ordre, sans doublon. Les entrées
 * invalides sont ignorées (jamais d'erreur : la donnée vient de l'extérieur).
 */
export function normaliserTeintes(valeurs: readonly unknown[], max = MAX_TEINTES_MESSAGE): string[] {
  const teintes: string[] = [];
  for (const valeur of valeurs) {
    if (teintes.length >= max) break;
    const handle = typeof valeur === 'string' ? valeur.trim().toLowerCase() : valeur;
    if (estHandleTeinte(handle) && !teintes.includes(handle)) {
      teintes.push(handle);
    }
  }
  return teintes;
}

/**
 * Sélection du simulateur (ordre d'application) : handles valides, sans
 * doublon, la dernière occurrence d'une teinte comptant (réappliquée = plus
 * récente). Au-delà de `max`, les plus anciennes sont écartées : la dernière
 * reste toujours la plus récente.
 */
export function normaliserSelection(valeurs: readonly unknown[], max = MAX_TEINTES_MESSAGE): string[] {
  return normaliserTeintes([...valeurs].reverse(), max).reverse();
}

/** Teinte la plus récente d'une sélection (dernière de la liste), ou null. */
export function derniereTeinte(teintes: readonly string[]): string | null {
  return teintes.length > 0 ? teintes[teintes.length - 1] : null;
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null;
}

/**
 * Lit un message reçu de la page parente. Retourne null pour tout message
 * inconnu ou mal formé (l'origine est vérifiée par l'appelant).
 */
export function lireMessagePage(donnees: unknown): MessagePageVersApp | null {
  if (!estObjet(donnees) || typeof donnees.type !== 'string') return null;

  switch (donnees.type) {
    case 'colibri:parent:pret': {
      if (!Array.isArray(donnees.capacites)) return null;
      const capacites = donnees.capacites
        .filter((c): c is string => typeof c === 'string' && c.length > 0 && c.length <= 50)
        .slice(0, MAX_CAPACITES);
      return { type: 'colibri:parent:pret', capacites };
    }
    case 'colibri:simulateur:selection': {
      if (!Array.isArray(donnees.teintes)) return null;
      return { type: 'colibri:simulateur:selection', teintes: normaliserSelection(donnees.teintes) };
    }
    case 'colibri:simulateur:ferme':
      return { type: 'colibri:simulateur:ferme' };
    default:
      return null;
  }
}

export function messageOuvrirSimulateur(piece: TypePiece, teinte?: string): MessageSimulateurOuvrir {
  return estHandleTeinte(teinte)
    ? { type: 'colibri:simulateur:ouvrir', piece, teinte }
    : { type: 'colibri:simulateur:ouvrir', piece };
}

// ---------- Entrée depuis la page Simulateur ----------

export interface EntreeSimulateur {
  piece: TypePiece;
  teintes: string[];
}

/**
 * Paramètres de `/calculateur/simulateur?piece={TypePiece}&teintes={h1},{h2}`.
 * Retourne null si la pièce est inconnue ou si aucune teinte valide n'est
 * fournie (l'écran renvoie alors vers l'accueil).
 */
export function lireEntreeSimulateur(params: URLSearchParams): EntreeSimulateur | null {
  const piece = params.get('piece');
  if (!estTypePiece(piece)) return null;
  const teintes = normaliserTeintes((params.get('teintes') ?? '').split(','));
  if (teintes.length === 0) return null;
  return { piece, teintes };
}
