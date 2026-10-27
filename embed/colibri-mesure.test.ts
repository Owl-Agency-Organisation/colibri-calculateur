import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_MESURES, type EvenementMesure, type ParametresMesure } from '@/lib/embed-messages';
import {
  APP,
  BOUTIQUE,
  ID_GA4,
  attendre,
  chargeApplication,
  chargerScript,
  installerFauxNavigateur,
  type FauxNavigateur,
  type OptionsFauxNavigateur,
} from './test/fauxNavigateur';

// Mesure GA4 du script hébergé : événements du simulateur (émis par le
// script) et du calculateur (relayés depuis l'app par `colibri:mesure`).

interface Config {
  origineApp: string;
  tokenWizart: string;
  labo?: boolean;
  idGa4?: string;
}

interface Mesure {
  envoyer(nom: string, parametres: unknown): void;
  marquerSimulateur(): void;
}

interface ScriptColibri {
  demarrer(racine: unknown, config: Config): void;
  MESURES_CALCULATEUR: Record<string, Record<string, string>>;
  lireMesure(donnees: Record<string, unknown>): Record<string, unknown> | null;
  lireMessageApp(donnees: unknown): Record<string, unknown> | null;
  lireIdGa4(valeur: unknown): string;
  idGa4Page(config: Config, idLabo: string | null): string;
  lireDebug(recherche: string, memorise: boolean): boolean;
  parametresCommuns(contexte: { simulateurOuvert: boolean; chemin: unknown; debug: boolean }): Record<string, unknown>;
  typeProduit(reference: unknown): string | null;
  origineSimulateur(teinte: string | null): string;
  evenementsMesures(evenements: Record<string, string> | undefined): { photo: string[]; exemple: string[] };
  evenementsEcoutes(evenements: Record<string, string> | undefined): { application: string[]; retour: string[] };
  avantDelai<T>(promesse: Promise<T>, delaiMs: number, parDefaut: T): Promise<T>;
  creerMesure(environnement: {
    idGa4: string;
    fenetre: Record<string, unknown>;
    session: { lire(cle: string): string | null; ecrire(cle: string, valeur: string | null): void };
  }): Mesure;
}

const CONFIG: Config = { origineApp: APP, tokenWizart: 'jeton', labo: false, idGa4: ID_GA4 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Page Shopify avec le script hébergé démarré dans le mode demandé. */
function page(
  mode: 'configurateur' | 'simulateur' | 'bouton',
  options: Partial<OptionsFauxNavigateur> = {},
  config: Config = CONFIG,
) {
  const chemin = mode === 'configurateur' ? '/pages/configurateur' : '/pages/simulateur';
  const navigateur = installerFauxNavigateur({
    url: `${BOUTIQUE}${chemin}`,
    ...options,
    attributsScript: { 'data-colibri': mode, ...options.attributsScript },
  });
  const script = chargerScript<ScriptColibri>();
  script.demarrer(navigateur.fenetre, config);
  return { navigateur, script };
}

function iframeApp(navigateur: FauxNavigateur) {
  const iframe = navigateur.trouver((e) => e.tagName === 'iframe');
  if (!iframe?.contentWindow) throw new Error('iframe de l’app absente');
  return iframe.contentWindow;
}

/** Message de l'app (bonne origine, émis par l'iframe), comme la vraie popup couleur ou lib/mesure. */
function depuisApp(navigateur: FauxNavigateur, data: unknown) {
  navigateur.recevoir({ origin: APP, source: iframeApp(navigateur), data });
}

function cliquerPiece(navigateur: FauxNavigateur, libelle: string) {
  const carte = navigateur.trouver((e) => e.getAttribute('class') === 'piece' && e.textContent === libelle);
  if (!carte) throw new Error(`pièce ${libelle} absente`);
  carte.cliquer();
}

function bouton(navigateur: FauxNavigateur, classe: string) {
  const element = navigateur.parClasse(classe);
  if (!element) throw new Error(`bouton .${classe} absent`);
  return element;
}

// Paramètres communs attendus sur /pages/configurateur une fois le simulateur ouvert
const COMMUNS = { parcours_simulateur: 'oui', send_to: ID_GA4 };

describe('mesure GA4 — événements DepKit → GA4 (popup couleur du calculateur)', () => {
  it('ouverture, teinte puis papier peint appliqués, « Utiliser… » : événements et paramètres, dans l’ordre', async () => {
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    await attendre();
    navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('horizon', 'Horizon - Peinture'));
    navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('pp-montg-terracotta-le', 'Montgolfières - Terracotta'));
    await attendre();
    bouton(navigateur, 'utiliser').cliquer();
    await attendre();

    expect(navigateur.evenementsGa4()).toEqual([
      ['simulateur_ouvert', { origine: 'calculateur', piece: 'chambre', ...COMMUNS }],
      ['simulateur_produit_applique', {
        origine: 'calculateur', type_produit: 'peinture', produit: 'horizon', rang_essai: 1, ...COMMUNS,
      }],
      ['simulateur_produit_applique', {
        origine: 'calculateur', type_produit: 'papier_peint', produit: 'pp-montg-terracotta-le', rang_essai: 2, ...COMMUNS,
      }],
      ['simulateur_choix_utilise', { origine: 'calculateur', nb_essais: 2, ...COMMUNS }],
    ]);
    // Le pont lui-même est inchangé : la sélection part vers l'app
    expect(iframeApp(navigateur).postMessage).toHaveBeenCalledWith(
      { type: 'colibri:simulateur:selection', teintes: ['horizon', 'pp-montg-terracotta-le'] }, APP,
    );
  });

  it('« Utiliser… » avant la réponse de l’API : les événements restent dans l’ordre des actions', async () => {
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'cuisine' });
    await attendre();
    navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('horizon'));
    bouton(navigateur, 'utiliser').cliquer();
    expect(navigateur.evenementsGa4().map(([nom]) => nom)).toEqual(['simulateur_ouvert']);
    await attendre();
    expect(navigateur.evenementsGa4().map(([nom]) => nom))
      .toEqual(['simulateur_ouvert', 'simulateur_produit_applique', 'simulateur_choix_utilise']);
  });

  it('une teinte réappliquée compte comme une nouvelle application (rang = place dans « Vos essais »)', async () => {
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    await attendre();
    ['horizon', 'pp-montg-terracotta-le', 'horizon'].forEach((r) => navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication(r)));
    await attendre();
    const applications = navigateur.evenementsGa4().filter(([nom]) => nom === 'simulateur_produit_applique');
    expect(applications.map(([, p]) => [p.produit, p.rang_essai]))
      .toEqual([['horizon', 1], ['pp-montg-terracotta-le', 2], ['horizon', 2]]);
  });

  it('référence inconnue de la boutique : envoyée sans type_produit', async () => {
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    await attendre();
    navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('teinte-inconnue'));
    await attendre();
    expect(navigateur.evenementsGa4()[1]).toEqual(['simulateur_produit_applique', {
      origine: 'calculateur', produit: 'teinte-inconnue', rang_essai: 1, ...COMMUNS,
    }]);
  });

  it('API muette : envoyée sans type_produit après 4 s, la file repart', async () => {
    const { navigateur } = page('configurateur', { apiBloquee: true });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
      await vi.advanceTimersByTimeAsync(10);
      navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('horizon'));
      bouton(navigateur, 'utiliser').cliquer();
      await vi.advanceTimersByTimeAsync(3900);
      expect(navigateur.evenementsGa4()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(200);
    } finally {
      vi.useRealTimers();
    }
    expect(navigateur.evenementsGa4().slice(1)).toEqual([
      ['simulateur_produit_applique', { origine: 'calculateur', produit: 'horizon', rang_essai: 1, ...COMMUNS }],
      ['simulateur_choix_utilise', { origine: 'calculateur', nb_essais: 1, ...COMMUNS }],
    ]);
  });

  it('photo importée et pièce d’exemple (CUSTOM_INTERIOR_UPLOAD, PREDEFINED_INTERIOR_SELECT)', async () => {
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    await attendre();
    navigateur.kit.emettre('CUSTOM_INTERIOR_UPLOAD', { image: 'blob:photo-du-client' });
    navigateur.kit.emettre('PREDEFINED_INTERIOR_SELECT', { room_id: 'x' });
    // Événements DepKit sans correspondance GA4
    navigateur.kit.emettre('CLEAR_SURFACE');
    navigateur.kit.emettre('OPEN_IN_STORE');
    navigateur.kit.emettre('CUSTOM_INTERIOR_SELECT');
    expect(navigateur.evenementsGa4().slice(1)).toEqual([
      ['simulateur_photo_importee', { origine: 'calculateur', ...COMMUNS }],
      ['simulateur_piece_exemple', { origine: 'calculateur', ...COMMUNS }],
    ]);
    // Jamais la photo ni son URL
    expect(JSON.stringify(navigateur.gtag.mock.calls)).not.toContain('blob:');
  });

  it('fermeture sans choix : sortie barre, wizart ou chargement, avec nb_essais', async () => {
    const fermer = async (
      action: (n: FauxNavigateur) => void,
      chargement: OptionsFauxNavigateur['chargement'] = 'normal',
      essais = 0,
    ) => {
      const { navigateur } = page('configurateur', { chargement });
      depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
      await attendre();
      if (essais > 0) navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('horizon'));
      action(navigateur);
      await attendre();
      expect(iframeApp(navigateur).postMessage).toHaveBeenCalledWith({ type: 'colibri:simulateur:ferme' }, APP);
      const fermetures = navigateur.evenementsGa4().filter(([nom]) => nom === 'simulateur_ferme');
      expect(fermetures).toHaveLength(1);
      vi.unstubAllGlobals();
      return fermetures[0][1];
    };

    expect(await fermer((n) => bouton(n, 'retour').cliquer(), 'normal', 1))
      .toEqual({ origine: 'calculateur', sortie: 'barre', nb_essais: 1, ...COMMUNS });
    expect(await fermer((n) => n.kit.emettre('BACK_BUTTON_CLICK')))
      .toEqual({ origine: 'calculateur', sortie: 'wizart', nb_essais: 0, ...COMMUNS });
    expect(await fermer((n) => bouton(n, 'lien').cliquer(), 'bloque'))
      .toEqual({ origine: 'calculateur', sortie: 'chargement', nb_essais: 0, ...COMMUNS });
    expect(await fermer(() => {}, 'echec'))
      .toEqual({ origine: 'calculateur', sortie: 'chargement', nb_essais: 0, ...COMMUNS });
  });

  it('après « Utiliser… », plus aucune fermeture mesurée', async () => {
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    await attendre();
    navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('horizon'));
    bouton(navigateur, 'utiliser').cliquer();
    navigateur.kit.emettre('BACK_BUTTON_CLICK');
    await attendre();
    expect(navigateur.evenementsGa4().map(([nom]) => nom))
      .toEqual(['simulateur_ouvert', 'simulateur_produit_applique', 'simulateur_choix_utilise']);
  });
});

describe('mesure GA4 — page Simulateur', () => {
  it('choix de la pièce puis ouverture (origine page_simulateur), « Utiliser… » mesuré avant la navigation', async () => {
    const { navigateur } = page('simulateur');
    cliquerPiece(navigateur, 'Cuisine');
    await attendre();
    navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('horizon'));
    await attendre();
    bouton(navigateur, 'utiliser').cliquer();
    expect(navigateur.navigations).toEqual([`${BOUTIQUE}/pages/configurateur?piece=cuisine&teintes=horizon`]);
    await attendre();
    expect(navigateur.evenementsGa4()).toEqual([
      ['simulateur_piece_choisie', { piece: 'cuisine', parcours_simulateur: 'non', send_to: ID_GA4 }],
      ['simulateur_ouvert', { origine: 'page_simulateur', piece: 'cuisine', ...COMMUNS }],
      ['simulateur_produit_applique', {
        origine: 'page_simulateur', type_produit: 'peinture', produit: 'horizon', rang_essai: 1, ...COMMUNS,
      }],
      ['simulateur_choix_utilise', { origine: 'page_simulateur', nb_essais: 1, ...COMMUNS }],
    ]);
  });

  it('arrivée par le bouton d’une fiche produit (?teinte=) : origine fiche_produit', async () => {
    const navigateur = installerFauxNavigateur({
      url: `${BOUTIQUE}/pages/simulateur?teinte=pp-montg-terracotta-le`,
      attributsScript: { 'data-colibri': 'simulateur' },
    });
    chargerScript<ScriptColibri>().demarrer(navigateur.fenetre, CONFIG);
    cliquerPiece(navigateur, 'Chambre');
    await attendre();
    bouton(navigateur, 'retour').cliquer();
    expect(navigateur.evenementsGa4().map(([nom, p]) => [nom, p.origine])).toEqual([
      ['simulateur_piece_choisie', undefined],
      ['simulateur_ouvert', 'fiche_produit'],
      ['simulateur_ferme', 'fiche_produit'],
    ]);
  });

  it('le bouton des fiches produit n’envoie rien lui-même', () => {
    const navigateur = installerFauxNavigateur({
      url: `${BOUTIQUE}/products/horizon`, attributsScript: { 'data-colibri': 'bouton' },
    });
    navigateur.hote.setAttribute('data-teinte', 'horizon');
    chargerScript<ScriptColibri>().demarrer(navigateur.fenetre, CONFIG);
    const lien = navigateur.parClasse('bouton');
    expect(lien?.getAttribute('href')).toBe('/pages/simulateur?teinte=horizon');
    lien?.cliquer();
    expect(navigateur.gtag).not.toHaveBeenCalled();
  });
});

describe('mesure GA4 — paramètres communs', () => {
  it('parcours_simulateur : « non » avant toute ouverture, « oui » ensuite, pour toute la session', async () => {
    const simulateur = page('simulateur');
    cliquerPiece(simulateur.navigateur, 'Chambre');
    await attendre();
    bouton(simulateur.navigateur, 'retour').cliquer();
    const session = simulateur.navigateur.session;
    vi.unstubAllGlobals();

    // Même onglet, page suivante : la session garde l'ouverture
    const { navigateur } = page('configurateur', { session });
    depuisApp(navigateur, { type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} });
    expect(navigateur.evenementsGa4()).toEqual([['configurateur_panier_atteint', COMMUNS]]);
  });

  it('traffic_type « internal » seulement sur /pages/test-…', () => {
    const chemins: [string, boolean][] = [
      ['/pages/test-configurateur', true],
      ['/pages/test-simulateur', true],
      ['/pages/configurateur', false],
      ['/pages/simulateur', false],
      ['/pages/testeur', false],
      ['/fr/pages/test-configurateur', false],
      ['/products/test-horizon', false],
    ];
    for (const [chemin, interne] of chemins) {
      const navigateur = installerFauxNavigateur({ url: `${BOUTIQUE}${chemin}`, attributsScript: { 'data-colibri': 'configurateur' } });
      chargerScript<ScriptColibri>().demarrer(navigateur.fenetre, CONFIG);
      depuisApp(navigateur, { type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} });
      const [[, parametres]] = navigateur.evenementsGa4();
      if (interne) expect(parametres.traffic_type).toBe('internal');
      else expect(parametres).not.toHaveProperty('traffic_type');
      vi.unstubAllGlobals();
    }
  });

  it('debug_mode : activé par colibri_debug=1, mémorisé pour la session, absent sinon ; écrit en console', () => {
    const sansDebug = page('configurateur');
    depuisApp(sansDebug.navigateur, { type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} });
    expect(sansDebug.navigateur.evenementsGa4()[0][1]).not.toHaveProperty('debug_mode');
    vi.unstubAllGlobals();
    const navigateur = installerFauxNavigateur({
      url: `${BOUTIQUE}/pages/configurateur?colibri_debug=1`,
      attributsScript: { 'data-colibri': 'configurateur' },
    });
    chargerScript<ScriptColibri>().demarrer(navigateur.fenetre, CONFIG);
    depuisApp(navigateur, { type: 'colibri:mesure', evenement: 'configurateur_sortie', parametres: { sortie: 'checkout' } });
    const attendu = { sortie: 'checkout', parcours_simulateur: 'non', debug_mode: true, send_to: ID_GA4 };
    expect(navigateur.evenementsGa4()).toEqual([['configurateur_sortie', attendu]]);
    expect(navigateur.info).toHaveBeenCalledWith('[Colibri] GA4', 'configurateur_sortie', attendu);
    vi.unstubAllGlobals();

    // Page suivante sans le paramètre : toujours en debug
    const suivante = installerFauxNavigateur({
      url: `${BOUTIQUE}/pages/configurateur`, session: navigateur.session, attributsScript: { 'data-colibri': 'configurateur' },
    });
    chargerScript<ScriptColibri>().demarrer(suivante.fenetre, CONFIG);
    depuisApp(suivante, { type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} });
    expect(suivante.evenementsGa4()[0][1].debug_mode).toBe(true);

    // Sans debug : paramètre absent (debug_mode: false activerait quand même le debug de GA4), rien en console
    expect(sansDebug.navigateur.info).not.toHaveBeenCalled();
    expect(colibriPur().lireDebug('?colibri_debug=0', true)).toBe(false);
    expect(colibriPur().parametresCommuns({ simulateurOuvert: false, chemin: '/pages/configurateur', debug: false }))
      .toEqual({ parcours_simulateur: 'non' });
  });
});

describe('mesure GA4 — aucun envoi sans gtag ou sans ID GA4', () => {
  it('sans gtag sur la page : rien, sans erreur (rien n’est chargé à sa place)', async () => {
    const { navigateur } = page('configurateur', { avecGtag: false });
    depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    depuisApp(navigateur, { type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} });
    await attendre();
    expect(navigateur.fenetre).not.toHaveProperty('gtag');
    expect(navigateur.fenetre).not.toHaveProperty('dataLayer');
    expect(navigateur.trouver((e) => e.tagName === 'script' && e.getAttribute('src') !== null)).toBeUndefined();
  });

  it('sans ID GA4 (ou ID invalide) : gtag jamais appelé', async () => {
    for (const idGa4 of ['', '   ', 'UA-12345-1', 'G-', 'GTM-W4PD6GFS', 'AW-802471731', undefined]) {
      const { navigateur } = page('configurateur', {}, { ...CONFIG, idGa4 });
      depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
      depuisApp(navigateur, { type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} });
      await attendre();
      navigateur.kit.emettre('PRODUCT_APPLY', chargeApplication('horizon'));
      await attendre();
      expect(navigateur.gtag).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it('jamais gtag(«consent») ni gtag(«config») : seulement des « event »', async () => {
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, { type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    await attendre();
    bouton(navigateur, 'retour').cliquer();
    expect(navigateur.gtag.mock.calls.map((appel) => appel[0])).toEqual(['event', 'event']);
    const source = readFileSync(new URL('./colibri.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/gtag\(\s*'(consent|config|set|js)'/);
    // Aucun usage du dataLayer ni chargement de gtag.js (les commentaires peuvent les nommer)
    expect(source).not.toMatch(/dataLayer\s*(\.|=|\[)/);
    expect(source).not.toContain('googletagmanager.com');
  });

  it('ID du labo (data-ga4-labo) : seulement en mode labo, à défaut de NEXT_PUBLIC_GA4_ID', () => {
    const s = colibriPur();
    expect(s.idGa4Page({ ...CONFIG, idGa4: '', labo: true }, 'G-LABO1234')).toBe('G-LABO1234');
    expect(s.idGa4Page({ ...CONFIG, idGa4: ID_GA4, labo: true }, 'G-LABO1234')).toBe(ID_GA4);
    expect(s.idGa4Page({ ...CONFIG, idGa4: '', labo: false }, 'G-LABO1234')).toBe('');
    expect(s.idGa4Page({ ...CONFIG, idGa4: '' }, 'G-LABO1234')).toBe('');
    expect(s.idGa4Page({ ...CONFIG, idGa4: '', labo: true }, 'pas-un-id')).toBe('');
    expect(s.lireIdGa4(` ${ID_GA4} `)).toBe(ID_GA4);
  });
});

describe('mesure GA4 — colibri:mesure (app → page)', () => {
  it('relaie un événement valide avec les paramètres communs', () => {
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, { type: 'colibri:mesure', evenement: 'configurateur_sortie', parametres: { sortie: 'permalink' } });
    expect(navigateur.evenementsGa4()).toEqual([
      ['configurateur_sortie', { sortie: 'permalink', parcours_simulateur: 'non', send_to: ID_GA4 }],
    ]);
  });

  it('mauvaise origine ou autre fenêtre que l’iframe : ignoré', () => {
    const { navigateur } = page('configurateur');
    const data = { type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} };
    navigateur.recevoir({ origin: 'https://evil.example', source: iframeApp(navigateur), data });
    navigateur.recevoir({ origin: BOUTIQUE, source: iframeApp(navigateur), data });
    navigateur.recevoir({ origin: APP, source: {}, data });
    navigateur.recevoir({ origin: APP, source: null, data });
    expect(navigateur.gtag).not.toHaveBeenCalled();
  });

  it('nom hors liste blanche : ignoré', () => {
    const { navigateur } = page('configurateur');
    for (const evenement of ['purchase', 'simulateur_ouvert', 'page_view', 'toString', '__proto__', 'constructor', '', 42, null]) {
      depuisApp(navigateur, { type: 'colibri:mesure', evenement, parametres: {} });
    }
    depuisApp(navigateur, { type: 'colibri:mesure', parametres: {} });
    expect(navigateur.gtag).not.toHaveBeenCalled();
  });

  it('clé hors liste blanche ou mauvais type : paramètre ignoré, sans erreur', () => {
    const s = colibriPur();
    const lire = (evenement: string, parametres: unknown) => s.lireMesure({ type: 'colibri:mesure', evenement, parametres });
    expect(lire('configurateur_sortie', { sortie: 'checkout', email: 'client@example.com', nom: 'Dupont' }))
      .toEqual({ type: 'colibri:mesure', evenement: 'configurateur_sortie', parametres: { sortie: 'checkout' } });
    // Les paramètres communs et la destination ne viennent jamais de l'app
    expect(lire('configurateur_panier_atteint', { parcours_simulateur: 'oui', traffic_type: 'internal', debug_mode: true, send_to: 'G-AUTRE1234' }))
      .toEqual({ type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} });
    // Clé d'un autre événement
    expect(lire('configurateur_sortie', { nombre_murs: 3 })?.parametres).toEqual({});
    expect(lire('configurateur_surfaces_saisies', { nombre_murs: '3' })?.parametres).toEqual({});
    for (const valeur of [Number.NaN, Number.POSITIVE_INFINITY, '4', null, true, [4], { n: 4 }]) {
      expect(lire('configurateur_selection_simulateur', { nb_teintes: valeur })?.parametres).toEqual({});
    }
    expect(lire('configurateur_demarre', { arrivee: 'x'.repeat(101) })?.parametres).toEqual({});
    expect(lire('configurateur_demarre', { arrivee: 'x'.repeat(100) })?.parametres).toEqual({ arrivee: 'x'.repeat(100) });
    for (const valeur of [42, true, ['directe'], { v: 'directe' }]) {
      expect(lire('configurateur_demarre', { arrivee: valeur })?.parametres).toEqual({});
    }
    for (const parametres of [undefined, null, 'sortie=checkout', ['checkout']]) {
      expect(lire('configurateur_sortie', parametres)?.parametres).toEqual({});
    }
    // Clé héritée du prototype : jamais lue
    expect(lire('configurateur_sortie', Object.create({ sortie: 'checkout' }))?.parametres).toEqual({});

    // De bout en bout : seul le paramètre valide part
    const { navigateur } = page('configurateur');
    depuisApp(navigateur, {
      type: 'colibri:mesure', evenement: 'configurateur_options_validees',
      parametres: { kit: 'oui', renovation: false, adresse: '1 rue de la Paix' },
    });
    expect(navigateur.evenementsGa4()).toEqual([
      ['configurateur_options_validees', { kit: 'oui', parcours_simulateur: 'non', send_to: ID_GA4 }],
    ]);
  });

  it('message lu comme les autres messages de l’app (contrat lib/embed-messages.ts)', () => {
    expect(colibriPur().lireMessageApp({ type: 'colibri:mesure', evenement: 'configurateur_piece_validee', parametres: { type_piece: 'chambre' } }))
      .toEqual({ type: 'colibri:mesure', evenement: 'configurateur_piece_validee', parametres: { type_piece: 'chambre' } });
    expect(colibriPur().lireMessageApp({ type: 'colibri:mesure', evenement: 'inconnu' })).toBeNull();
  });
});

describe('mesure GA4 — liste blanche partagée avec l’app', () => {
  it('embed/colibri.js porte exactement SCHEMA_MESURES de lib/embed-messages.ts', () => {
    expect(colibriPur().MESURES_CALCULATEUR).toEqual(SCHEMA_MESURES);
  });

  it('tout message que l’app peut construire passe la liste blanche à l’identique', () => {
    const exemples: { [E in EvenementMesure]: ParametresMesure[E][] } = {
      configurateur_demarre: [{ arrivee: 'directe' }, { arrivee: 'simulateur' }],
      configurateur_selection_simulateur: [{ nb_teintes: 1 }, { nb_teintes: 12 }],
      configurateur_piece_validee: [{ type_piece: 'piece-de-vie' }, { type_piece: 'salle-de-bain' }],
      configurateur_surfaces_saisies: [{ nombre_murs: 4 }],
      configurateur_options_validees: [{ kit: 'oui', renovation: 'non' }],
      configurateur_panier_atteint: [{}],
      configurateur_sortie: [{ sortie: 'checkout' }, { sortie: 'permalink' }, { sortie: 'estimation' }],
    };
    for (const [evenement, liste] of Object.entries(exemples)) {
      for (const parametres of liste) {
        expect(colibriPur().lireMesure({ type: 'colibri:mesure', evenement, parametres }))
          .toEqual({ type: 'colibri:mesure', evenement, parametres });
      }
    }
  });
});

describe('mesure GA4 — logique pure', () => {
  it('écoute CUSTOM_INTERIOR_UPLOAD et PREDEFINED_INTERIOR_SELECT (clés du DepKit v1.1.3), sans toucher aux écoutes existantes', async () => {
    const { VISUALIZER_EVENTS_V113 } = await import('./test/fauxNavigateur');
    expect(colibriPur().evenementsMesures(VISUALIZER_EVENTS_V113))
      .toEqual({ photo: ['photo_uploaded'], exemple: ['predefined_interior_selected'] });
    expect(colibriPur().evenementsMesures(undefined)).toEqual({ photo: [], exemple: [] });
    expect(colibriPur().evenementsEcoutes(VISUALIZER_EVENTS_V113))
      .toEqual({ application: ['apply'], retour: ['back_button_clicked'] });
  });

  it('type_produit : peinture ou papier_peint d’après la réponse de l’app, sinon absent', () => {
    const s = colibriPur();
    expect(s.typeProduit({ type: 'peinture', hex: '#fff' })).toBe('peinture');
    expect(s.typeProduit({ type: 'papier-peint' })).toBe('papier_peint');
    expect(s.typeProduit(null)).toBeNull();
    expect(s.typeProduit({ type: 'autre' })).toBeNull();
  });

  it('origine depuis la page Simulateur : fiche_produit avec ?teinte=, sinon page_simulateur', () => {
    expect(colibriPur().origineSimulateur('horizon')).toBe('fiche_produit');
    expect(colibriPur().origineSimulateur(null)).toBe('page_simulateur');
  });

  it('avantDelai : valeur par défaut si la Promise tarde ou rejette', async () => {
    const s = colibriPur();
    expect(await s.avantDelai(Promise.resolve('a'), 50, 'défaut')).toBe('a');
    expect(await s.avantDelai(Promise.reject(new Error('x')), 50, 'défaut')).toBe('défaut');
    expect(await s.avantDelai(new Promise<string>(() => {}), 5, 'défaut')).toBe('défaut');
  });

  it('gtag de la page en erreur : la mesure continue, sans exception', async () => {
    const session = new Map<string, string>();
    const gtag = vi.fn().mockImplementationOnce(() => { throw new Error('gtag cassé'); });
    const mesure = colibriPur().creerMesure({
      idGa4: ID_GA4,
      fenetre: { gtag, location: { pathname: '/pages/configurateur', search: '' } },
      session: { lire: (c) => session.get(c) ?? null, ecrire: (c, v) => { if (v === null) session.delete(c); else session.set(c, v); } },
    });
    expect(() => mesure.envoyer('a', {})).not.toThrow();
    mesure.envoyer('b', Promise.resolve({ x: 1 }));
    mesure.envoyer('c', {});
    await attendre();
    expect(gtag.mock.calls.map((appel) => appel[1])).toEqual(['a', 'b', 'c']);
  });
});

describe('route /embed/colibri.js — ID GA4 injecté', () => {
  it('NEXT_PUBLIC_GA4_ID lu, nettoyé, transmis au script ; vide : clé absente (aucun événement)', async () => {
    const { GET } = await import('@/app/embed/colibri.js/route');
    const config = async () => {
      const script = await GET(new Request(`${APP}/embed/colibri.js`)).text();
      const appel = script.match(/colibri\.demarrer\(racine, (\{.*?\})\);/);
      if (!appel) throw new Error('configuration introuvable dans le script servi');
      return JSON.parse(appel[1]) as Config;
    };
    vi.stubEnv('NEXT_PUBLIC_GA4_ID', ` ${ID_GA4} `);
    expect((await config()).idGa4).toBe(ID_GA4);
    for (const vide of ['', '   ']) {
      vi.stubEnv('NEXT_PUBLIC_GA4_ID', vide);
      const sansId = await config();
      expect(sansId).not.toHaveProperty('idGa4');
      expect(colibriPur().idGa4Page(sansId, null)).toBe('');
    }
  });
});

// Logique pure du script, sans navigateur
let pur: ScriptColibri | null = null;
function colibriPur(): ScriptColibri {
  pur ??= chargerScript<ScriptColibri>();
  return pur;
}
