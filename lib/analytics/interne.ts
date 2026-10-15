// Mode « trafic interne » : un membre de l'équipe marque son navigateur pour
// que ses visites soient exclues de Vercel Analytics (pages vues + track()).
// L'app tourne en iframe cross-origin sur la page Shopify /pages/configurateur :
// le stockage tiers est partitionné par les navigateurs, le drapeau doit donc
// pouvoir être posé depuis l'intérieur de l'iframe (geste de clics) et pas
// seulement via l'URL. Procédure complète : README.md § « Trafic interne ».
//
// Module sans dépendance DOM au-delà de localStorage (accès protégé) :
// utilisable côté client et testable sous Vitest en environnement node.

export const CLE_TRAFIC_INTERNE = 'colibri:trafic-interne';
const VALEUR_ACTIVE = '1';

export const NB_CLICS_GESTE = 7;
export const FENETRE_GESTE_MS = 3000;

// Reflet mémoire de la dernière valeur posée dans cette session : si le
// stockage est indisponible (navigation privée, blocage tiers), le mode
// fonctionne quand même jusqu'au rechargement — sans jamais jeter.
let memoire: boolean | null = null;

type Ecouteur = () => void;
const ecouteurs = new Set<Ecouteur>();

let horodatagesClics: number[] = [];

function notifier(): void {
  for (const ecouteur of ecouteurs) {
    ecouteur();
  }
}

/** Le navigateur est-il marqué comme trafic interne ? Ne jette jamais. */
export function estTraficInterne(): boolean {
  if (memoire !== null) return memoire;
  try {
    return globalThis.localStorage.getItem(CLE_TRAFIC_INTERNE) === VALEUR_ACTIVE;
  } catch {
    return false;
  }
}

/** Active ou désactive le mode, persiste au mieux, prévient les abonnés. */
export function definirTraficInterne(actif: boolean): void {
  memoire = actif;
  try {
    if (actif) {
      globalThis.localStorage.setItem(CLE_TRAFIC_INTERNE, VALEUR_ACTIVE);
    } else {
      globalThis.localStorage.removeItem(CLE_TRAFIC_INTERNE);
    }
  } catch {
    // Stockage indisponible : le mode ne survivra pas au rechargement, tant pis.
  }
  notifier();
}

export function basculerTraficInterne(): boolean {
  const nouvelEtat = !estTraficInterne();
  definirTraficInterne(nouvelEtat);
  return nouvelEtat;
}

/**
 * Applique le paramètre d'URL `owl` (`?owl=1` active, `?owl=0` désactive).
 * Retourne l'état appliqué, ou `null` si le paramètre est absent ou invalide.
 */
export function appliquerParametreUrl(recherche: string): boolean | null {
  const valeur = new URLSearchParams(recherche).get('owl');
  if (valeur === '1') {
    definirTraficInterne(true);
    return true;
  }
  if (valeur === '0') {
    definirTraficInterne(false);
    return false;
  }
  return null;
}

/**
 * Geste discret utilisable depuis l'iframe : NB_CLICS_GESTE clics en moins de
 * FENETRE_GESTE_MS sur l'élément qui appelle cette fonction basculent le mode.
 * Retourne le nouvel état quand le geste aboutit, `null` sinon.
 * `maintenant` est injectable pour les tests.
 */
export function enregistrerClicGeste(maintenant: number = Date.now()): boolean | null {
  horodatagesClics = horodatagesClics.filter(
    (t) => maintenant - t < FENETRE_GESTE_MS
  );
  horodatagesClics.push(maintenant);
  if (horodatagesClics.length < NB_CLICS_GESTE) return null;
  horodatagesClics = [];
  return basculerTraficInterne();
}

/** Abonne un écouteur aux changements d'état ; retourne le désabonnement. */
export function surChangementTraficInterne(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}
