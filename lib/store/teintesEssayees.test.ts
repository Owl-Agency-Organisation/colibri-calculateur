import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_TEINTES_ESSAYEES,
  ajouterTeintesEssayees,
  fusionnerTeintes,
  getTeintesEssayees,
  lireTeintesStockees,
} from '@/lib/store/teintesEssayees';
import { STORAGE_KEYS, clearProjetData } from '@/lib/store/projetStore';

describe('fusionnerTeintes', () => {
  it('place les nouvelles teintes en tête, dans leur ordre, sans doublon', () => {
    expect(fusionnerTeintes(['a', 'b', 'c'], ['d', 'b'])).toEqual(['d', 'b', 'a', 'c']);
  });

  it('remonte en tête une teinte déjà essayée', () => {
    expect(fusionnerTeintes(['a', 'b', 'c'], ['c'])).toEqual(['c', 'a', 'b']);
  });

  it('ignore les handles invalides et borne la liste', () => {
    expect(fusionnerTeintes([], ['ok', 'Pas Ok', ''])).toEqual(['ok']);
    const anciennes = Array.from({ length: MAX_TEINTES_ESSAYEES }, (_, i) => `t${i}`);
    const resultat = fusionnerTeintes(anciennes, ['nouvelle']);
    expect(resultat).toHaveLength(MAX_TEINTES_ESSAYEES);
    expect(resultat[0]).toBe('nouvelle');
    expect(resultat).not.toContain(`t${MAX_TEINTES_ESSAYEES - 1}`);
  });
});

describe('lireTeintesStockees', () => {
  it('tolère un contenu absent, invalide ou altéré', () => {
    expect(lireTeintesStockees(null)).toEqual([]);
    expect(lireTeintesStockees('pas du json')).toEqual([]);
    expect(lireTeintesStockees('{"a":1}')).toEqual([]);
    expect(lireTeintesStockees('["a","a",3,"b"]')).toEqual(['a', 'b']);
  });
});

describe('stockage des teintes essayées', () => {
  beforeEach(() => {
    const donnees = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (cle: string) => donnees.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => { donnees.set(cle, valeur); },
      removeItem: (cle: string) => { donnees.delete(cle); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stocke sous colibri-projet-teintes-essayees, la plus récente en tête', () => {
    expect(STORAGE_KEYS.TEINTES_ESSAYEES).toBe('colibri-projet-teintes-essayees');
    ajouterTeintesEssayees(['a', 'b']);
    ajouterTeintesEssayees(['c']);
    expect(getTeintesEssayees()).toEqual(['c', 'a', 'b']);
    expect(localStorage.getItem('colibri-projet-teintes-essayees')).toBe('["c","a","b"]');
  });

  it('est purgée avec le projet (clearProjetData)', () => {
    ajouterTeintesEssayees(['a']);
    clearProjetData();
    expect(getTeintesEssayees()).toEqual([]);
  });
});
