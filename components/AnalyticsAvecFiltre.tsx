'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Analytics } from '@vercel/analytics/next';
import type { BeforeSendEvent } from '@vercel/analytics/next';
import {
  appliquerParametreUrl,
  estTraficInterne,
  surChangementTraficInterne,
} from '@/lib/analytics/interne';

// `beforeSend` n'est enregistré qu'une fois auprès du script Vercel : la
// fonction doit être stable (niveau module) et relire l'état à chaque
// événement — une closure sur un booléen React serait figée.
function filtrerTraficInterne(evenement: BeforeSendEvent): BeforeSendEvent | null {
  return estTraficInterne() ? null : evenement;
}

/**
 * Monte Vercel Analytics avec le filtre « trafic interne » (pages vues et
 * événements track() supprimés quand le mode est actif) et affiche le badge
 * de confirmation. `beforeSend` étant une fonction, ce wrapper client est
 * obligatoire : le layout racine est un composant serveur.
 * Activation : `?owl=1` / `?owl=0`, ou geste de clics (cf. README).
 *
 * Le badge est rendu DANS LE FLUX, en tête de contenu (monté avant `<main>`).
 * `fixed`/`sticky` seraient inopérants : l'iframe est dimensionnée à la hauteur
 * totale du document par EmbedBridge, son viewport couvre donc tout le contenu
 * et c'est la page Shopify parente qui scrolle — un élément fixe se calerait en
 * bas du document, hors de l'écran.
 */
export function AnalyticsAvecFiltre() {
  const interne = useSyncExternalStore(
    surChangementTraficInterne,
    estTraficInterne,
    () => false
  );

  // Lecture directe de location.search (et non useSearchParams : inutile de
  // faire basculer tout le layout dans une frontière Suspense pour un
  // paramètre qui n'arrive que par chargement complet de page).
  useEffect(() => {
    appliquerParametreUrl(window.location.search);
  }, []);

  return (
    <>
      <Analytics beforeSend={filtrerTraficInterne} />
      {interne && (
        <div
          role="status"
          className="pointer-events-none select-none max-w-4xl mx-auto px-4 pt-2 flex justify-center"
        >
          <span className="rounded-full bg-gray-900/85 px-3 py-1 text-xs font-medium text-white">
            🦉 Trafic interne — exclu des stats
          </span>
        </div>
      )}
    </>
  );
}
