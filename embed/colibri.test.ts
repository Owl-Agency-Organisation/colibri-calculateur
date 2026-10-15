import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { LIBELLES_PIECES } from '@/lib/pieces';

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

interface LogiqueColibri {
  PIECES: [string, string][];
  CAPACITE_SIMULATEUR: string;
  SCRIPT_DEPKIT: string;
  estHandle(valeur: unknown): boolean;
  normaliserTeintes(valeurs: unknown): string[];
  lireEntreeConfigurateur(recherche: string, pieceSession: string | null): Entree | null;
  cheminIframe(entree: Entree | null): string;
  rechercheSansEntree(recherche: string): string;
  urlConfigurateur(origine: string, piece: string, teintes: string[]): string;
  urlSimulateurTeinte(handle: string): string;
  lireTeinteDemandee(recherche: string): string | null;
  lireMessageApp(donnees: unknown): Record<string, unknown> | null;
  simulateurDisponible(config: Config, kitDejaPresent: boolean): boolean;
  capacites(config: Config, kitDejaPresent: boolean): string[];
  extraireHandles(valeur: unknown): string[];
}

const colibri = createRequire(import.meta.url)('./colibri.js') as LogiqueColibri;

describe('script hébergé — pièces', () => {
  it('reprend exactement les types et libellés de pièce de l’app', () => {
    expect(Object.fromEntries(colibri.PIECES)).toEqual(LIBELLES_PIECES);
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

describe('script hébergé — capacités et panier Wizart', () => {
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

  it('extrait les handles du panier dans l’ordre, sans doublon', () => {
    expect(colibri.extraireHandles([
      { vendor_code: 'bleu-ciel', quantity: 1 },
      { vendor_code: 'vert-sauge', quantity: 2 },
      { vendor_code: 'bleu-ciel', quantity: 1 },
    ])).toEqual(['bleu-ciel', 'vert-sauge']);
  });

  it('tolère les variantes de forme du panier', () => {
    expect(colibri.extraireHandles({ products: [{ vendorCode: 'a1' }, 'b2', { sku: 'c3' }, { handle: 'd4' }] }))
      .toEqual(['a1', 'b2', 'c3', 'd4']);
    expect(colibri.extraireHandles({ items: [{ vendor_code: 'x' }] })).toEqual(['x']);
    expect(colibri.extraireHandles(undefined)).toEqual([]);
    expect(colibri.extraireHandles([{ vendor_code: 42 }, null])).toEqual([]);
  });
});

describe('script hébergé — DepKit', () => {
  it('charge une seule version du DepKit, la v1.1.3, sans repli', () => {
    expect(colibri.SCRIPT_DEPKIT).toBe('https://d18jpdcj6p6zg6.cloudfront.net/wizart-deployment-kit-v1.1.3.min.js');
    const source = readFileSync(new URL('./colibri.js', import.meta.url), 'utf8');
    expect(source.match(/wizart-deployment-kit-v[\d.]+\.min\.js/g)).toEqual(['wizart-deployment-kit-v1.1.3.min.js']);
  });
});
