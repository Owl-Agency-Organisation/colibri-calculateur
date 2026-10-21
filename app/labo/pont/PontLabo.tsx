'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clearProjetData } from '@/lib/store/projetStore';
import { LIBELLES_PIECES } from '@/lib/pieces';
import { libellePapierPeint, type PapierPeint } from '@/lib/papierPeint';
import type { TypePiece } from '@/lib/types';

/**
 * Labo du pont simulateur : charge le vrai script `/embed/colibri.js` de ce
 * déploiement en mode `configurateur`, comme la page Shopify, avec un faux
 * `WizartDeploymentKit` qui remplace uniquement Wizart. Le faux simulateur
 * s'affiche dans la vraie surimpression, au-dessus de la vraie barre Colibri :
 * « Appliquer sur le mur » émet `PRODUCT_APPLY` (forme réelle du DepKit
 * v1.1.3), sans panier ; la sortie passe par la barre (« Fermer » /
 * « Utiliser… »). Il propose aussi deux papiers peints réels (SKU de variante
 * « Lé »), résolus par la vraie route du preview.
 */

const HANDLE_INCONNU = 'teinte-inconnue-test';
const CLE_SESSION_PIECE = 'colibri-simulateur-piece';
const TEINTE_INCONNUE: Teinte = { handle: HANDLE_INCONNU, titre: 'Teinte inconnue (test)', nomComplet: 'Inconnue - Teinte de test' };

// Papiers peints réels de la boutique : référence Wizart = SKU de la variante « Lé »
const SKUS_PAPIERS_PEINTS = ['pp-montg-terracotta-le', 'pp-ombre-bleunuit-le'];

interface Teinte {
  /** Référence Wizart (`article_sku`) : handle de teinte ou SKU de papier peint */
  handle: string;
  titre: string;
  /** Nom produit Wizart (`article_name`) */
  nomComplet: string;
  /** Papier peint : image de la variante (vraie route de résolution) */
  imageUrl?: string | null;
  papierPeint?: boolean;
}

/** Papier peint résolu par `/api/shopify/papier-peint/{sku}` (nom et image réels) */
async function chargerPapierPeintLabo(sku: string): Promise<Teinte> {
  try {
    const reponse = await fetch(`/api/shopify/papier-peint/${sku}`);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const papier: PapierPeint = await reponse.json();
    return {
      handle: sku,
      titre: `Papier peint ${libellePapierPeint(papier.motif, papier.coloris)}`,
      nomComplet: libellePapierPeint(papier.motif, papier.coloris, ' - '),
      imageUrl: papier.imageUrl,
      papierPeint: true,
    };
  } catch (erreur) {
    // Résolution indisponible (Admin API) : le SKU reste appliquable, sans nom ni image
    return {
      handle: sku,
      titre: `Papier peint ${sku} (résolution : ${erreur instanceof Error ? erreur.message : String(erreur)})`,
      nomComplet: sku,
      papierPeint: true,
    };
  }
}

interface EntreeJournal {
  id: number;
  heure: string;
  sens: string;
  message: string;
}

// ---------- Faux Wizart Deployment Kit ----------

interface OptionsVisualiseur {
  layoutSettings: { targetElement: HTMLElement; layout?: unknown };
  integrationSettings?: Record<string, unknown>;
  sceneData?: { openWithProduct?: string; openInRoom?: string };
}

interface FauxVisualiseur {
  readonly cible: HTMLElement;
  readonly teinteInitiale: string | null;
  /** `sceneData.openInRoom` reçu (UUID d'intérieur Wizart), null = galerie */
  readonly interieur: string | null;
  readonly options: OptionsVisualiseur;
}

interface ControleurFaux {
  ouvrir(visualiseur: FauxVisualiseur): void;
  fermer(visualiseur: FauxVisualiseur): void;
}

type RappelEvenement = (evenement: { eventName: string; data: unknown }) => void;

const EVENEMENTS = {
  PRODUCT_APPLY: 'product_apply',
  BACK_BUTTON_CLICK: 'back_button_click',
} as const;

/** Charge de `PRODUCT_APPLY`, même forme que le DepKit v1.1.3 (embed/fixtures) */
function chargeApplication(handle: string, nomComplet: string, interactive: boolean) {
  return {
    product_identifiers: [`labo-${handle}`],
    search: false,
    use_filters_values: false,
    mana: false,
    products: [
      {
        [`labo_${handle}`]: {
          brand_uuid: 'labo',
          collection_uuid: 'labo',
          article_uuid: `labo-${handle}`,
          article_name: nomComplet,
          article_sku: handle,
          article_custom_sku: handle,
          article_image_path: '',
        },
      },
    ],
    custom_product: null,
    is_interactive_apply: interactive,
    room_id: 'labo-piece',
  };
}

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
    readonly interieur: string | null;
    readonly options: OptionsVisualiseur;
    isLoaded = false;

    constructor(options: OptionsVisualiseur) {
      this.options = options;
      this.cible = options.layoutSettings.targetElement;
      this.teinteInitiale = options.sceneData?.openWithProduct ?? null;
      this.interieur = options.sceneData?.openInRoom ?? null;
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
      LAYOUTS: { FULL_SCREEN: 'full_screen', FILL_PARENT: 'fill_parent', CUSTOM_SIZE: 'custom_size' },
    },
  });

  return emettre;
}

// Intérieurs du compte Colibri (relevés le 16/10/2026), pour afficher ce que
// le script a demandé à Wizart. Référence de contrôle indépendante de la table
// du script : un écart s'y voit tout de suite.
const INTERIEURS_CONNUS: Record<string, string> = {
  '0ccc39c1-6379-4070-934d-f7459ce15247': 'pièce de vie (salon Wizart_012)',
  '1103ea18-8a07-4f59-a1d3-86d08b406755': 'chambre (Wizart_017)',
  'fe9bfc03-6fe5-403d-a6a1-5feb5c71c10c': 'cuisine (Wizart_018)',
  '00bb8d0e-5dcc-4893-93bc-d4b1b79ae60f': 'salle de bain / toilettes (GO-6041 2)',
};

function libelleInterieur(uuid: string | null): string {
  if (!uuid) return 'Galerie (aucun intérieur demandé)';
  const nom = INTERIEURS_CONNUS[uuid] ?? 'inconnu';
  return `Intérieur : ${nom} (${uuid.slice(0, 8)}…)`;
}

const TYPES_PIECES = Object.keys(LIBELLES_PIECES) as TypePiece[];

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
  // Teinte posée sur chaque mur de la fausse photo (affichage seulement)
  const [murs, setMurs] = useState<(Teinte | null)[]>([null, null, null]);
  const [murActif, setMurActif] = useState(0);
  const [retour, setRetour] = useState<string | null>(null);
  // Dernière pièce transmise par colibri:simulateur:ouvrir (journal du script)
  const [pieceDemandee, setPieceDemandee] = useState<string | null>(null);

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

  // Dernières teintes connues, pour l'ouverture sur une teinte (openWithProduct)
  const teintesRef = useRef<Teinte[]>([]);
  teintesRef.current = teintes;

  const appliquer = useCallback((teinte: Teinte, mur: number, interactive: boolean) => {
    setMurs((precedents) => precedents.map((t, i) => (i === mur ? teinte : t)));
    const data = chargeApplication(teinte.handle, teinte.nomComplet, interactive);
    consigner('faux Wizart', { evenement: 'PRODUCT_APPLY', mur: mur + 1, article_sku: teinte.handle });
    emettreRef.current?.(EVENEMENTS.PRODUCT_APPLY, data);
  }, [consigner]);

  controleurRef.current = {
    ouvrir(visualiseur) {
      setMurs([null, null, null]);
      setMurActif(0);
      setFauxOuvert(visualiseur);
      consigner('faux Wizart', {
        ouvert: true,
        layout: visualiseur.options.layoutSettings.layout,
        integrationSettings: visualiseur.options.integrationSettings,
        openWithProduct: visualiseur.teinteInitiale,
        openInRoom: visualiseur.interieur,
      });
      // Comme Wizart : la teinte d'ouverture est appliquée (non interactive)
      const initiale = visualiseur.teinteInitiale;
      if (initiale) {
        const connue = teintesRef.current.find((t) => t.handle === initiale);
        appliquer(connue ?? { handle: initiale, titre: initiale, nomComplet: initiale }, 0, false);
      }
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
        const message = detail.message;
        if (
          typeof message === 'object' && message !== null
          && 'type' in message && message.type === 'colibri:simulateur:ouvrir'
          && 'piece' in message && typeof message.piece === 'string'
        ) {
          setPieceDemandee(message.piece);
        }
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
              nomComplet: p.title,
            }));
          })
        );
        const papiers = await Promise.all(SKUS_PAPIERS_PEINTS.map(chargerPapierPeintLabo));
        setTeintes([...listes.flat(), ...papiers, TEINTE_INCONNUE]);
      } catch (erreur) {
        setErreurCatalogue(erreur instanceof Error ? erreur.message : String(erreur));
        setTeintes([...(await Promise.all(SKUS_PAPIERS_PEINTS.map(chargerPapierPeintLabo))), TEINTE_INCONNUE]);
      }
    };
    charger();
  }, []);

  const nettoyer = () => {
    setMurs((precedents) => precedents.map((t, i) => (i === murActif ? null : t)));
    // Wizart n'émet rien d'utile ici : la barre garde la teinte
    consigner('faux Wizart', { surfaceNettoyee: murActif + 1 });
  };

  const retourWizart = () => {
    consigner('faux Wizart', { evenement: 'BACK_BUTTON_CLICK' });
    emettreRef.current?.(EVENEMENTS.BACK_BUTTON_CLICK, {});
  };

  // Envoie colibri:simulateur:ouvrir depuis l'iframe de l'app, exactement
  // comme la popup couleur (le script n'accepte que les messages de l'iframe)
  const ouvrirCommeApp = (piece: TypePiece) => {
    const iframe = hoteRef.current?.querySelector('iframe');
    const fenetre = iframe?.contentWindow as (Window & typeof globalThis) | null | undefined;
    if (!fenetre) {
      consigner('labo', { erreur: 'iframe de l’app introuvable' });
      return;
    }
    const message = JSON.stringify({ type: 'colibri:simulateur:ouvrir', piece });
    // Fonction créée dans l'iframe : le message part bien de sa fenêtre
    new fenetre.Function(`window.parent.postMessage(${message}, window.location.origin);`)();
  };

  const viderProjet = () => {
    clearProjetData();
    setRetour('Projet vidé (pièces et teintes essayées). Rechargez l’iframe via un lien d’entrée.');
    setTimeout(() => setRetour(null), 4000);
  };

  const reels = teintes.filter((t) => t.handle !== HANDLE_INCONNU && !t.papierPeint).map((t) => t.handle);
  const papiers = teintes.filter((t) => t.papierPeint).map((t) => t.handle);
  // Résultat attendu à l'arrivée : un mur avec la dernière peinture connue,
  // les papiers peints au récapitulatif
  const attendu = (handles: string[]) => {
    const peintures = handles.filter((h) => reels.includes(h));
    const nombrePapiers = handles.filter((h) => papiers.includes(h)).length;
    const derniere = teintes.find((t) => t.handle === peintures[peintures.length - 1]);
    const mentionPapiers = nombrePapiers > 0
      ? ` ; ${nombrePapiers} papier${nombrePapiers > 1 ? 's' : ''} peint${nombrePapiers > 1 ? 's' : ''} au récapitulatif`
      : '';
    if (!derniere) {
      return nombrePapiers > 0
        ? <span className="block text-xs text-gray-500">→ 1 mur sans couleur{mentionPapiers}</span>
        : null;
    }
    return (
      <span className="block text-xs text-gray-500">
        → 1 mur : {derniere.titre} ; {peintures.length} teinte{peintures.length > 1 ? 's' : ''} essayée{peintures.length > 1 ? 's' : ''}{mentionPapiers}
      </span>
    );
  };
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
        <p className="text-xs text-gray-600">
          Arrivée depuis la page Simulateur : un seul mur est créé, avec la dernière teinte de la liste
          (la plus récente) ; toutes rejoignent « Vos teintes essayées », la plus récente en tête. Videz le
          projet avant un scénario pour partir d’un bloc vide.
        </p>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li><a className="text-primary-500 underline" href="/labo/pont">Sans entrée (accueil de l’app)</a></li>
          {reels.length >= 2 && (
            <li><a className="text-primary-500 underline" href={lien('chambre', reels.slice(0, 2))}>Chambre + 2 teintes</a>{attendu(reels.slice(0, 2))}</li>
          )}
          {reels.length >= 3 && (
            <li><a className="text-primary-500 underline" href={lien('cuisine', reels.slice(0, 3))}>Cuisine + 3 teintes</a>{attendu(reels.slice(0, 3))}</li>
          )}
          {reels.length >= 4 && (
            <li><a className="text-primary-500 underline" href={lien('piece-de-vie', reels.slice(0, 4))}>Pièce de vie + 4 teintes</a>{attendu(reels.slice(0, 4))}</li>
          )}
          {reels.length >= 12 && (
            <li><a className="text-primary-500 underline" href={lien('chambre', reels.slice(0, 12))}>Chambre + 12 teintes (plafond du bloc)</a>{attendu(reels.slice(0, 12))}</li>
          )}
          {reels.length >= 1 && (
            <li><a className="text-primary-500 underline" href={lien('chambre', [reels[0], HANDLE_INCONNU])}>Chambre + 1 teinte + 1 inconnue</a>{attendu([reels[0]])}</li>
          )}
          {reels.length >= 2 && papiers.length >= 1 && (
            <li><a className="text-primary-500 underline" href={lien('chambre', [reels[0], papiers[0], reels[1]])}>Chambre + 2 teintes + 1 papier peint</a>{attendu([reels[0], papiers[0], reels[1]])}</li>
          )}
          {papiers.length >= 1 && (
            <li><a className="text-primary-500 underline" href={lien('chambre', [papiers[0]])}>Chambre + papier peint seul</a>{attendu([papiers[0]])}</li>
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
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-700">
            Ouvrir le simulateur comme la popup couleur de l’app, pour la pièce&nbsp;:
          </p>
          <p className="text-xs text-gray-600">
            Popup d’un mur avec un papier peint seul&nbsp;: dans la page Surfaces, ouvrir la couleur d’un mur,
            «&nbsp;Essayer dans ma pièce&nbsp;», appliquer seulement un papier peint puis «&nbsp;Utiliser…&nbsp;» →
            la popup reste ouverte avec «&nbsp;Papier peint essayé&nbsp;: …&nbsp;».
          </p>
          <div className="flex flex-wrap gap-2">
            {TYPES_PIECES.map((piece) => (
              <button
                key={piece}
                type="button"
                onClick={() => ouvrirCommeApp(piece)}
                className="rounded border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm text-primary-600"
              >
                {LIBELLES_PIECES[piece]}
              </button>
            ))}
          </div>
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
        <div className="flex h-full flex-col bg-white">
          <div className="border-b border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Faux simulateur (labo)</p>
            <h2 className="text-lg font-bold text-gray-900">Appliquez des teintes sur les murs de la photo</h2>
            <p className="mt-2 inline-block rounded bg-amber-50 px-2 py-1 text-sm font-medium text-amber-800" data-labo="interieur">
              {libelleInterieur(fauxOuvert.interieur)}
              {pieceDemandee && <span className="font-normal"> — pièce demandée&nbsp;: {pieceDemandee}</span>}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Chaque application émet <code>PRODUCT_APPLY</code>. Aucun panier : la sortie se fait par la barre Colibri, en bas.
            </p>
          </div>
          <div className="flex gap-2 border-b border-gray-200 p-4">
            {murs.map((teinte, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setMurActif(index)}
                aria-pressed={murActif === index}
                className={`flex-1 rounded border p-3 text-left text-sm ${murActif === index ? 'border-primary-600 ring-2 ring-primary-200' : 'border-gray-200'}`}
              >
                <span className="block text-xs text-gray-500">Mur {index + 1}</span>
                <span className="block truncate font-medium text-gray-900">{teinte ? teinte.titre : '—'}</span>
              </button>
            ))}
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-4">
            {teintes.map((t) => (
              <li key={t.handle} className="flex items-center gap-3 rounded border border-gray-200 p-3 text-sm">
                {t.imageUrl && <img src={t.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
                <span className="flex-1">{t.titre}</span>
                <code className="hidden text-[11px] text-gray-500 sm:inline">{t.handle}</code>
                <button
                  type="button"
                  onClick={() => appliquer(t, murActif, true)}
                  className="rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Appliquer sur le mur {murActif + 1}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 border-t border-gray-200 p-4 text-sm">
            <button type="button" onClick={nettoyer} className="rounded border border-gray-300 px-3 py-1.5 text-gray-700">
              Nettoyer le mur {murActif + 1}
            </button>
            <button type="button" onClick={retourWizart} className="rounded border border-gray-300 px-3 py-1.5 text-gray-700">
              Émettre BACK_BUTTON_CLICK
            </button>
          </div>
        </div>,
        fauxOuvert.cible,
      )}
    </div>
  );
}
