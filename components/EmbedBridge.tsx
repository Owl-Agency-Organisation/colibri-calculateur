'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { PARENT_ORIGIN } from '@/lib/navigation';

// Le parent (page Shopify /pages/configurateur) passe son min-height de secours
// à 0 dès le premier resize reçu : une hauteur aberrante écraserait la page.
const HAUTEUR_MIN_PX = 300;
// Le parent applique la hauteur reçue à l'iframe, ce qui redéclenche le
// ResizeObserver : sans seuil de variation, boucle infinie de postMessage.
const SEUIL_VARIATION_PX = 2;

function estEmbarque(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // window.top inaccessible : forcément dans une iframe cross-origin
    return true;
  }
}

/**
 * Pont postMessage avec la page Shopify qui embarque l'app en iframe.
 * Monté dans le layout racine : resize et scrollTop couvrent toutes les
 * routes, écran d'entrée compris.
 * Contrat figé côté parent (déjà en production) :
 * - `{ type: 'colibri:resize', height: number }` — auto-resize de l'iframe
 * - `{ type: 'colibri:scrollTop' }` — scroll vers le haut à chaque étape
 * - `{ type: 'colibri:redirect', url }` — émis par redirectTop() (lib/navigation)
 */
export function EmbedBridge() {
  const pathname = usePathname();
  const premierScrollTop = useRef(true);

  // Auto-resize : hauteur réelle du document → hauteur de l'iframe
  useEffect(() => {
    if (!estEmbarque()) return;

    let derniereHauteur = 0;
    let rafId: number | null = null;

    const emettreHauteur = () => {
      rafId = null;
      // getBoundingClientRect (et non scrollHeight, plancher au viewport de
      // l'iframe) : la hauteur doit aussi pouvoir diminuer
      const hauteur = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (hauteur < HAUTEUR_MIN_PX) return;
      if (Math.abs(hauteur - derniereHauteur) <= SEUIL_VARIATION_PX) return;
      derniereHauteur = hauteur;
      window.parent.postMessage({ type: 'colibri:resize', height: hauteur }, PARENT_ORIGIN);
    };

    const planifierEmission = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(emettreHauteur);
      }
    };

    const observer = new ResizeObserver(planifierEmission);
    observer.observe(document.documentElement);
    // Première émission sans attendre un changement : le parent garde son
    // min-height de secours (900px) tant qu'il n'a rien reçu
    planifierEmission();

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Retour en haut de l'iframe à chaque changement de route. Le tout premier
  // passage est sauté, quel que soit le point d'entrée (écran d'entrée, deep
  // link, rechargement) : au chargement de /pages/configurateur, un scrollTop
  // ferait sauter la page Shopify sur l'iframe en ignorant le contenu au-dessus.
  useEffect(() => {
    if (premierScrollTop.current) {
      premierScrollTop.current = false;
      return;
    }
    if (!estEmbarque()) return;
    window.parent.postMessage({ type: 'colibri:scrollTop' }, PARENT_ORIGIN);
  }, [pathname]);

  return null;
}
