import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { IMAGES_PIECES, LIBELLES_PIECES } from '@/lib/pieces';

// Le script hébergé est un fichier navigateur sans dépendance : chargé comme
// module CommonJS, il n'exporte que sa logique pure (aucun effet de bord).
interface Entree {
  piece: string;
  teintes: string[];
}

interface Config {
  tokenWizart: string;
  labo?: boolean;
}

interface TeinteRetenue {
  handle: string;
  nom: string;
}

interface Reglages {
  token: string;
  layoutSettings: { targetElement: unknown; layout: unknown };
  integrationSettings: Record<string, unknown>;
  sceneData?: { openWithProduct?: string; openInRoom?: string };
}

interface ReponseFetch {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

interface ReferenceConnue {
  type: 'peinture' | 'papier-peint';
  hex: string | null;
  image: string | null;
  nom: string | null;
}

interface CouleursTeintes {
  hex(handle: string): string | null;
  reference(handle: string): ReferenceConnue | null;
  chargerCouleurs(origineApp: string, handles: string[], rappel: () => void): Promise<void> | null;
}

interface LogiqueColibri {
  PIECES: [string, string, string][];
  CAPACITE_SIMULATEUR: string;
  SCRIPT_DEPKIT: string;
  MAX_TEINTES: number;
  estHandle(valeur: unknown): boolean;
  normaliserTeintes(valeurs: unknown): string[];
  lireEntreeConfigurateur(recherche: string, pieceSession: string | null): Entree | null;
  cheminIframe(entree: Entree | null): string;
  rechercheSansEntree(recherche: string): string;
  urlConfigurateur(origine: string, piece: string, teintes: string[], chemin?: string): string;
  cheminConfigurateur(valeur: unknown, avertir?: (...args: unknown[]) => void): string;
  urlSimulateurTeinte(handle: string): string;
  lireTeinteDemandee(recherche: string): string | null;
  lireVariantes(valeur: unknown, avertir?: (...args: unknown[]) => void): Record<string, string>;
  referenceBouton(parDefaut: string, variantes: Record<string, string>, recherche: string): string;
  lireMessageApp(donnees: unknown): Record<string, unknown> | null;
  simulateurDisponible(config: Config, kitDejaPresent: boolean): boolean;
  capacites(config: Config, kitDejaPresent: boolean): string[];
  lireVisuel(valeur: unknown): string | null;
  nomCourt(nom: unknown): string;
  lireApplication(donnees: unknown): TeinteRetenue[];
  retenirTeinte(liste: TeinteRetenue[], teinte: TeinteRetenue): TeinteRetenue[];
  libelleUtiliser(nombre: number): string;
  annonceTeintes(nombre: number): string;
  lireHex(valeur: unknown): string | null;
  lireImage(valeur: unknown): string | null;
  lireReference(t: Record<string, unknown>): ReferenceConnue;
  urlTeintes(origineApp: string, handles: string[]): string;
  creerCouleursTeintes(requete: (url: string) => Promise<ReponseFetch>): CouleursTeintes;
  evenementsEcoutes(evenements: Record<string, string> | undefined): { application: string[]; retour: string[] };
  INTERIEURS_WIZART: Record<string, string | null>;
  interieurWizart(piece: unknown): string | null;
  reglagesVisualiseur(
    kit: { LAYOUTS?: Record<string, string> },
    token: string,
    cible: unknown,
    teinte?: string | null,
    piece?: unknown,
    essai?: string,
  ): Reglages;
  ESSAI_PHOTO: string;
  ESSAI_EXEMPLE: string;
  RETOUR_BOUTIQUE: string;
  RETOUR_CALCULATEUR: string;
  LOGO_COLIBRI: string;
  libelleRetour(destination: unknown): string;
}

const colibri = createRequire(import.meta.url)('./colibri.js') as LogiqueColibri;

describe('script hébergé — pièces', () => {
  it('reprend exactement les types, libellés et images de pièce de l’app', () => {
    expect(Object.fromEntries(colibri.PIECES.map(([type, libelle]) => [type, libelle]))).toEqual(LIBELLES_PIECES);
    expect(Object.fromEntries(colibri.PIECES.map(([type, , image]) => [type, image]))).toEqual(IMAGES_PIECES);
    expect(colibri.PIECES.map(([type]) => type)).toEqual(Object.keys(LIBELLES_PIECES));
  });
});

describe('script hébergé — lecture des paramètres d’entrée', () => {
  it('lit piece + teintes (ordre conservé, doublons et handles invalides écartés)', () => {
    expect(colibri.lireEntreeConfigurateur('?piece=chambre&teintes=bleu-ciel,vert-sauge,bleu-ciel,<script>,', null))
      .toEqual({ piece: 'chambre', teintes: ['bleu-ciel', 'vert-sauge'] });
  });

  it('normalise la casse et les espaces des handles', () => {
    expect(colibri.lireEntreeConfigurateur('?piece=cuisine&teintes=%20Bleu-Ciel%20', null))
      .toEqual({ piece: 'cuisine', teintes: ['bleu-ciel'] });
  });

  it('ignore une pièce inconnue ou des teintes vides', () => {
    expect(colibri.lireEntreeConfigurateur('?piece=garage&teintes=bleu-ciel', null)).toBeNull();
    expect(colibri.lireEntreeConfigurateur('?piece=chambre&teintes=', null)).toBeNull();
    expect(colibri.lireEntreeConfigurateur('?piece=chambre', null)).toBeNull();
    expect(colibri.lireEntreeConfigurateur('', null)).toBeNull();
  });

  it('lit vendorCode[] (redirection du PIM) avec la pièce mémorisée', () => {
    const recherche = '?vendorCode%5B%5D=bleu-ciel&vendorCode%5B%5D=vert-sauge';
    expect(colibri.lireEntreeConfigurateur(recherche, 'salle-de-bain'))
      .toEqual({ piece: 'salle-de-bain', teintes: ['bleu-ciel', 'vert-sauge'] });
    expect(colibri.lireEntreeConfigurateur('?vendorCode[]=bleu-ciel', 'entree'))
      .toEqual({ piece: 'entree', teintes: ['bleu-ciel'] });
  });

  it('ignore vendorCode[] sans pièce mémorisée valide', () => {
    expect(colibri.lireEntreeConfigurateur('?vendorCode[]=bleu-ciel', null)).toBeNull();
    expect(colibri.lireEntreeConfigurateur('?vendorCode[]=bleu-ciel', 'garage')).toBeNull();
  });

  it('construit le chemin de l’iframe', () => {
    expect(colibri.cheminIframe(null)).toBe('/');
    expect(colibri.cheminIframe({ piece: 'chambre', teintes: ['bleu-ciel', 'vert-sauge'] }))
      .toBe('/calculateur/simulateur?piece=chambre&teintes=bleu-ciel,vert-sauge');
  });

  it('retire les paramètres d’entrée de l’URL en gardant les autres', () => {
    expect(colibri.rechercheSansEntree('?piece=chambre&teintes=a&utm_source=mail')).toBe('?utm_source=mail');
    expect(colibri.rechercheSansEntree('?vendorCode[]=a&vendorCode[]=b')).toBe('');
  });

  it('construit les URL de la page Simulateur et du retour configurateur', () => {
    expect(colibri.urlConfigurateur('https://www.colibripeinture.com', 'cuisine', ['bleu-ciel', 'vert-sauge']))
      .toBe('https://www.colibripeinture.com/pages/configurateur?piece=cuisine&teintes=bleu-ciel,vert-sauge');
    expect(colibri.urlSimulateurTeinte('bleu-ciel')).toBe('/pages/simulateur?teinte=bleu-ciel');
  });

  it('lit la teinte demandée sur la page Simulateur', () => {
    expect(colibri.lireTeinteDemandee('?teinte=bleu-ciel')).toBe('bleu-ciel');
    expect(colibri.lireTeinteDemandee('?teinte=../../x')).toBeNull();
    expect(colibri.lireTeinteDemandee('')).toBeNull();
  });
});

describe('script hébergé — validation des messages de l’app', () => {
  it('accepte le contrat historique à l’identique', () => {
    expect(colibri.lireMessageApp({ type: 'colibri:resize', height: 1200 }))
      .toEqual({ type: 'colibri:resize', height: 1200 });
    expect(colibri.lireMessageApp({ type: 'colibri:scrollTop' })).toEqual({ type: 'colibri:scrollTop' });
    expect(colibri.lireMessageApp({ type: 'colibri:redirect', url: 'https://www.colibripeinture.com/cart' }))
      .toEqual({ type: 'colibri:redirect', url: 'https://www.colibripeinture.com/cart' });
  });

  it('rejette les messages mal formés ou inconnus', () => {
    expect(colibri.lireMessageApp(null)).toBeNull();
    expect(colibri.lireMessageApp('colibri:resize')).toBeNull();
    expect(colibri.lireMessageApp({ type: 'colibri:resize', height: '1200' })).toBeNull();
    expect(colibri.lireMessageApp({ type: 'colibri:resize', height: Number.NaN })).toBeNull();
    expect(colibri.lireMessageApp({ type: 'colibri:redirect' })).toBeNull();
    expect(colibri.lireMessageApp({ type: 'autre' })).toBeNull();
  });

  it('valide colibri:simulateur:ouvrir (pièce connue, teinte facultative)', () => {
    expect(colibri.lireMessageApp({ type: 'colibri:simulateur:ouvrir', piece: 'chambre' }))
      .toEqual({ type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    expect(colibri.lireMessageApp({ type: 'colibri:simulateur:ouvrir', piece: 'chambre', teinte: 'bleu-ciel' }))
      .toEqual({ type: 'colibri:simulateur:ouvrir', piece: 'chambre', teinte: 'bleu-ciel' });
    expect(colibri.lireMessageApp({ type: 'colibri:simulateur:ouvrir', piece: 'chambre', teinte: 'Pas un handle' }))
      .toEqual({ type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    expect(colibri.lireMessageApp({ type: 'colibri:simulateur:ouvrir', piece: 'garage' })).toBeNull();
  });
});

describe('script hébergé — capacités', () => {
  it('hors labo, le simulateur ne dépend que du token (kit déjà présent ignoré)', () => {
    expect(colibri.capacites({ tokenWizart: '', labo: false }, false)).toEqual([]);
    expect(colibri.capacites({ tokenWizart: '', labo: false }, true)).toEqual([]);
    expect(colibri.capacites({ tokenWizart: '' }, true)).toEqual([]);
    expect(colibri.capacites({ tokenWizart: 'jeton', labo: false }, false)).toEqual([colibri.CAPACITE_SIMULATEUR]);
    expect(colibri.capacites({ tokenWizart: 'jeton', labo: false }, true)).toEqual([colibri.CAPACITE_SIMULATEUR]);
  });

  it('en labo, un kit déjà présent tient lieu de token', () => {
    expect(colibri.simulateurDisponible({ tokenWizart: '', labo: true }, true)).toBe(true);
    expect(colibri.simulateurDisponible({ tokenWizart: '', labo: true }, false)).toBe(false);
    expect(colibri.simulateurDisponible({ tokenWizart: 'jeton', labo: true }, false)).toBe(true);
    expect(colibri.capacites({ tokenWizart: '', labo: true }, true)).toEqual([colibri.CAPACITE_SIMULATEUR]);
  });
});

describe('script hébergé — lecture de PRODUCT_APPLY', () => {
  it('lit la charge réelle (DepKit v1.1.3, 16/10/2026) : handle = article_sku, nom court', () => {
    const charge: unknown = JSON.parse(
      readFileSync(new URL('./fixtures/wizart-product-apply.json', import.meta.url), 'utf8'),
    );
    expect(colibri.lireApplication(charge)).toEqual([
      { handle: 'deguesde-peinture-biosourcee-murs-et-plafonds', nom: 'Deguesde' },
    ]);
  });

  it('se rabat sur article_custom_sku sans article_sku valide', () => {
    expect(colibri.lireApplication({
      products: [{ x_y: { article_sku: '', article_custom_sku: 'Vert-Sauge', article_name: 'Vert Sauge - Peinture' } }],
    })).toEqual([{ handle: 'vert-sauge', nom: 'Vert Sauge' }]);
  });

  it('prend le handle comme nom à défaut d’article_name', () => {
    expect(colibri.lireApplication({ products: [{ a: { article_sku: 'bleu-ciel' } }] }))
      .toEqual([{ handle: 'bleu-ciel', nom: 'bleu-ciel' }]);
  });

  it('ne dépend d’aucun autre champ et ignore les charges illisibles', () => {
    expect(colibri.lireApplication({ products: [{ a: { article_sku: 'bleu-ciel' } }], room_id: undefined }))
      .toHaveLength(1);
    expect(colibri.lireApplication(undefined)).toEqual([]);
    expect(colibri.lireApplication({ products: [] })).toEqual([]);
    expect(colibri.lireApplication({ products: [null, 'x', { a: null }, { b: { article_sku: '<script>' } }] })).toEqual([]);
    expect(colibri.lireApplication({ product_identifiers: ['702ffae8'] })).toEqual([]);
  });

  it('nom court : partie de article_name avant « - »', () => {
    expect(colibri.nomCourt('Deguesde - Peinture biosourcée murs et plafonds')).toBe('Deguesde');
    expect(colibri.nomCourt('Bleu-Nuit - Peinture')).toBe('Bleu-Nuit');
    expect(colibri.nomCourt('Horizon')).toBe('Horizon');
    expect(colibri.nomCourt(null)).toBe('');
  });
});

describe('script hébergé — teintes retenues', () => {
  const a = { handle: 'a', nom: 'A' };
  const b = { handle: 'b', nom: 'B' };
  const c = { handle: 'c', nom: 'C' };

  it('retient dans l’ordre d’application, la dernière est la plus récente', () => {
    let liste: TeinteRetenue[] = [];
    [a, b, c].forEach((t) => { liste = colibri.retenirTeinte(liste, t); });
    expect(liste.map((t) => t.handle)).toEqual(['a', 'b', 'c']);
  });

  it('une teinte réappliquée passe en dernière position, sans doublon', () => {
    let liste: TeinteRetenue[] = [];
    [a, b, c, a].forEach((t) => { liste = colibri.retenirTeinte(liste, t); });
    expect(liste.map((t) => t.handle)).toEqual(['b', 'c', 'a']);
    liste = colibri.retenirTeinte(liste, a);
    expect(liste.map((t) => t.handle)).toEqual(['b', 'c', 'a']);
  });

  it('ne modifie pas la liste reçue et oublie les plus anciennes au-delà du maximum', () => {
    const initiale = [a];
    colibri.retenirTeinte(initiale, b);
    expect(initiale).toEqual([a]);
    let liste: TeinteRetenue[] = [];
    for (let i = 0; i <= colibri.MAX_TEINTES; i++) liste = colibri.retenirTeinte(liste, { handle: `t${i}`, nom: '' });
    expect(liste).toHaveLength(colibri.MAX_TEINTES);
    expect(liste[0].handle).toBe('t1');
    expect(liste[liste.length - 1].handle).toBe(`t${colibri.MAX_TEINTES}`);
  });
});

describe('script hébergé — barre Colibri', () => {
  it('libellé du bouton principal selon le nombre de choix (teintes et papiers peints)', () => {
    expect(colibri.libelleUtiliser(0)).toBe('Utiliser mon choix →');
    expect(colibri.libelleUtiliser(1)).toBe('Utiliser mon choix →');
    expect(colibri.libelleUtiliser(2)).toBe('Utiliser mes choix (2) →');
    expect(colibri.libelleUtiliser(7)).toBe('Utiliser mes choix (7) →');
  });

  it('libellés de la barre : « Vos essais », barre vide, plus de « Teintes essayées »', () => {
    const source = readFileSync(new URL('./colibri.js', import.meta.url), 'utf8');
    expect(source).toContain("'aria-label': 'Vos essais'");
    expect(source).toContain("class: 'libelle', texte: 'Vos essais'");
    expect(source).toContain('Appliquez une teinte ou un papier peint sur un mur pour le retenir');
    expect(source).not.toContain('Teintes essayées');
  });

  it('annonce le nombre d’essais retenus', () => {
    expect(colibri.annonceTeintes(0)).toBe('Aucun essai retenu');
    expect(colibri.annonceTeintes(1)).toBe('1 essai retenu');
    expect(colibri.annonceTeintes(3)).toBe('3 essais retenus');
  });

  it('n’accepte qu’un code hexadécimal comme couleur de pastille', () => {
    expect(colibri.lireHex('#a1b2c3')).toBe('#a1b2c3');
    expect(colibri.lireHex('#fff')).toBe('#fff');
    expect(colibri.lireHex('red')).toBeNull();
    expect(colibri.lireHex('#fff;background:url(x)')).toBeNull();
    expect(colibri.lireHex(null)).toBeNull();
  });

  describe('couleurs des pastilles', () => {
    const APP = 'https://calculateur.colibripeinture.com';
    const reponse = (status: number, corps: unknown): ReponseFetch => ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(corps),
    });

    it('mémorise une réponse obtenue (teinte absente du catalogue comprise)', async () => {
      const requete = vi.fn((_url: string) => Promise.resolve(reponse(200, [{ handle: 'horizon', nom: 'Horizon', hex: '#8fa9b8' }])));
      const rappel = vi.fn();
      const couleurs = colibri.creerCouleursTeintes(requete);
      await couleurs.chargerCouleurs(APP, ['horizon', 'inconnue'], rappel);
      expect(requete).toHaveBeenCalledWith(`${APP}/api/embed/teintes?handles=horizon,inconnue`);
      expect(couleurs.hex('horizon')).toBe('#8fa9b8');
      expect(couleurs.hex('inconnue')).toBeNull();
      expect(rappel).toHaveBeenCalledTimes(1);
      expect(couleurs.chargerCouleurs(APP, ['horizon', 'inconnue'], rappel)).toBeNull();
      expect(requete).toHaveBeenCalledTimes(1);
    });

    it('ne mémorise pas un échec : 502, réseau ou réponse illisible → redemandé au rendu suivant', async () => {
      const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const requete = vi.fn<(url: string) => Promise<ReponseFetch>>()
        .mockResolvedValueOnce(reponse(502, []))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(reponse(200, { erreur: 'x' }))
        .mockResolvedValueOnce(reponse(200, [{ handle: 'horizon', hex: '#8fa9b8' }]));
      const rappel = vi.fn();
      const couleurs = colibri.creerCouleursTeintes(requete);
      for (let essai = 0; essai < 3; essai++) {
        await couleurs.chargerCouleurs(APP, ['horizon'], rappel);
        expect(couleurs.hex('horizon')).toBeNull();
      }
      expect(rappel).not.toHaveBeenCalled();
      await couleurs.chargerCouleurs(APP, ['horizon'], rappel);
      expect(requete).toHaveBeenCalledTimes(4);
      expect(couleurs.hex('horizon')).toBe('#8fa9b8');
      expect(rappel).toHaveBeenCalledTimes(1);
      avertissement.mockRestore();
    });

    it('ne redemande pas un handle dont la requête est en cours', async () => {
      let terminer: (r: ReponseFetch) => void = () => {};
      const requete = vi.fn((_url: string) => new Promise<ReponseFetch>((resolve) => { terminer = resolve; }));
      const couleurs = colibri.creerCouleursTeintes(requete);
      const premiere = couleurs.chargerCouleurs(APP, ['horizon'], () => {});
      await Promise.resolve();
      expect(couleurs.chargerCouleurs(APP, ['horizon'], () => {})).toBeNull();
      terminer(reponse(200, []));
      await premiere;
      expect(requete).toHaveBeenCalledTimes(1);
    });
  });

  it('construit l’URL de l’endpoint des couleurs', () => {
    expect(colibri.urlTeintes('https://calculateur.colibripeinture.com', ['bleu-ciel', 'vert-sauge']))
      .toBe('https://calculateur.colibripeinture.com/api/embed/teintes?handles=bleu-ciel,vert-sauge');
  });
});

describe('script hébergé — page Simulateur', () => {
  it('lit le visuel de l’en-tête (http(s) seulement)', () => {
    expect(colibri.lireVisuel('https://cdn.shopify.com/x.jpg')).toBe('https://cdn.shopify.com/x.jpg');
    expect(colibri.lireVisuel(' https://cdn.shopify.com/x.jpg ')).toBe('https://cdn.shopify.com/x.jpg');
    expect(colibri.lireVisuel('javascript:alert(1)')).toBeNull();
    expect(colibri.lireVisuel('/relatif.jpg')).toBeNull();
    expect(colibri.lireVisuel('')).toBeNull();
    expect(colibri.lireVisuel(null)).toBeNull();
  });
});

describe('script hébergé — DepKit', () => {
  const EVENEMENTS = {
    PRODUCT_APPLY: 'product_apply',
    BACK_BUTTON_CLICK: 'back_button_click',
    OPEN_IN_STORE: 'open_in_store',
    CHECKOUT_OPTIONS_OPEN: 'checkout_options_open',
  };

  it('écoute PRODUCT_APPLY et BACK_BUTTON_CLICK, plus le panier (OPEN_IN_STORE)', () => {
    expect(colibri.evenementsEcoutes(EVENEMENTS)).toEqual({
      application: ['product_apply'],
      retour: ['back_button_click'],
    });
    expect(colibri.evenementsEcoutes(undefined)).toEqual({ application: [], retour: [] });
  });

  it('réglages : FILL_PARENT, français, bouton retour de Wizart affiché, teinte d’ouverture', () => {
    const cible = {};
    const kit = { LAYOUTS: { FULL_SCREEN: 'full_screen', FILL_PARENT: 'fill_parent', CUSTOM_SIZE: 'custom_size' } };
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, 'bleu-ciel')).toEqual({
      token: 'jeton',
      layoutSettings: { targetElement: cible, layout: 'fill_parent' },
      integrationSettings: { locale: 'fr', showBackToWebsiteButton: true },
      sceneData: { openWithProduct: 'bleu-ciel' },
    });
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null).sceneData).toBeUndefined();
  });

  it('charge une seule version du DepKit, la v1.1.3, sans repli', () => {
    expect(colibri.SCRIPT_DEPKIT).toBe('https://d18jpdcj6p6zg6.cloudfront.net/wizart-deployment-kit-v1.1.3.min.js');
    const source = readFileSync(new URL('./colibri.js', import.meta.url), 'utf8');
    expect(source.match(/wizart-deployment-kit-v[\d.]+\.min\.js/g)).toEqual(['wizart-deployment-kit-v1.1.3.min.js']);
  });
});

describe('script hébergé — intérieur Wizart du type de pièce', () => {
  const cible = {};
  const kit = { LAYOUTS: { FILL_PARENT: 'fill_parent' } };
  const CHAMBRE = '1103ea18-8a07-4f59-a1d3-86d08b406755';

  it('chaque type de PIECES a une entrée dans la table, aucune en trop', () => {
    expect(Object.keys(colibri.INTERIEURS_WIZART).sort()).toEqual(colibri.PIECES.map(([type]) => type).sort());
  });

  it('correspondance relevée le 16/10/2026', () => {
    expect(colibri.INTERIEURS_WIZART).toEqual({
      'piece-de-vie': '0ccc39c1-6379-4070-934d-f7459ce15247',
      'chambre': CHAMBRE,
      'cuisine': 'fe9bfc03-6fe5-403d-a6a1-5feb5c71c10c',
      'salle-de-bain': '00bb8d0e-5dcc-4893-93bc-d4b1b79ae60f',
      'toilettes': '00bb8d0e-5dcc-4893-93bc-d4b1b79ae60f',
      'entree': null,
      'couloir': null,
    });
  });

  it('pièce avec intérieur : sceneData.openInRoom vaut l’UUID attendu', () => {
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null, 'chambre').sceneData).toEqual({ openInRoom: CHAMBRE });
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null, 'toilettes').sceneData)
      .toEqual({ openInRoom: '00bb8d0e-5dcc-4893-93bc-d4b1b79ae60f' });
  });

  it('pièce avec intérieur et teinte : openInRoom et openWithProduct', () => {
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, 'bleu-ciel', 'chambre').sceneData)
      .toEqual({ openInRoom: CHAMBRE, openWithProduct: 'bleu-ciel' });
  });

  it('entrée et couloir : pas d’openInRoom (galerie), la teinte reste transmise', () => {
    for (const piece of ['entree', 'couloir']) {
      expect(colibri.interieurWizart(piece)).toBeNull();
      expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null, piece).sceneData).toBeUndefined();
      expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, 'bleu-ciel', piece).sceneData)
        .toEqual({ openWithProduct: 'bleu-ciel' });
    }
  });

  it('type inconnu ou absent : pas d’openInRoom', () => {
    for (const piece of ['garage', 'toString', '__proto__', '', null, undefined, 42]) {
      expect(colibri.interieurWizart(piece)).toBeNull();
      expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null, piece).sceneData).toBeUndefined();
    }
  });
});

describe('script hébergé — data-configurateur (pages de test)', () => {
  it('absent : chemin par défaut, sans avertissement', () => {
    const avertir = vi.fn();
    expect(colibri.cheminConfigurateur(null, avertir)).toBe('/pages/configurateur');
    expect(colibri.cheminConfigurateur(undefined, avertir)).toBe('/pages/configurateur');
    expect(avertir).not.toHaveBeenCalled();
  });

  it('valide : chemin utilisé pour la sortie', () => {
    const avertir = vi.fn();
    const chemin = colibri.cheminConfigurateur('/pages/test-configurateur', avertir);
    expect(chemin).toBe('/pages/test-configurateur');
    expect(avertir).not.toHaveBeenCalled();
    expect(colibri.urlConfigurateur('https://www.colibripeinture.com', 'chambre', ['bleu-ciel', 'vert-sauge'], chemin))
      .toBe('https://www.colibripeinture.com/pages/test-configurateur?piece=chambre&teintes=bleu-ciel,vert-sauge');
  });

  it('invalide (URL absolue, chemin relatif, vide…) : ignoré avec avertissement', () => {
    for (const valeur of [
      'https://evil.example/pages/configurateur',
      '//evil.example/pages',
      'pages/test-configurateur',
      '',
      ' /pages/test',
      '/pages/test?x=1',
      'javascript:alert(1)',
    ]) {
      const avertir = vi.fn();
      expect(colibri.cheminConfigurateur(valeur, avertir)).toBe('/pages/configurateur');
      expect(avertir).toHaveBeenCalledTimes(1);
    }
  });

  it('sans chemin, l’URL de sortie reste celle d’aujourd’hui', () => {
    expect(colibri.urlConfigurateur('https://www.colibripeinture.com', 'cuisine', ['ocre']))
      .toBe('https://www.colibripeinture.com/pages/configurateur?piece=cuisine&teintes=ocre');
  });
});

describe('script hébergé — papiers peints dans la barre', () => {
  const APP = 'https://calculateur.colibripeinture.com';
  const IMAGE = 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/mockup_bebe_-_motif_1_-_terracotta.png';
  const reponse = (corps: unknown): ReponseFetch => ({ ok: true, status: 200, json: () => Promise.resolve(corps) });

  it('lireApplication inchangé : un SKU de papier peint est lu comme toute référence', () => {
    const donnees = {
      products: [{
        colibri_pp: { article_name: 'Montgolfières - Terracotta', article_sku: 'pp-montg-terracotta-le', article_custom_sku: 'autre' },
      }],
    };
    expect(colibri.lireApplication(donnees)).toEqual([{ handle: 'pp-montg-terracotta-le', nom: 'Montgolfières' }]);
  });

  it('mémorise par référence ce que l’API a renvoyé : teinte (hex) et papier peint (image, nom)', async () => {
    const requete = vi.fn((_url: string) => Promise.resolve(reponse([
      { handle: 'horizon', nom: 'Horizon', hex: '#8fa9b8', type: 'peinture', image: null, lien: null },
      {
        handle: 'pp-montg-terracotta-le', nom: 'Montgolfières Terracotta', hex: null, type: 'papier-peint',
        image: IMAGE, lien: 'https://www.colibripeinture.com/products/papier-peint-montgolfiere?variant=57106064965977',
      },
    ])));
    const couleurs = colibri.creerCouleursTeintes(requete);
    await couleurs.chargerCouleurs(APP, ['horizon', 'pp-montg-terracotta-le'], () => {});
    expect(couleurs.reference('horizon')).toEqual({ type: 'peinture', hex: '#8fa9b8', image: null, nom: 'Horizon' });
    expect(couleurs.reference('pp-montg-terracotta-le')).toEqual({
      type: 'papier-peint', hex: null, image: IMAGE, nom: 'Montgolfières Terracotta',
    });
    expect(couleurs.hex('pp-montg-terracotta-le')).toBeNull();
  });

  it('n’accepte qu’une image https pour la vignette', () => {
    expect(colibri.lireImage(IMAGE)).toBe(IMAGE);
    expect(colibri.lireImage('http://cdn.shopify.com/x.png')).toBeNull();
    expect(colibri.lireImage('javascript:alert(1)')).toBeNull();
    expect(colibri.lireImage(null)).toBeNull();
    expect(colibri.lireReference({ type: 'papier-peint', image: 'data:image/png;base64,x', nom: 'X' }).image).toBeNull();
  });

  it('une référence sans type reste une teinte', () => {
    expect(colibri.lireReference({ handle: 'horizon', hex: '#fff' })).toEqual({ type: 'peinture', hex: '#fff', image: null, nom: null });
  });
});

describe('script hébergé — bouton des fiches papier peint (data-variantes)', () => {
  const TABLE = '{"57106064965977":"pp-montg-terracotta-le","57106064933209":"pp-montg-blanc-le"}';

  it('absent : table vide, data-teinte envoyé (fiches teintes inchangées)', () => {
    const avertir = vi.fn();
    expect(colibri.lireVariantes(null, avertir)).toEqual({});
    expect(colibri.referenceBouton('deguesde', colibri.lireVariantes(null), '?variant=123')).toBe('deguesde');
    expect(colibri.urlSimulateurTeinte('deguesde')).toBe('/pages/simulateur?teinte=deguesde');
    expect(avertir).not.toHaveBeenCalled();
  });

  it('valide : la variante de l’URL envoie son SKU', () => {
    const variantes = colibri.lireVariantes(TABLE);
    expect(variantes).toEqual({ '57106064965977': 'pp-montg-terracotta-le', '57106064933209': 'pp-montg-blanc-le' });
    expect(colibri.referenceBouton('pp-montg-terracotta-le', variantes, '?variant=57106064933209')).toBe('pp-montg-blanc-le');
    expect(colibri.referenceBouton('pp-montg-terracotta-le', variantes, '')).toBe('pp-montg-terracotta-le');
  });

  it('variant= inconnu de la table : data-teinte', () => {
    const variantes = colibri.lireVariantes(TABLE);
    expect(colibri.referenceBouton('pp-montg-terracotta-le', variantes, '?variant=99999')).toBe('pp-montg-terracotta-le');
    expect(colibri.referenceBouton('pp-montg-terracotta-le', variantes, '?variant=__proto__')).toBe('pp-montg-terracotta-le');
  });

  it('invalide : JSON illisible ignoré avec console.warn, entrées invalides écartées', () => {
    const avertir = vi.fn();
    expect(colibri.lireVariantes('{pas du json', avertir)).toEqual({});
    expect(colibri.lireVariantes('["pp-montg-blanc-le"]', avertir)).toEqual({});
    expect(avertir).toHaveBeenCalledTimes(2);
    expect(avertir.mock.calls[0][0]).toContain('data-variantes');
    expect(colibri.lireVariantes('{"12":"Pas Un SKU!","abc":"pp-montg-blanc-le","34":"PP-MONTG-ROSE-LE"}'))
      .toEqual({ '34': 'pp-montg-rose-le' });
  });
});

describe('script hébergé — « Sur ma photo » ou « Dans une pièce d’exemple » (retours du 23/10/2026)', () => {
  const cible = {};
  const kit = { LAYOUTS: { FILL_PARENT: 'fill_parent' } };
  const CHAMBRE = '1103ea18-8a07-4f59-a1d3-86d08b406755';

  it('bouton retour de Wizart affiché quel que soit l’essai, uploadPhoto jamais passé', () => {
    for (const essai of [colibri.ESSAI_PHOTO, colibri.ESSAI_EXEMPLE, undefined]) {
      const reglages = colibri.reglagesVisualiseur(kit, 'jeton', cible, 'bleu-ciel', 'chambre', essai);
      expect(reglages.integrationSettings).toEqual({ locale: 'fr', showBackToWebsiteButton: true });
      expect(reglages.integrationSettings).not.toHaveProperty('uploadPhoto');
      expect(JSON.stringify(reglages)).not.toContain('uploadPhoto');
    }
  });

  it('« Sur ma photo » : pas d’openInRoom (galerie Wizart, où se trouve le téléversement), teinte transmise', () => {
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null, 'chambre', colibri.ESSAI_PHOTO).sceneData).toBeUndefined();
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, 'bleu-ciel', 'chambre', colibri.ESSAI_PHOTO).sceneData)
      .toEqual({ openWithProduct: 'bleu-ciel' });
  });

  it('« Dans une pièce d’exemple » : openInRoom de la pièce (comportement actuel, par défaut)', () => {
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null, 'chambre', colibri.ESSAI_EXEMPLE).sceneData)
      .toEqual({ openInRoom: CHAMBRE });
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, 'bleu-ciel', 'chambre', colibri.ESSAI_EXEMPLE).sceneData)
      .toEqual({ openInRoom: CHAMBRE, openWithProduct: 'bleu-ciel' });
    expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null, 'chambre').sceneData).toEqual({ openInRoom: CHAMBRE });
  });

  it('entrée et couloir : « Dans une pièce d’exemple » ouvre la galerie, comme aujourd’hui', () => {
    for (const piece of ['entree', 'couloir']) {
      expect(colibri.reglagesVisualiseur(kit, 'jeton', cible, null, piece, colibri.ESSAI_EXEMPLE).sceneData).toBeUndefined();
    }
  });

  it('libellés de retour selon le mode : boutique (page Simulateur), calculateur (popup couleur)', () => {
    expect(colibri.libelleRetour(colibri.RETOUR_BOUTIQUE)).toBe('Retour à la boutique');
    expect(colibri.libelleRetour(colibri.RETOUR_CALCULATEUR)).toBe('Retour au calculateur');
    expect(colibri.libelleRetour(undefined)).toBe('Retour à la boutique');
  });

  it('barre et surimpression : flèche décorative, plus de « Fermer », surimpression « Simulateur Colibri »', () => {
    const source = readFileSync(new URL('./colibri.js', import.meta.url), 'utf8');
    expect(source).toContain("creer('span', { 'aria-hidden': 'true', texte: '← ' })");
    expect(source).not.toMatch(/texte: 'Fermer'/);
    expect(source).toContain("'aria-label': 'Simulateur Colibri'");
    expect(source).not.toContain('Simulateur de teintes');
    // Page Simulateur : retour boutique ; popup couleur : retour calculateur
    expect(source.match(/retour: RETOUR_BOUTIQUE/g)).toHaveLength(1);
    expect(source.match(/retour: RETOUR_CALCULATEUR/g)).toHaveLength(1);
  });

  it('barre aux couleurs du site : fond #F5F5F5, logo sans fond, bouton principal foncé', () => {
    const source = readFileSync(new URL('./colibri.js', import.meta.url), 'utf8');
    expect(colibri.LOGO_COLIBRI).toBe(
      'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/'
        + 'logo-colibri-lettre-ligne-gris_c069846e-2280-4484-94fa-c0a82abf361a.png?v=1773400972&width=244',
    );
    expect(source).toMatch(/'\.barre\{[^']*background:#F5F5F5;color:#13302a;border-top:1px solid #e3e2dc;/);
    expect(source).toContain("'.logo{flex:0 0 auto;display:inline-flex;align-items:center;}'");
    expect(source).toMatch(/'\.utiliser\{[^']*background:#13302a;color:#fff;/);
    expect(source).toMatch(/'\.retour\{[^']*background:transparent;color:#13302a;border:1px solid #13302a;/);
    expect(source).toMatch(/'\.pastille\{[^']*background:#fff;border:1px solid #e3e2dc;/);
  });

  it('textes de la page Simulateur : teintes et papiers peints, sans le réglage de la lumière', () => {
    const source = readFileSync(new URL('./colibri.js', import.meta.url), 'utf8');
    expect(source).toContain("texte: 'Simulateur Colibri'");
    expect(source).toContain('Essayez nos teintes et nos papiers peints chez vous, avant d’acheter');
    expect(source).toContain('essayez nos teintes et nos papiers peints mur par mur');
    expect(source).toContain("['Essayez teintes et papiers peints', 'Un essai par mur, et la comparaison avant/après.']");
    expect(source).not.toContain('réglage de la lumière');
    expect(source).toContain('Comment voulez-vous essayer ?');
    expect(source).toContain('Changer de pièce');
  });
});
