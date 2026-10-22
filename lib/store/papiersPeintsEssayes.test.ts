import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ajouterPapiersPeintsSimulateur, getPapiersPeintsEssayes } from '@/lib/store/papiersPeintsEssayes';
import { getTeintesEssayees } from '@/lib/store/teintesEssayees';
import { STORAGE_KEYS, clearProjetData } from '@/lib/store/projetStore';
import { stubStockages } from '@/lib/test/simulateurFixtures';

describe('stockage des papiers peints essayés', () => {
  beforeEach(() => {
    stubStockages();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stocke sous colibri-projet-papiers-peints-essayes, le plus récent en tête, sans doublon', () => {
    expect(STORAGE_KEYS.PAPIERS_PEINTS_ESSAYES).toBe('colibri-projet-papiers-peints-essayes');
    ajouterPapiersPeintsSimulateur(['pp-montg-terracotta-le', 'pp-ombre-bleunuit-le']);
    ajouterPapiersPeintsSimulateur(['pp-rayur-vert-le', 'pp-montg-terracotta-le']);
    expect(getPapiersPeintsEssayes()).toEqual(['pp-montg-terracotta-le', 'pp-rayur-vert-le', 'pp-ombre-bleunuit-le']);
    expect(localStorage.getItem('colibri-projet-papiers-peints-essayes'))
      .toBe('["pp-montg-terracotta-le","pp-rayur-vert-le","pp-ombre-bleunuit-le"]');
    // Jamais dans les teintes essayées
    expect(getTeintesEssayees()).toEqual([]);
  });

  it('12 au plus : les plus anciens sont oubliés', () => {
    const skus = Array.from({ length: 13 }, (_, i) => `pp-test-${i + 1}-le`);
    expect(ajouterPapiersPeintsSimulateur(skus)).toHaveLength(12);
    expect(getPapiersPeintsEssayes()[0]).toBe('pp-test-13-le');
    expect(getPapiersPeintsEssayes()).not.toContain('pp-test-1-le');
  });

  it('est purgée avec le projet (clearProjetData)', () => {
    ajouterPapiersPeintsSimulateur(['pp-montg-terracotta-le']);
    clearProjetData();
    expect(getPapiersPeintsEssayes()).toEqual([]);
  });
});
