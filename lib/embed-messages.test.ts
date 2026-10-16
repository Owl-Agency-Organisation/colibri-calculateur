import { describe, expect, it } from 'vitest';
import {
  CAPACITE_SIMULATEUR,
  estHandleTeinte,
  lireEntreeSimulateur,
  derniereTeinte,
  lireMessagePage,
  messageOuvrirSimulateur,
  normaliserSelection,
  normaliserTeintes,
} from '@/lib/embed-messages';

describe('handles de teinte', () => {
  it('accepte les handles Shopify, rejette le reste', () => {
    expect(estHandleTeinte('bleu-ciel')).toBe(true);
    expect(estHandleTeinte('schmidt-blanc-2')).toBe(true);
    expect(estHandleTeinte('Bleu-Ciel')).toBe(false);
    expect(estHandleTeinte('bleu--ciel')).toBe(false);
    expect(estHandleTeinte('-bleu')).toBe(false);
    expect(estHandleTeinte('../admin')).toBe(false);
    expect(estHandleTeinte('')).toBe(false);
    expect(estHandleTeinte('a'.repeat(256))).toBe(false);
    expect(estHandleTeinte(42)).toBe(false);
  });

  it('normalise une liste : ordre conservé, sans doublon, invalides ignorés', () => {
    expect(normaliserTeintes(['bleu-ciel', ' Vert-Sauge ', 'bleu-ciel', 3, '<x>', 'ocre']))
      .toEqual(['bleu-ciel', 'vert-sauge', 'ocre']);
    expect(normaliserTeintes(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
  });
});

describe('messages page → app', () => {
  it('lit colibri:parent:pret', () => {
    expect(lireMessagePage({ type: 'colibri:parent:pret', capacites: [CAPACITE_SIMULATEUR] }))
      .toEqual({ type: 'colibri:parent:pret', capacites: ['simulateur'] });
    expect(lireMessagePage({ type: 'colibri:parent:pret', capacites: [] }))
      .toEqual({ type: 'colibri:parent:pret', capacites: [] });
    expect(lireMessagePage({ type: 'colibri:parent:pret', capacites: [1, '', 'simulateur'] }))
      .toEqual({ type: 'colibri:parent:pret', capacites: ['simulateur'] });
    expect(lireMessagePage({ type: 'colibri:parent:pret' })).toBeNull();
  });

  it('lit colibri:simulateur:selection dans l’ordre d’application (dernière = plus récente)', () => {
    expect(lireMessagePage({ type: 'colibri:simulateur:selection', teintes: ['b', 'a', 'c'] }))
      .toEqual({ type: 'colibri:simulateur:selection', teintes: ['b', 'a', 'c'] });
    // Un doublon compte à sa dernière occurrence : réappliquée, la teinte est la plus récente
    expect(lireMessagePage({ type: 'colibri:simulateur:selection', teintes: ['b', 'a', 'b', 'X Y'] }))
      .toEqual({ type: 'colibri:simulateur:selection', teintes: ['a', 'b'] });
    expect(lireMessagePage({ type: 'colibri:simulateur:selection', teintes: 'a,b' })).toBeNull();
  });

  it('lit colibri:simulateur:ferme', () => {
    expect(lireMessagePage({ type: 'colibri:simulateur:ferme' })).toEqual({ type: 'colibri:simulateur:ferme' });
  });

  it('rejette les messages inconnus ou mal formés', () => {
    expect(lireMessagePage(null)).toBeNull();
    expect(lireMessagePage('colibri:simulateur:ferme')).toBeNull();
    expect(lireMessagePage({ type: 'colibri:resize', height: 100 })).toBeNull();
    expect(lireMessagePage({})).toBeNull();
  });
});

describe('messages app → page', () => {
  it('construit colibri:simulateur:ouvrir, teinte facultative et validée', () => {
    expect(messageOuvrirSimulateur('chambre')).toEqual({ type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
    expect(messageOuvrirSimulateur('chambre', 'bleu-ciel'))
      .toEqual({ type: 'colibri:simulateur:ouvrir', piece: 'chambre', teinte: 'bleu-ciel' });
    expect(messageOuvrirSimulateur('chambre', 'Bleu Ciel'))
      .toEqual({ type: 'colibri:simulateur:ouvrir', piece: 'chambre' });
  });
});

describe('paramètres de /calculateur/simulateur', () => {
  const lire = (recherche: string) => lireEntreeSimulateur(new URLSearchParams(recherche));

  it('lit la pièce et les teintes', () => {
    expect(lire('piece=chambre&teintes=bleu-ciel,vert-sauge'))
      .toEqual({ piece: 'chambre', teintes: ['bleu-ciel', 'vert-sauge'] });
  });

  it('renvoie null si la pièce ou les teintes sont invalides ou absentes', () => {
    expect(lire('')).toBeNull();
    expect(lire('piece=chambre')).toBeNull();
    expect(lire('piece=chambre&teintes=')).toBeNull();
    expect(lire('piece=chambre&teintes=,,%3Cscript%3E')).toBeNull();
    expect(lire('piece=garage&teintes=bleu-ciel')).toBeNull();
    expect(lire('teintes=bleu-ciel')).toBeNull();
  });
});

describe('sélection du simulateur', () => {
  it('garde les plus récentes au-delà du maximum, la dernière restant la plus récente', () => {
    expect(normaliserSelection(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd']);
    expect(normaliserSelection([' A ', 3, 'b'])).toEqual(['a', 'b']);
  });

  it('la teinte posée sur le mur est la dernière de la liste', () => {
    expect(derniereTeinte(['deguesde', 'horizon', 'ocre'])).toBe('ocre');
    expect(derniereTeinte(['horizon'])).toBe('horizon');
    expect(derniereTeinte([])).toBeNull();
    const message = lireMessagePage({ type: 'colibri:simulateur:selection', teintes: ['ocre', 'horizon', 'ocre'] });
    expect(message?.type === 'colibri:simulateur:selection' && derniereTeinte(message.teintes)).toBe('ocre');
  });
});
