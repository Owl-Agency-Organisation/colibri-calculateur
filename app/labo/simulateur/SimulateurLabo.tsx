'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import type { TypePiece } from '@/lib/types';
import {
  getWizartKit,
  type WizartDeploymentKitApi,
  type WizartVisualizer,
  type WizartVisualizerOptions,
} from './wizart';

// Du plus récent au plus ancien : en cas d'échec de chargement, on passe au
// suivant. La v1.1.3 n'apparaît pas encore dans le journal des versions de la
// doc, mais elle est publiée et, contrairement à la v1.1.2, elle expose
// VISUALIZER_EVENTS.OPEN_IN_STORE.
const SCRIPTS_DEPKIT = [
  'https://d18jpdcj6p6zg6.cloudfront.net/wizart-deployment-kit-v1.1.3.min.js',
  'https://d18jpdcj6p6zg6.cloudfront.net/wizart-deployment-kit-v1.1.2.min.js',
];

// Lu au build (NEXT_PUBLIC_) : un ajout dans Vercel exige un redéploiement.
const TOKEN = process.env.NEXT_PUBLIC_WIZART_TOKEN?.trim() ?? '';

const CLE_PIECE = 'colibri-simulateur-piece';
const CLE_JOURNAL = 'colibri-simulateur-journal';
// Format provisoire, propre à ce test : le configurateur ne lit pas encore ces paramètres.
const URL_CONFIGURATEUR = 'https://www.colibripeinture.com/pages/configurateur';
const MAX_ENTREES = 500;
const MAX_CONTENU = 20_000;
const DELAI_PANIER_MS = 5_000;

// Repris de TYPES_PIECES (app/calculateur/piece/page.tsx) : le Record impose
// de couvrir exactement les TypePiece du configurateur.
const PIECES: Record<TypePiece, string> = {
  'piece-de-vie': 'Pièce de vie',
  chambre: 'Chambre',
  cuisine: 'Cuisine',
  'salle-de-bain': 'Salle de bain',
  toilettes: 'Toilettes',
  entree: 'Entrée',
  couloir: 'Couloir',
};

type TypeEntree = 'info' | 'evenement' | 'panier' | 'sortie' | 'message' | 'erreur';

interface EntreeJournal {
  id: string;
  heure: string;
  type: TypeEntree;
  titre: string;
  contenu?: string;
  url?: string;
}

type EtatVisualiseur = 'ferme' | 'chargement' | 'ouvert';

const LIBELLES_TYPE: Record<TypeEntree, string> = {
  info: 'Info',
  evenement: 'Événement',
  panier: 'Panier',
  sortie: 'Sortie',
  message: 'Message brut',
  erreur: 'Erreur',
};

const COULEURS_TYPE: Record<TypeEntree, string> = {
  info: 'bg-gray-100 text-gray-700',
  evenement: 'bg-blue-100 text-blue-800',
  panier: 'bg-amber-100 text-amber-800',
  sortie: 'bg-green-100 text-green-800',
  message: 'bg-purple-100 text-purple-800',
  erreur: 'bg-red-100 text-red-800',
};

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null;
}

function estTypePiece(valeur: string | null): valeur is TypePiece {
  return valeur !== null && Object.prototype.hasOwnProperty.call(PIECES, valeur);
}

function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

/** JSON lisible, tolérant aux références circulaires, Blob et fonctions. */
function serialiser(valeur: unknown): string {
  if (valeur === undefined) return 'undefined';
  const vus = new WeakSet<object>();
  let texte: string;
  try {
    texte = JSON.stringify(
      valeur,
      (_cle, v: unknown) => {
        if (typeof v === 'function') return '[fonction]';
        if (typeof v === 'bigint') return v.toString();
        if (typeof Blob !== 'undefined' && v instanceof Blob) {
          return `[Blob ${v.type || 'sans type'}, ${v.size} octets]`;
        }
        if (estObjet(v)) {
          if (vus.has(v)) return '[déjà affiché]';
          vus.add(v);
        }
        return v;
      },
      2,
    );
  } catch (erreur) {
    texte = `[non sérialisable : ${messageErreur(erreur)}]`;
  }
  return texte.length > MAX_CONTENU
    ? `${texte.slice(0, MAX_CONTENU)}\n… (tronqué, ${texte.length} caractères)`
    : texte;
}

function estEntree(valeur: unknown): valeur is EntreeJournal {
  return (
    estObjet(valeur) &&
    typeof valeur.id === 'string' &&
    typeof valeur.heure === 'string' &&
    typeof valeur.titre === 'string' &&
    typeof valeur.type === 'string' &&
    Object.prototype.hasOwnProperty.call(LIBELLES_TYPE, valeur.type)
  );
}

function lireSession(cle: string): string | null {
  try {
    return sessionStorage.getItem(cle);
  } catch {
    return null;
  }
}

function lireJournal(): EntreeJournal[] {
  const brut = lireSession(CLE_JOURNAL);
  if (!brut) return [];
  try {
    const valeur: unknown = JSON.parse(brut);
    return Array.isArray(valeur) ? valeur.filter(estEntree) : [];
  } catch {
    return [];
  }
}

function ecrireJournal(entrees: EntreeJournal[]): void {
  let aEcrire = entrees;
  // Quota dépassé : on abandonne la moitié la plus ancienne et on réessaie
  while (aEcrire.length > 0) {
    try {
      sessionStorage.setItem(CLE_JOURNAL, JSON.stringify(aEcrire));
      return;
    } catch {
      aEcrire = aEcrire.slice(Math.ceil(aEcrire.length / 2));
    }
  }
}

/**
 * vendor_code des produits du panier Wizart. Documenté comme
 * Array<{ vendor_code, quantity }> ; quelques variantes tolérées tant que la
 * forme réelle n'est pas confirmée par le test.
 */
function extraireHandles(valeur: unknown): string[] {
  let liste: unknown[] = [];
  if (Array.isArray(valeur)) {
    liste = valeur;
  } else if (estObjet(valeur)) {
    for (const cle of ['products', 'items', 'cart']) {
      const candidat = valeur[cle];
      if (Array.isArray(candidat)) {
        liste = candidat;
        break;
      }
    }
  }
  const handles: string[] = [];
  for (const element of liste) {
    if (typeof element === 'string' && element) {
      handles.push(element);
    } else if (estObjet(element)) {
      const code = element.vendor_code ?? element.vendorCode ?? element.sku ?? element.handle;
      if (typeof code === 'string' && code) handles.push(code);
    }
  }
  return [...new Set(handles)];
}

function construireUrlConfigurateur(piece: TypePiece | null, handles: string[]): string {
  const teintes = handles.map((handle) => encodeURIComponent(handle)).join(',');
  return `${URL_CONFIGURATEUR}?piece=${encodeURIComponent(piece ?? '')}&teintes=${teintes}`;
}

function avecDelai<T>(promesse: Promise<T>, delaiMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const minuteur = setTimeout(
      () => reject(new Error(`pas de réponse après ${delaiMs} ms`)),
      delaiMs,
    );
    promesse.then(
      (valeur) => {
        clearTimeout(minuteur);
        resolve(valeur);
      },
      (erreur: unknown) => {
        clearTimeout(minuteur);
        reject(erreur);
      },
    );
  });
}

function heureLisible(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${date.toLocaleTimeString('fr-FR', { hour12: false })}.${ms}`;
}

function journalEnTexte(entrees: EntreeJournal[]): string {
  const entete = [
    'Journal — Labo simulateur Wizart (test interne)',
    `Copié le : ${new Date().toISOString()}`,
    `Page : ${window.location.href}`,
    `Navigateur : ${navigator.userAgent}`,
    `Entrées : ${entrees.length}`,
  ].join('\n');
  const lignes = entrees.map((entree) =>
    [
      `[${entree.heure}] ${LIBELLES_TYPE[entree.type].toUpperCase()} — ${entree.titre}`,
      entree.url ? `URL : ${entree.url}` : null,
      entree.contenu ?? null,
    ]
      .filter((ligne): ligne is string => ligne !== null)
      .join('\n'),
  );
  return [entete, ...lignes].join('\n\n----------\n\n');
}

function copierAvecRepli(texte: string): boolean {
  const zone = document.createElement('textarea');
  zone.value = texte;
  zone.setAttribute('readonly', '');
  zone.style.position = 'fixed';
  zone.style.opacity = '0';
  document.body.appendChild(zone);
  zone.select();
  let reussi = false;
  try {
    reussi = document.execCommand('copy');
  } catch {
    reussi = false;
  }
  document.body.removeChild(zone);
  return reussi;
}

export function SimulateurLabo() {
  const [piece, setPiece] = useState<TypePiece | null>(null);
  const [teinte, setTeinte] = useState<string | null>(null);
  const [kit, setKit] = useState<WizartDeploymentKitApi | null>(null);
  const [indexScript, setIndexScript] = useState(0);
  const [scriptCharge, setScriptCharge] = useState<string | null>(null);
  const [evenements, setEvenements] = useState<string[]>([]);
  const [etat, setEtat] = useState<EtatVisualiseur>('ferme');
  const [journal, setJournal] = useState<EntreeJournal[]>([]);
  const [journalOuvert, setJournalOuvert] = useState(true);
  const [retourCopie, setRetourCopie] = useState<string | null>(null);

  const journalRef = useRef<EntreeJournal[]>([]);
  const compteurRef = useRef(0);
  const pieceRef = useRef<TypePiece | null>(null);
  const visualizerRef = useRef<WizartVisualizer | null>(null);
  const cibleRef = useRef<HTMLDivElement>(null);
  const abonnementsRef = useRef<symbol[]>([]);
  const montageRef = useRef(false);

  // Écriture synchrone dans sessionStorage à chaque entrée : une redirection
  // immédiate après l'événement ne doit rien faire perdre.
  const ajouter = useCallback(
    (type: TypeEntree, titre: string, options: { donnees?: unknown; url?: string } = {}) => {
      const entree: EntreeJournal = {
        id: `${Date.now()}-${compteurRef.current++}`,
        heure: new Date().toISOString(),
        type,
        titre,
        ...('donnees' in options ? { contenu: serialiser(options.donnees) } : {}),
        ...(options.url ? { url: options.url } : {}),
      };
      console.log(`[Labo Wizart] ${entree.heure} ${titre}`, options.donnees ?? '', options.url ?? '');
      const suivant = [...journalRef.current, entree].slice(-MAX_ENTREES);
      journalRef.current = suivant;
      ecrireJournal(suivant);
      setJournal(suivant);
    },
    [],
  );

  // Sortie du panier Wizart : état du panier + URL provisoire du configurateur
  const traiterSortie = useCallback(
    async (source: string, donneesEvenement: unknown) => {
      const visualiseur = visualizerRef.current;
      let etatPanier: unknown = null;
      if (visualiseur && visualiseur.isLoaded) {
        try {
          etatPanier = await avecDelai(visualiseur.getShoppingCartState(), DELAI_PANIER_MS);
          ajouter('panier', `getShoppingCartState() après ${source}`, { donnees: etatPanier });
        } catch (erreur) {
          ajouter('erreur', `getShoppingCartState() après ${source} : échec`, {
            donnees: messageErreur(erreur),
          });
        }
      } else {
        ajouter('erreur', `getShoppingCartState() non appelé après ${source} : visualiseur non chargé`);
      }

      let handles = extraireHandles(etatPanier);
      let origine = 'getShoppingCartState()';
      if (handles.length === 0) {
        handles = extraireHandles(donneesEvenement);
        origine = handles.length > 0 ? 'contenu de l’événement' : 'aucune teinte trouvée';
      }
      const url = construireUrlConfigurateur(pieceRef.current, handles);
      ajouter('sortie', `URL vers le configurateur (format provisoire) — ${source}`, {
        donnees: { piece: pieceRef.current, teintes: handles, origineDesTeintes: origine },
        url,
      });
      setJournalOuvert(true);
    },
    [ajouter],
  );

  const brancherKit = useCallback(
    (kitPret: WizartDeploymentKitApi, url: string) => {
      setKit(kitPret);
      setScriptCharge(url);
      if (abonnementsRef.current.length > 0) return;

      const evenementsKit = kitPret.VISUALIZER_EVENTS;
      const cles = Object.keys(evenementsKit);
      setEvenements(cles);
      const openInStore = Object.entries(evenementsKit).find(([, valeur]) => valeur === 'open_in_store');
      ajouter('info', `Script DepKit chargé : ${url}`, {
        donnees: {
          nombreEvenements: cles.length,
          openInStore: openInStore ? `oui (${openInStore[0]} = « ${openInStore[1]} »)` : 'non',
          VISUALIZER_EVENTS: evenementsKit,
        },
      });

      for (const [cle, valeur] of Object.entries(evenementsKit)) {
        const abonnement = kitPret.EventBus.subscribe(
          (evenement) => {
            ajouter('evenement', `${cle} (« ${valeur} »)`, {
              donnees: { eventName: evenement.eventName, data: evenement.data },
            });
            if (cle === 'CHECKOUT_OPTIONS_OPEN' || valeur === 'open_in_store') {
              void traiterSortie(cle, evenement.data);
            }
            // Le DepKit détruit lui-même le visualiseur sur le bouton retour
            if (cle === 'BACK_BUTTON_CLICK') {
              visualizerRef.current = null;
              setEtat('ferme');
              setJournalOuvert(true);
            }
          },
          valeur,
          null,
        );
        abonnementsRef.current.push(abonnement);
      }
    },
    [ajouter, traiterSortie],
  );

  // Restauration du journal et de la pièce, lecture de ?teinte=
  useEffect(() => {
    if (montageRef.current) return;
    montageRef.current = true;

    const restaure = lireJournal();
    journalRef.current = restaure;
    setJournal(restaure);

    const pieceStockee = lireSession(CLE_PIECE);
    if (estTypePiece(pieceStockee)) {
      setPiece(pieceStockee);
      pieceRef.current = pieceStockee;
    }

    const parametreTeinte = new URLSearchParams(window.location.search).get('teinte')?.trim() || null;
    setTeinte(parametreTeinte);

    const navigation = performance.getEntriesByType('navigation')[0];
    const typeNavigation =
      typeof PerformanceNavigationTiming !== 'undefined' && navigation instanceof PerformanceNavigationTiming
        ? navigation.type
        : 'inconnu';
    ajouter('info', `Page chargée (navigation : ${typeNavigation})`, {
      donnees: {
        url: window.location.href,
        entreesRestaurees: restaure.length,
        pieceEnregistree: estTypePiece(pieceStockee) ? pieceStockee : null,
        teinte: parametreTeinte,
        token: TOKEN ? 'présent' : 'absent',
      },
    });
  }, [ajouter]);

  // Départ / retour de la page (redirection éventuelle du PIM)
  useEffect(() => {
    const surDepart = (evenement: PageTransitionEvent) => {
      ajouter('info', `Page quittée (pagehide${evenement.persisted ? ', mise en cache' : ''})`);
    };
    const surRetour = (evenement: PageTransitionEvent) => {
      if (evenement.persisted) ajouter('info', 'Page restaurée depuis le cache du navigateur (retour arrière)');
    };
    window.addEventListener('pagehide', surDepart);
    window.addEventListener('pageshow', surRetour);
    return () => {
      window.removeEventListener('pagehide', surDepart);
      window.removeEventListener('pageshow', surRetour);
    };
  }, [ajouter]);

  // Messages postMessage de l'iframe Wizart que l'EventBus ne relaie pas
  // (événement absent de VISUALIZER_EVENTS, message interne) : ceux de
  // l'EventBus sont déjà consignés par les abonnements.
  useEffect(() => {
    const surMessage = (evenement: MessageEvent<unknown>) => {
      let hote = '';
      try {
        hote = new URL(evenement.origin).hostname;
      } catch {
        return;
      }
      if (hote !== 'wizart.ai' && !hote.endsWith('.wizart.ai')) return;

      const donnees = evenement.data;
      const nomAnalytique =
        estObjet(donnees) && typeof donnees.analyticsEventName === 'string' ? donnees.analyticsEventName : undefined;
      const nomInterne = estObjet(donnees) && typeof donnees.eventName === 'string' ? donnees.eventName : undefined;
      const connus = Object.values(getWizartKit()?.VISUALIZER_EVENTS ?? {});
      if (nomAnalytique && connus.includes(nomAnalytique)) return;
      if (!nomAnalytique && nomInterne && connus.includes(nomInterne)) return;

      ajouter('message', `Message brut hors EventBus : ${nomAnalytique ?? nomInterne ?? '(sans nom)'}`, {
        donnees: { origine: evenement.origin, data: donnees },
      });
      if (nomAnalytique === 'open_in_store' || nomInterne === 'open_in_store') {
        void traiterSortie('open_in_store (message brut)', estObjet(donnees) ? donnees.payload : undefined);
      }
    };
    window.addEventListener('message', surMessage);
    return () => window.removeEventListener('message', surMessage);
  }, [ajouter, traiterSortie]);

  // Démontage (navigation client) : désabonnements et destruction
  useEffect(() => {
    const abonnements = abonnementsRef;
    const visualiseur = visualizerRef;
    return () => {
      const kitCourant = getWizartKit();
      abonnements.current.forEach((abonnement) => kitCourant?.EventBus.unsubscribe(abonnement));
      abonnements.current = [];
      visualiseur.current?.destroy();
      visualiseur.current = null;
    };
  }, []);

  const ouvrirVisualiseur = async (choix: TypePiece) => {
    setPiece(choix);
    pieceRef.current = choix;
    try {
      sessionStorage.setItem(CLE_PIECE, choix);
    } catch {
      // sessionStorage indisponible (navigation privée stricte) : la pièce reste en mémoire
    }
    ajouter('info', `Pièce choisie : ${PIECES[choix]} (${choix})`);

    if (!TOKEN) {
      ajouter('erreur', 'Visualiseur non ouvert : NEXT_PUBLIC_WIZART_TOKEN absente');
      return;
    }
    if (!kit) {
      ajouter('erreur', 'Visualiseur non ouvert : le script DepKit n’est pas encore chargé');
      return;
    }
    const cible = cibleRef.current;
    if (!cible) return;

    visualizerRef.current?.destroy();
    visualizerRef.current = null;

    const options: WizartVisualizerOptions = {
      token: TOKEN,
      layoutSettings: { targetElement: cible, layout: kit.LAYOUTS.FULL_SCREEN },
      integrationSettings: { locale: 'fr' },
      ...(teinte ? { sceneData: { openWithProduct: teinte } } : {}),
    };
    // Jamais le token dans le journal
    ajouter('info', 'Création du visualiseur', {
      donnees: {
        layout: options.layoutSettings.layout,
        integrationSettings: options.integrationSettings,
        sceneData: options.sceneData ?? null,
      },
    });
    setEtat('chargement');
    try {
      const visualiseur = new kit.Visualizer(options);
      visualizerRef.current = visualiseur;
      await visualiseur.load();
      await visualiseur.show();
      if (visualizerRef.current !== visualiseur) return;
      setEtat('ouvert');
      setJournalOuvert(false);
      ajouter('info', 'Visualiseur affiché (load() puis show())');
    } catch (erreur) {
      visualizerRef.current = null;
      setEtat('ferme');
      ajouter('erreur', 'Échec de l’ouverture du visualiseur', { donnees: messageErreur(erreur) });
    }
  };

  const fermerVisualiseur = () => {
    visualizerRef.current?.destroy();
    visualizerRef.current = null;
    setEtat('ferme');
    ajouter('info', 'Visualiseur fermé depuis le labo');
  };

  const copierJournal = async () => {
    const texte = journalEnTexte(journalRef.current);
    let reussi = false;
    try {
      await navigator.clipboard.writeText(texte);
      reussi = true;
    } catch {
      reussi = copierAvecRepli(texte);
    }
    setRetourCopie(reussi ? 'Journal copié' : 'Copie impossible : sélectionnez le texte à la main');
    setTimeout(() => setRetourCopie(null), 3_000);
  };

  const viderJournal = () => {
    if (!window.confirm('Vider le journal ?')) return;
    journalRef.current = [];
    try {
      sessionStorage.removeItem(CLE_JOURNAL);
    } catch {
      // rien à nettoyer
    }
    setJournal([]);
  };

  const scriptEnCours = indexScript < SCRIPTS_DEPKIT.length ? SCRIPTS_DEPKIT[indexScript] : null;
  const derniereSortie = [...journal].reverse().find((entree) => entree.type === 'sortie' && entree.url);
  const openInStore = kit
    ? Object.entries(kit.VISUALIZER_EVENTS).find(([, valeur]) => valeur === 'open_in_store')
    : undefined;

  return (
    <div className="space-y-6 pb-24">
      {!kit && scriptEnCours && (
        <Script
          key={scriptEnCours}
          src={scriptEnCours}
          strategy="afterInteractive"
          onReady={() => {
            const kitPret = getWizartKit();
            if (kitPret) {
              brancherKit(kitPret, scriptEnCours);
            } else {
              ajouter('erreur', `Script chargé mais window.WizartDeploymentKit absent : ${scriptEnCours}`);
            }
          }}
          onError={() => {
            ajouter('erreur', `Échec du chargement du script : ${scriptEnCours}`);
            setIndexScript((index) => index + 1);
          }}
        />
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Test interne — non indexé</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Labo simulateur Wizart</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choisissez une pièce, essayez des teintes dans le visualiseur, puis cliquez sur « Calculer mes
          quantités » dans le panier Wizart. Tout est consigné dans le journal (bouton en bas à gauche).
        </p>
      </div>

      {!TOKEN && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Token Wizart absent</p>
          <p className="mt-1">
            La variable <code>NEXT_PUBLIC_WIZART_TOKEN</code> n’est pas définie pour ce déploiement : le
            visualiseur ne peut pas s’ouvrir. Ajoutez-la dans Vercel (environnement Preview), puis redéployez.
          </p>
        </div>
      )}

      <dl className="grid gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="font-medium text-gray-700">Script DepKit</dt>
        <dd className="break-all text-gray-600">
          {scriptCharge
            ? `chargé — ${scriptCharge}`
            : scriptEnCours
              ? `chargement… (${scriptEnCours})`
              : 'échec : aucune version n’a pu être chargée'}
        </dd>
        <dt className="font-medium text-gray-700">Teinte demandée</dt>
        <dd className="break-all text-gray-600">
          {teinte ? (
            <code>{teinte}</code>
          ) : (
            <>
              aucune (ajouter <code>?teinte=&#123;handle&#125;</code> à l’URL pour tester l’ouverture sur une teinte)
            </>
          )}
        </dd>
        <dt className="font-medium text-gray-700">Visualiseur</dt>
        <dd className="text-gray-600">
          {etat === 'ouvert' ? 'ouvert' : etat === 'chargement' ? 'chargement…' : 'fermé'}
        </dd>
      </dl>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">Quelle pièce ?</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.entries(PIECES) as [TypePiece, string][]).map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              disabled={etat === 'chargement'}
              onClick={() => void ouvrirVisualiseur(valeur)}
              className={`rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                piece === valeur
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-800 hover:border-primary-400'
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
        {piece && etat === 'ferme' && (
          <p className="mt-2 text-sm text-gray-600">
            Pièce enregistrée : <strong>{PIECES[piece]}</strong>. Cliquez sur une pièce pour (r)ouvrir le
            visualiseur.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">
          Événements disponibles dans VISUALIZER_EVENTS{kit ? ` (${evenements.length})` : ''}
        </h2>
        {kit ? (
          <>
            <p className="mt-1 text-sm text-gray-700">
              Événement <code>open_in_store</code> :{' '}
              <strong>{openInStore ? `oui (${openInStore[0]})` : 'non'}</strong>
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {evenements.map((cle) => (
                <li key={cle} className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                  {cle}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-gray-600">En attente du chargement du script…</p>
        )}
      </section>

      {/* Cible du visualiseur : le DepKit remplace son contenu par l'iframe (plein écran) */}
      <div ref={cibleRef} />

      <div className="fixed bottom-2 left-2 z-[2147483647] max-w-[calc(100vw-1rem)]">
        {journalOuvert ? (
          <div className="flex max-h-[70vh] w-[28rem] max-w-full flex-col rounded-lg border border-gray-300 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-2">
              <h2 className="mr-auto text-sm font-semibold text-gray-900">Journal ({journal.length})</h2>
              <button
                type="button"
                onClick={() => void copierJournal()}
                className="rounded bg-primary-600 px-2 py-1 text-xs font-medium text-white"
              >
                Copier le journal
              </button>
              <button
                type="button"
                onClick={viderJournal}
                className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700"
              >
                Vider le journal
              </button>
              {etat !== 'ferme' && (
                <button
                  type="button"
                  onClick={fermerVisualiseur}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700"
                >
                  Fermer le visualiseur
                </button>
              )}
              <button
                type="button"
                onClick={() => setJournalOuvert(false)}
                className="rounded px-2 py-1 text-xs font-medium text-gray-500"
                aria-label="Replier le journal"
              >
                Replier
              </button>
            </div>
            {retourCopie && <p className="px-2 pt-2 text-xs text-gray-700">{retourCopie}</p>}
            {derniereSortie?.url && (
              <div className="m-2 rounded border border-green-200 bg-green-50 p-2 text-xs">
                <p className="font-semibold text-green-900">Dernière URL vers le configurateur</p>
                <p className="mt-1 break-all font-mono text-green-900">{derniereSortie.url}</p>
                <a
                  href={derniereSortie.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block rounded bg-green-700 px-2 py-1 font-medium text-white"
                >
                  Ouvrir le configurateur
                </a>
              </div>
            )}
            <ol className="flex-1 space-y-2 overflow-y-auto p-2">
              {journal.length === 0 && <li className="text-xs text-gray-500">Journal vide.</li>}
              {[...journal].reverse().map((entree) => (
                <li key={entree.id} className="rounded border border-gray-100 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-gray-500">{heureLisible(entree.heure)}</span>
                    <span className={`rounded px-1.5 py-0.5 font-medium ${COULEURS_TYPE[entree.type]}`}>
                      {LIBELLES_TYPE[entree.type]}
                    </span>
                  </div>
                  <p className="mt-1 break-words font-medium text-gray-900">{entree.titre}</p>
                  {entree.url && (
                    <div className="mt-1">
                      <p className="break-all font-mono text-gray-700">{entree.url}</p>
                      <a
                        href={entree.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block rounded bg-green-700 px-2 py-1 font-medium text-white"
                      >
                        Ouvrir le configurateur
                      </a>
                    </div>
                  )}
                  {entree.contenu !== undefined && (
                    <details className="mt-1" open={entree.type === 'sortie' || entree.type === 'panier'}>
                      <summary className="cursor-pointer text-gray-500">Contenu</summary>
                      <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-1.5 font-mono text-[11px] text-gray-800">
                        {entree.contenu}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setJournalOuvert(true)}
            className="rounded-full bg-gray-900/85 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          >
            Journal ({journal.length})
          </button>
        )}
      </div>
    </div>
  );
}
