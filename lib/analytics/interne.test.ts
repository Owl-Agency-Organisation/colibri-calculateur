import { beforeEach, describe, expect, it, vi } from 'vitest';

type ModuleInterne = typeof import('./interne');

// L'état du module (reflet mémoire, écouteurs, clics) doit repartir de zéro
// à chaque test : import dynamique après resetModules.
async function chargerModule(): Promise<ModuleInterne> {
  vi.resetModules();
  return import('./interne');
}

function creerFauxStockage(initial: Record<string, string> = {}): Storage {
  const donnees = new Map(Object.entries(initial));
  return {
    getItem: (cle: string) => donnees.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => {
      donnees.set(cle, valeur);
    },
    removeItem: (cle: string) => {
      donnees.delete(cle);
    },
    clear: () => donnees.clear(),
    key: () => null,
    get length() {
      return donnees.size;
    },
  } as Storage;
}

// Simule un accès bloqué (navigation privée, blocage du stockage tiers) :
// toute méthode jette, comme un SecurityError navigateur.
function creerStockageEnPanne(): Storage {
  const jeter = (): never => {
    throw new Error('SecurityError simulée');
  };
  return {
    getItem: jeter,
    setItem: jeter,
    removeItem: jeter,
    clear: jeter,
    key: jeter,
    length: 0,
  } as Storage;
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('estTraficInterne / definirTraficInterne', () => {
  it('est inactif par défaut', async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    expect(interne.estTraficInterne()).toBe(false);
  });

  it("s'active et écrit le drapeau sous la clé dédiée", async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    interne.definirTraficInterne(true);
    expect(interne.estTraficInterne()).toBe(true);
    expect(globalThis.localStorage.getItem(interne.CLE_TRAFIC_INTERNE)).toBe('1');
  });

  it('se désactive et retire la clé', async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    interne.definirTraficInterne(true);
    interne.definirTraficInterne(false);
    expect(interne.estTraficInterne()).toBe(false);
    expect(globalThis.localStorage.getItem(interne.CLE_TRAFIC_INTERNE)).toBeNull();
  });

  it('persiste entre deux chargements du module (sessions)', async () => {
    globalThis.localStorage = creerFauxStockage();
    const premiereSession = await chargerModule();
    premiereSession.definirTraficInterne(true);

    const deuxiemeSession = await chargerModule();
    expect(deuxiemeSession.estTraficInterne()).toBe(true);
  });

  it('bascule avec basculerTraficInterne', async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    expect(interne.basculerTraficInterne()).toBe(true);
    expect(interne.basculerTraficInterne()).toBe(false);
    expect(interne.estTraficInterne()).toBe(false);
  });
});

describe('stockage indisponible', () => {
  it('ne jette pas quand localStorage est absent', async () => {
    const interne = await chargerModule();
    expect(() => interne.estTraficInterne()).not.toThrow();
    expect(interne.estTraficInterne()).toBe(false);
    expect(() => interne.definirTraficInterne(true)).not.toThrow();
    // Le reflet mémoire prend le relais pour la session en cours
    expect(interne.estTraficInterne()).toBe(true);
  });

  it('ne jette pas quand chaque accès au stockage lève une exception', async () => {
    globalThis.localStorage = creerStockageEnPanne();
    const interne = await chargerModule();
    expect(() => interne.estTraficInterne()).not.toThrow();
    expect(interne.estTraficInterne()).toBe(false);
    expect(() => interne.definirTraficInterne(true)).not.toThrow();
    expect(interne.estTraficInterne()).toBe(true);
    expect(() => interne.definirTraficInterne(false)).not.toThrow();
    expect(interne.estTraficInterne()).toBe(false);
  });

  it('ne persiste pas entre deux sessions sans stockage (comportement assumé)', async () => {
    const premiereSession = await chargerModule();
    premiereSession.definirTraficInterne(true);

    const deuxiemeSession = await chargerModule();
    expect(deuxiemeSession.estTraficInterne()).toBe(false);
  });
});

describe('appliquerParametreUrl', () => {
  it('active avec ?owl=1', async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    expect(interne.appliquerParametreUrl('?owl=1')).toBe(true);
    expect(interne.estTraficInterne()).toBe(true);
  });

  it('désactive avec ?owl=0, même parmi d’autres paramètres', async () => {
    globalThis.localStorage = creerFauxStockage({ 'colibri:trafic-interne': '1' });
    const interne = await chargerModule();
    expect(interne.appliquerParametreUrl('?foo=bar&owl=0')).toBe(false);
    expect(interne.estTraficInterne()).toBe(false);
  });

  it("ne change rien si le paramètre est absent ou invalide", async () => {
    globalThis.localStorage = creerFauxStockage({ 'colibri:trafic-interne': '1' });
    const interne = await chargerModule();
    expect(interne.appliquerParametreUrl('')).toBeNull();
    expect(interne.appliquerParametreUrl('?owl=2')).toBeNull();
    expect(interne.appliquerParametreUrl('?autre=1')).toBeNull();
    expect(interne.estTraficInterne()).toBe(true);
  });
});

describe('enregistrerClicGeste', () => {
  it('bascule après NB_CLICS_GESTE clics rapprochés', async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    let resultat: boolean | null = null;
    for (let i = 0; i < interne.NB_CLICS_GESTE; i++) {
      resultat = interne.enregistrerClicGeste(1000 + i * 100);
      if (i < interne.NB_CLICS_GESTE - 1) {
        expect(resultat).toBeNull();
      }
    }
    expect(resultat).toBe(true);
    expect(interne.estTraficInterne()).toBe(true);
  });

  it('ignore les clics trop espacés', async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    for (let i = 0; i < interne.NB_CLICS_GESTE * 2; i++) {
      // Chaque clic sort de la fenêtre du précédent : jamais NB_CLICS_GESTE
      // clics dans la même fenêtre
      expect(
        interne.enregistrerClicGeste(i * (interne.FENETRE_GESTE_MS + 1))
      ).toBeNull();
    }
    expect(interne.estTraficInterne()).toBe(false);
  });

  it('un second geste désactive le mode (et le compteur repart de zéro)', async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    for (let i = 0; i < interne.NB_CLICS_GESTE; i++) {
      interne.enregistrerClicGeste(1000 + i * 100);
    }
    expect(interne.estTraficInterne()).toBe(true);

    let resultat: boolean | null = null;
    for (let i = 0; i < interne.NB_CLICS_GESTE; i++) {
      resultat = interne.enregistrerClicGeste(10000 + i * 100);
      if (i < interne.NB_CLICS_GESTE - 1) {
        expect(resultat).toBeNull();
      }
    }
    expect(resultat).toBe(false);
    expect(interne.estTraficInterne()).toBe(false);
  });
});

describe('surChangementTraficInterne', () => {
  it('notifie à chaque changement et respecte le désabonnement', async () => {
    globalThis.localStorage = creerFauxStockage();
    const interne = await chargerModule();
    const ecouteur = vi.fn();
    const desabonner = interne.surChangementTraficInterne(ecouteur);

    interne.definirTraficInterne(true);
    expect(ecouteur).toHaveBeenCalledTimes(1);

    interne.definirTraficInterne(false);
    expect(ecouteur).toHaveBeenCalledTimes(2);

    desabonner();
    interne.definirTraficInterne(true);
    expect(ecouteur).toHaveBeenCalledTimes(2);
  });
});
