import type { MessageAppVersPage } from '@/lib/embed-messages';

// L'app vit dans une iframe cross-origin sur www.colibripeinture.com/pages/configurateur.
// Les sorties du tunnel (checkout, panier boutique) doivent naviguer la page
// parente : le checkout Shopify refuse l'iframe (frame-ancestors) et le cart
// permalink chargerait le site entier imbriqué dans lui-même.
export const PARENT_ORIGIN = 'https://www.colibripeinture.com';

// Page de test `/labo/pont` : elle embarque l'app depuis l'origine du preview
// lui-même. Fixé au build (next.config.ts) : jamais actif en production.
const LABO_ACTIF = process.env.NEXT_PUBLIC_COLIBRI_LABO === '1';

function origineDe(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Origine de la page qui embarque l'app : toujours `PARENT_ORIGIN`, sauf hors
 * production quand l'app est embarquée par une page de sa propre origine
 * (labo du preview).
 */
export function getParentOrigin(): string {
  if (!LABO_ACTIF || typeof window === 'undefined') return PARENT_ORIGIN;
  const ancetres = window.location.ancestorOrigins;
  const origineParente = ancetres && ancetres.length > 0
    ? ancetres[0]
    : origineDe(document.referrer);
  return origineParente === window.location.origin ? origineParente : PARENT_ORIGIN;
}

/** Vrai quand l'app tourne dans une iframe (page Shopify, labo du preview). */
export function estEmbarque(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // window.top inaccessible : forcément dans une iframe cross-origin
    return true;
  }
}

/** Message reçu de la page parente : origine attendue ET émis par le parent direct */
export function estMessageDuParent(event: MessageEvent): boolean {
  return event.source === window.parent
    && window.parent !== window
    && event.origin === getParentOrigin();
}

export function postToParent(message: MessageAppVersPage): void {
  window.parent.postMessage(message, getParentOrigin());
}

export function redirectTop(url: string): void {
  try {
    // Autorisé cross-origin quand la navigation résulte d'un clic (user activation).
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // window.top inaccessible → on délègue au parent
  }
  postToParent({ type: 'colibri:redirect', url });
  setTimeout(() => { window.location.href = url; }, 300);
}
