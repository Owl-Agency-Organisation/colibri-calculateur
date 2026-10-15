'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clearProjetData } from '@/lib/store/projetStore';

/**
 * Labo du pont simulateur : charge le vrai script `/embed/colibri.js` de ce
 * déploiement en mode `configurateur`, comme la page Shopify, avec un faux
 * `WizartDeploymentKit` qui remplace uniquement Wizart (liste de teintes à
 * cocher, « Utiliser ces teintes » = sortie du panier, « Fermer » = retour).
 */

const HANDLE_INCONNU = 'teinte-inconnue-test';
const CLE_SESSION_PIECE = 'colibri-simulateur-piece';

interface Teinte {
  handle: string;
  titre: string;
}

interface EntreeJournal {
  id: number;
  heure: string;
  sens: string;
  message: string;
}

// ---------- Faux Wizart Deployment Kit ----------

interface OptionsVisualiseur {
  layoutSettings: { targetElement: HTMLElement };
  sceneData?: { openWithProduct?: string };
}

interface FauxVisualiseur {
  readonly cible: HTMLElement;
  readonly teinteInitiale: string | null;
  panier: string[];
}

interface ControleurFaux {
  ouvrir(visualiseur: FauxVisualiseur): void;
  fermer(visualiseur: FauxVisualiseur): void;
}

type RappelEvenement = (evenement: { eventName: string; data: unknown }) => void;

const EVENEMENTS = {
  BACK_BUTTON_CLICK: 'back_button_click',
  CHECKOUT_OPTIONS_OPEN: 'checkout_options_open',
} as const;

function installerFauxKit(controleur: { current: ControleurFaux | null }) {
  const abonnes = new Map<symbol, { rappel: RappelEvenement; nom: string | null }>();

  const emettre = (nom: string, data: unknown) => {
    abonnes.forEach(({ rappel, nom: filtre }) => {
      if (filtre === null || filtre === nom) rappel({ eventName: nom, data });
    });
  };

  class Visualizer implements FauxVisualiseur {
    readonly cible: HTMLElement;
    readonly teinteInitiale: string | null;
    panier: string[] = [];
    isLoaded = false;

    constructor(options: OptionsVisualiseur) {
      this.cible = options.layoutSettings.targetElement;
      this.teinteInitiale = options.sceneData?.openWithProduct ?? null;
    }

    load() {
      this.isLoaded = true;
      return Promise.resolve();
    }

    show() {
      controleur.current?.ouvrir(this);
      return Promise.resolve();
    }

    destroy() {
      controleur.current?.fermer(this);
    }

    getShoppingCartState() {
      return Promise.resolve(this.panier.map((handle) => ({ vendor_code: handle, quantity: 1 })));
    }
  }

  Object.assign(window, {
    WizartDeploymentKit: {
      Visualizer,
      EventBus: {
        subscribe(rappel: RappelEvenement, nom?: string | null) {
          const id = Symbol('abonnement');
          abonnes.set(id, { rappel, nom: nom ?? null });
          return id;
        },
        unsubscribe(id: symbol) {
          abonnes.delete(id);
        },
      },
      VISUALIZER_EVENTS: EVENEMENTS,
      LAYOUTS: { FULL_SCREEN: 'full_screen' },
    },
  });

  return emettre;
}

// Une seule installation par page (double effet du mode strict compris)
let installe = false;

// ---------- Page ----------

function heure(): string {
  const d = new Date();
  return `${d.toLocaleTimeString('fr-FR', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function PontLabo() {
  const [teintes, setTeintes] = useState<Teinte[]>([]);
  const [erreurCatalogue, setErreurCatalogue] = useState<string | null>(null);
  const [journal, setJournal] = useState<EntreeJournal[]>([]);
  const [fauxOuvert, setFauxOuvert] = useState<FauxVisualiseur | null>(null);
  const [coches, setCoches] = useState<string[]>([]);
  const [retour, setRetour] = useState<string | null>(null);

  const controleurRef = useRef<ControleurFaux | null>(null);
  const emettreRef = useRef<((nom: string, data: unknown) => void) | null>(null);
  const hoteRef = useRef<HTMLDivElement>(null);
  const compteurRef = useRef(0);

  const consigner = useCallback((sens: string, message: unknown) => {
    const entree: EntreeJournal = {
      id: compteurRef.current++,
      heure: heure(),
      sens,
      message: JSON.stringify(message),
    };
    setJournal((precedent) => [entree, ...precedent].slice(0, 200));
  }, []);

  controleurRef.current = {
    ouvrir(visualiseur) {
      setCoches(visualiseur.teinteInitiale ? [visualiseur.teinteInitiale] : []);
      setFauxOuvert(visualiseur);
      consigner('faux Wizart', { ouvert: true, openWithProduct: visualiseur.teinteInitiale });
    },
    fermer(visualiseur) {
      setFauxOuvert((courant) => (courant === visualiseur ? null : courant));
      consigner('faux Wizart', { detruit: true });
    },
  };

  // Faux kit puis vrai script, une seule fois
  useEffect(() => {
    const hote = hoteRef.current;
    if (!hote || installe) return;
    installe = true;

    emettreRef.current = installerFauxKit(controleurRef);
    hote.addEventListener('colibri:message', (evenement) => {
      if (evenement instanceof CustomEvent) {
        const detail: { sens?: string; message?: unknown } = evenement.detail ?? {};
        consigner(detail.sens ?? '?', detail.message);
      }
    });

    const script = document.createElement('script');
    script.src = '/embed/colibri.js';
    script.setAttribute('data-colibri', 'configurateur');
    script.onerror = () => consigner('labo', { erreur: 'chargement de /embed/colibri.js impossible' });
    hote.after(script);
    consigner('labo', { script: '/embed/colibri.js', mode: 'configurateur', url: window.location.href });
  }, [consigner]);

  // Teintes réelles de la boutique, pour que l'app les reconnaisse
  useEffect(() => {
    const charger = async () => {
      try {
        const reponse = await fetch('/api/shopify/collections');
        if (!reponse.ok) throw new Error(`collections : HTTP ${reponse.status}`);
        const { collections }: { collections: { handle: string; title: string }[] } = await reponse.json();
        const couleurs = collections
          .filter((c) => c.title.startsWith('Les ') || c.title === 'Schmidt X Colibri')
          .slice(0, 2);
        const listes = await Promise.all(
          couleurs.map(async (c) => {
            const r = await fetch(`/api/shopify/collections/${c.handle}`);
            if (!r.ok) return [];
            const { products }: { products: { handle: string; title: string }[] } = await r.json();
            return products.slice(0, 6).map((p) => ({
              handle: p.handle,
              titre: p.title.replace(' - Peinture biosourcée murs et plafonds', ''),
            }));
          })
        );
        setTeintes([...listes.flat(), { handle: HANDLE_INCONNU, titre: 'Teinte inconnue (test)' }]);
      } catch (erreur) {
        setErreurCatalogue(erreur instanceof Error ? erreur.message : String(erreur));
        setTeintes([{ handle: HANDLE_INCONNU, titre: 'Teinte inconnue (test)' }]);
      }
    };
    charger();
  }, []);

  const utiliser = () => {
    if (!fauxOuvert) return;
    fauxOuvert.panier = coches;
    consigner('faux Wizart', { evenement: 'CHECKOUT_OPTIONS_OPEN', panier: coches });
    emettreRef.current?.(EVENEMENTS.CHECKOUT_OPTIONS_OPEN, {});
  };

  const fermerFaux = () => {
    consigner('faux Wizart', { evenement: 'BACK_BUTTON_CLICK' });
    emettreRef.current?.(EVENEMENTS.BACK_BUTTON_CLICK, {});
  };

  const viderProjet = () => {
    clearProjetData();
    setRetour('Projet vidé (pièces et teintes essayées). Rechargez l’iframe via un lien d’entrée.');
    setTimeout(() => setRetour(null), 4000);
  };

  const reels = teintes.filter((t) => t.handle !== HANDLE_INCONNU).map((t) => t.handle);
  const lien = (piece: string, handles: string[]) =>
    `/labo/pont?piece=${piece}&teintes=${handles.map(encodeURIComponent).join(',')}`;
  const allerPim = (piece: string, handles: string[]) => {
    try {
      sessionStorage.setItem(CLE_SESSION_PIECE, piece);
    } catch {
      // sessionStorage indisponible : l'entrée PIM sera ignorée (comportement attendu)
    }
    window.location.href = `/labo/pont?${handles.map((h) => `vendorCode[]=${encodeURIComponent(h)}`).join('&')}`;
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Test interne — preview uniquement</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Labo pont simulateur</h1>
        <p className="mt-1 text-sm text-gray-600">
          Cette page joue le rôle de la page Shopify <code>/pages/configurateur</code> : elle charge le vrai
          script <code>/embed/colibri.js</code> de ce déploiement. Seul Wizart est remplacé par un faux simulateur.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Entrées</h2>
        {erreurCatalogue && (
          <p className="text-sm text-red-700">Catalogue indisponible ({erreurCatalogue}) : liens réduits.</p>
        )}
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li><a className="text-primary-500 underline" href="/labo/pont">Sans entrée (accueil de l’app)</a></li>
          {reels.length >= 2 && (
            <li><a className="text-primary-500 underline" href={lien('chambre', reels.slice(0, 2))}>Chambre + 2 teintes</a></li>
          )}
          {reels.length >= 3 && (
            <li><a className="text-primary-500 underline" href={lien('cuisine', reels.slice(0, 3))}>Cuisine + 3 teintes</a></li>
          )}
          {reels.length >= 5 && (
            <li><a className="text-primary-500 underline" href={lien('piece-de-vie', reels.slice(0, 5))}>Pièce de vie + 5 teintes (4 murs max)</a></li>
          )}
          {reels.length >= 1 && (
            <li><a className="text-primary-500 underline" href={lien('chambre', [reels[0], HANDLE_INCONNU])}>Chambre + 1 teinte + 1 inconnue</a></li>
          )}
          <li><a className="text-primary-500 underline" href={lien('chambre', [HANDLE_INCONNU])}>Teinte inconnue seule (→ accueil)</a></li>
          {reels.length >= 2 && (
            <li>
              <button type="button" className="text-primary-500 underline" onClick={() => allerPim('salle-de-bain', reels.slice(0, 2))}>
                Retour PIM : vendorCode[] (salle de bain mémorisée)
              </button>
            </li>
          )}
          <li><a className="text-primary-500 underline" href="/calculateur/piece" target="_blank" rel="noopener noreferrer">App sans le pont (aucun « prêt »)</a></li>
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={viderProjet} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
            Vider le projet
          </button>
          {retour && <span className="text-sm text-gray-600">{retour}</span>}
        </div>
      </section>

      {/* Hôte du configurateur : le script y insère l'iframe */}
      <div ref={hoteRef} id="colibri-configurator" className="rounded-lg border border-dashed border-gray-300" />

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Journal des messages ({journal.length})</h2>
          <button type="button" onClick={() => setJournal([])} className="text-xs text-gray-500 underline">Vider</button>
        </div>
        <ol className="mt-3 max-h-96 space-y-1 overflow-y-auto font-mono text-[11px]">
          {journal.length === 0 && <li className="text-gray-500">Aucun message.</li>}
          {journal.map((e) => (
            <li key={e.id} className="break-all rounded bg-gray-50 px-2 py-1">
              <span className="text-gray-500">{e.heure}</span>{' '}
              <span className="font-semibold text-gray-800">{e.sens}</span>{' '}
              <span className="text-gray-700">{e.message}</span>
            </li>
          ))}
        </ol>
      </section>

      {fauxOuvert && createPortal(
        <div className="flex h-dvh flex-col bg-white">
          <div className="border-b border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Faux simulateur (labo)</p>
            <h2 className="text-lg font-bold text-gray-900">Cochez les teintes « essayées »</h2>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-4">
            {[...teintes, ...coches.filter((h) => !teintes.some((t) => t.handle === h)).map((h) => ({ handle: h, titre: h }))].map((t) => (
              <li key={t.handle}>
                <label className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={coches.includes(t.handle)}
                    onChange={(e) => setCoches((c) => (e.target.checked
                      ? [...c, t.handle]
                      : c.filter((h) => h !== t.handle)))}
                  />
                  <span className="flex-1">{t.titre}</span>
                  <code className="text-[11px] text-gray-500">{t.handle}</code>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 border-t border-gray-200 p-4">
            <button type="button" onClick={utiliser} className="flex-1 rounded-lg bg-primary-600 px-4 py-3 font-medium text-white">
              Utiliser ces teintes ({coches.length})
            </button>
            <button type="button" onClick={fermerFaux} className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700">
              Fermer
            </button>
          </div>
        </div>,
        fauxOuvert.cible,
      )}
    </div>
  );
}
