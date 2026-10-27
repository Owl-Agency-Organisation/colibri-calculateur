import { createRequire } from 'node:module';
import { vi, type Mock } from 'vitest';

/**
 * Faux navigateur minimal pour exécuter le script hébergé de bout en bout dans
 * Vitest (environnement node, sans dépendance) : juste ce que embed/colibri.js
 * utilise du DOM, un faux `gtag`, un faux fetch de `/api/embed/teintes` et un
 * faux DepKit dont `VISUALIZER_EVENTS` reprend les valeurs du DepKit v1.1.3
 * (relevées dans son code le 27/10/2026).
 */

export const APP = 'https://calculateur.colibripeinture.com';
export const BOUTIQUE = 'https://www.colibripeinture.com';
export const ID_GA4 = 'G-GXWQE6WJRV';

export const VISUALIZER_EVENTS_V113 = {
  BACK_BUTTON_CLICK: 'back_button_clicked',
  PREDEFINED_INTERIOR_SELECT: 'predefined_interior_selected',
  PRODUCT_APPLY: 'apply',
  CLEAR_SURFACE: 'clear',
  OPEN_IN_STORE: 'open_in_store',
  CUSTOM_INTERIOR_SELECTION_START: 'custom_interior_selection_started',
  CUSTOM_INTERIOR_UPLOAD: 'photo_uploaded',
  CUSTOM_INTERIOR_SELECT: 'custom_interior_selected',
} as const;

export type CleDepKit = keyof typeof VISUALIZER_EVENTS_V113;

type Ecouteur = (evenement: { type: string }) => void;

export class FauxElement {
  readonly enfants: FauxElement[] = [];
  readonly attributs: Record<string, string> = {};
  readonly ecouteurs: Record<string, Ecouteur[]> = {};
  readonly style: Record<string, string> = {};
  parentNode: FauxElement | null = null;
  shadowRoot: FauxElement | null = null;
  contentWindow: { postMessage: Mock } | null = null;
  disabled = false;
  scrollLeft = 0;
  scrollWidth = 0;
  innerHTML = '';
  focus = vi.fn();
  private texte = '';

  constructor(readonly tagName: string) {
    if (tagName === 'iframe') this.contentWindow = { postMessage: vi.fn() };
  }

  get textContent(): string {
    return this.texte + this.enfants.map((e) => e.textContent).join('');
  }

  set textContent(valeur: string) {
    this.texte = valeur;
    this.enfants.length = 0;
  }

  setAttribute(cle: string, valeur: string): void {
    this.attributs[cle] = String(valeur);
  }

  getAttribute(cle: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attributs, cle) ? this.attributs[cle] : null;
  }

  appendChild(enfant: FauxElement): FauxElement {
    if (enfant.parentNode) enfant.parentNode.removeChild(enfant);
    enfant.parentNode = this;
    this.enfants.push(enfant);
    return enfant;
  }

  insertBefore(enfant: FauxElement, reference: FauxElement): FauxElement {
    this.appendChild(enfant);
    this.enfants.pop();
    this.enfants.splice(Math.max(0, this.enfants.indexOf(reference)), 0, enfant);
    return enfant;
  }

  removeChild(enfant: FauxElement): FauxElement {
    const index = this.enfants.indexOf(enfant);
    if (index !== -1) this.enfants.splice(index, 1);
    enfant.parentNode = null;
    return enfant;
  }

  addEventListener(type: string, ecouteur: Ecouteur): void {
    (this.ecouteurs[type] ??= []).push(ecouteur);
  }

  dispatchEvent(evenement: { type: string }): boolean {
    (this.ecouteurs[evenement.type] ?? []).forEach((ecouteur) => ecouteur(evenement));
    return true;
  }

  attachShadow(): FauxElement {
    this.shadowRoot = new FauxElement('#shadow-root');
    return this.shadowRoot;
  }

  cliquer(): void {
    this.dispatchEvent({ type: 'click' });
  }
}

/** Tous les éléments sous `racine` (Shadow DOM compris). */
export function elements(racine: FauxElement): FauxElement[] {
  const liste = [racine];
  racine.enfants.forEach((e) => liste.push(...elements(e)));
  if (racine.shadowRoot) liste.push(...elements(racine.shadowRoot));
  return liste;
}

interface Abonnement {
  rappel: (evenement: { eventName: string; data: unknown }) => void;
  valeur: string | null;
}

export interface FauxKit {
  abonnements: Map<symbol, Abonnement>;
  visualiseurs: { reglages: unknown; detruit: boolean }[];
  /** Émet un événement DepKit, comme le vrai : `eventName` = la clé, filtre sur la valeur */
  emettre(cle: CleDepKit, data?: unknown): void;
}

export interface OptionsFauxNavigateur {
  url: string;
  avecGtag?: boolean;
  /** Mode de la balise du script (`data-colibri`) et ses autres attributs */
  attributsScript?: Record<string, string>;
  /** sessionStorage hérité de la page précédente (même onglet) */
  session?: Map<string, string>;
  /** Références connues de `/api/embed/teintes` */
  references?: Record<string, unknown>[];
  /** `/api/embed/teintes` ne répond jamais */
  apiBloquee?: boolean;
  /** Le DepKit ne finit jamais de charger, ou échoue */
  chargement?: 'normal' | 'bloque' | 'echec';
}

export interface FauxNavigateur {
  fenetre: Record<string, unknown> & { location: { href: string; pathname: string; search: string } };
  body: FauxElement;
  hote: FauxElement;
  session: Map<string, string>;
  gtag: Mock;
  info: Mock;
  fetch: Mock;
  kit: FauxKit;
  navigations: string[];
  /** Message reçu par la page (écouteur `message` de la fenêtre) */
  recevoir(message: { origin: string; source: unknown; data: unknown }): void;
  /** Événements GA4 envoyés : [nom, paramètres] */
  evenementsGa4(): [string, Record<string, unknown>][];
  trouver(predicat: (e: FauxElement) => boolean): FauxElement | undefined;
  parClasse(classe: string): FauxElement | undefined;
}

export const REFERENCES = [
  { handle: 'horizon', nom: 'Horizon', hex: '#8fa9b8', type: 'peinture', image: null, lien: null },
  {
    handle: 'pp-montg-terracotta-le', nom: 'Montgolfières Terracotta', hex: null, type: 'papier-peint',
    image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/mockup.png', lien: null,
  },
];

/** Charge de `PRODUCT_APPLY` (forme du DepKit v1.1.3) pour une référence. */
export function chargeApplication(reference: string, nom = reference) {
  return {
    product_identifiers: [`id-${reference}`],
    products: [{ [`collection_${reference}`]: { article_sku: reference, article_custom_sku: reference, article_name: nom } }],
    custom_product: null,
    is_interactive_apply: true,
    room_id: 'piece',
  };
}

/** Laisse passer les Promise en attente (chargement du kit, fetch, file des envois). */
export async function attendre(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Copie neuve du script (état de module remis à zéro), comme un nouveau chargement de page. */
export function chargerScript<T>(): T {
  const require = createRequire(import.meta.url);
  const chemin = require.resolve('../colibri.js');
  delete require.cache[chemin];
  return require(chemin) as T;
}

export function installerFauxNavigateur(options: OptionsFauxNavigateur): FauxNavigateur {
  const url = new URL(options.url);
  const session = options.session ?? new Map<string, string>();
  const navigations: string[] = [];
  const ecouteursFenetre: Record<string, ((evenement: unknown) => void)[]> = {};

  const documentElement = new FauxElement('html');
  const head = new FauxElement('head');
  const body = new FauxElement('body');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const mode = options.attributsScript?.['data-colibri'];
  const idHote = mode === 'simulateur' ? 'colibri-simulateur' : mode === 'bouton' ? 'colibri-bouton-teinte' : 'colibri-configurator';
  const hote = new FauxElement('div');
  hote.setAttribute('id', idHote);
  body.appendChild(hote);
  const script = new FauxElement('script');
  Object.entries(options.attributsScript ?? {}).forEach(([cle, valeur]) => script.setAttribute(cle, valeur));
  body.appendChild(script);

  // ----- Faux DepKit -----
  const abonnements = new Map<symbol, Abonnement>();
  const visualiseurs: FauxKit['visualiseurs'] = [];
  const chargement = options.chargement ?? 'normal';
  class Visualizer {
    private readonly suivi: { reglages: unknown; detruit: boolean };
    constructor(reglages: unknown) {
      this.suivi = { reglages, detruit: false };
      visualiseurs.push(this.suivi);
    }
    load(): Promise<void> {
      if (chargement === 'bloque') return new Promise(() => {});
      if (chargement === 'echec') return Promise.reject(new Error('échec du chargement (test)'));
      return Promise.resolve();
    }
    show(): Promise<void> {
      return Promise.resolve();
    }
    destroy(): void {
      this.suivi.detruit = true;
    }
  }
  const kit: FauxKit = {
    abonnements,
    visualiseurs,
    emettre(cle, data = {}) {
      const valeur = VISUALIZER_EVENTS_V113[cle];
      [...abonnements.values()].forEach((a) => {
        if (a.valeur === null || a.valeur === valeur) a.rappel({ eventName: cle, data });
      });
    },
  };
  const WizartDeploymentKit = {
    Visualizer,
    EventBus: {
      subscribe(rappel: Abonnement['rappel'], valeur: string | null = null) {
        const id = Symbol('abonnement');
        abonnements.set(id, { rappel, valeur });
        return id;
      },
      unsubscribe(id: symbol) {
        abonnements.delete(id);
      },
    },
    VISUALIZER_EVENTS: VISUALIZER_EVENTS_V113,
    LAYOUTS: { FULL_SCREEN: 'wizart-full-screen', FILL_PARENT: 'wizart-fill-parrent', CUSTOM_SIZE: 'wizart-custom' },
  };

  // ----- Fenêtre -----
  const location = {
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    get href() {
      return url.href;
    },
    set href(valeur: string) {
      navigations.push(valeur);
    },
  };
  const gtag = vi.fn();
  const info = vi.fn();
  const fenetre: FauxNavigateur['fenetre'] = {
    location,
    history: { state: null, replaceState: vi.fn() },
    sessionStorage: {
      getItem: (cle: string) => session.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => { session.set(cle, String(valeur)); },
      removeItem: (cle: string) => { session.delete(cle); },
    },
    console: { info, warn: vi.fn() },
    scrollTo: vi.fn(),
    addEventListener: (type: string, ecouteur: (evenement: unknown) => void) => {
      (ecouteursFenetre[type] ??= []).push(ecouteur);
    },
    WizartDeploymentKit,
  };
  if (options.avecGtag !== false) fenetre.gtag = gtag;

  const fetch = vi.fn((adresse: string) => {
    if (options.apiBloquee) return new Promise(() => {});
    const handles = (new URL(adresse).searchParams.get('handles') ?? '').split(',');
    const connues = (options.references ?? REFERENCES).filter((r) => handles.includes(String(r.handle)));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(connues) });
  });

  const document = {
    currentScript: script,
    documentElement,
    head,
    body,
    createElement: (balise: string) => new FauxElement(balise),
    createTextNode: (texte: string) => {
      const noeud = new FauxElement('#text');
      noeud.textContent = texte;
      return noeud;
    },
    getElementById: (id: string) => elements(documentElement).find((e) => e.getAttribute('id') === id) ?? null,
    addEventListener: vi.fn(),
  };

  vi.stubGlobal('window', fenetre);
  vi.stubGlobal('document', document);
  vi.stubGlobal('fetch', fetch);
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  const trouver = (predicat: (e: FauxElement) => boolean) => elements(documentElement).find(predicat);

  return {
    fenetre,
    body,
    hote,
    session,
    gtag,
    info,
    fetch,
    kit,
    navigations,
    recevoir(message) {
      (ecouteursFenetre.message ?? []).forEach((ecouteur) => ecouteur(message));
    },
    evenementsGa4() {
      return gtag.mock.calls.map((appel) => {
        if (appel[0] !== 'event') throw new Error(`gtag appelé avec « ${String(appel[0])} » au lieu de « event »`);
        return [appel[1] as string, appel[2] as Record<string, unknown>];
      });
    },
    trouver,
    parClasse: (classe) => trouver((e) => e.getAttribute('class') === classe),
  };
}
