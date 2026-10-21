import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  couleursMurArrivee,
  enregistrerArriveeSimulateur,
  getArriveeSimulateur,
  lireArriveeStockee,
} from '@/lib/store/arriveeSimulateur';
import { getPapiersPeintsEssayes } from '@/lib/store/papiersPeintsEssayes';
import { MAX_TEINTES_ESSAYEES, fusionnerSelectionSimulateur, getTeintesEssayees } from '@/lib/store/teintesEssayees';
import { trierReferences } from '@/lib/referencesSimulateur';
import {
  MONTGOLFIERE_TERRACOTTA,
  OMBRELLE_BLEU_NUIT,
  papierPeint,
  stubRoutesBoutique,
  stubStockages,
} from '@/lib/test/simulateurFixtures';
import type { Couleur } from '@/lib/types';

const couleur = (handle: string): Couleur => ({
  productId: `gid://shopify/Product/${handle}`,
  productHandle: handle,
  titre: `${handle} - Peinture biosourcée murs et plafonds`,
  collection: '',
  base: 'Blanc',
  sousCouche: 'blanche',
  codeHex: '#FFFFFF',
  finition: 'Mate',
  imageUrl: '',
  variants: [],
});

/** Arrivée depuis le simulateur : mur créé et bloc « Vos teintes essayées » */
function arriver(handles: string[], existantes: string[] = []) {
  return {
    murs: couleursMurArrivee(handles.map(couleur)).map((c) => c.productHandle),
    essayees: fusionnerSelectionSimulateur(existantes, handles),
  };
}

describe('arrivée depuis le simulateur — un mur, la dernière teinte', () => {
  it('1 teinte : 1 mur, teinte posée (inchangé)', () => {
    expect(arriver(['deguesde'])).toEqual({ murs: ['deguesde'], essayees: ['deguesde'] });
  });

  it('4 teintes : 1 mur avec la 4e, les 4 dans les teintes essayées, la 4e en tête', () => {
    expect(arriver(['t1', 't2', 't3', 't4'])).toEqual({
      murs: ['t4'],
      essayees: ['t4', 't3', 't2', 't1'],
    });
  });

  it('13 teintes : bloc limité à 12, les 12 plus récentes', () => {
    const handles = Array.from({ length: 13 }, (_, i) => `t${i + 1}`);
    const { murs, essayees } = arriver(handles);
    expect(murs).toEqual(['t13']);
    expect(MAX_TEINTES_ESSAYEES).toBe(12);
    expect(essayees).toHaveLength(12);
    expect(essayees[0]).toBe('t13');
    expect(essayees).not.toContain('t1');
  });

  it('les teintes déjà essayées suivent, sans doublon', () => {
    expect(arriver(['t1', 't2'], ['t1', 'ancienne']).essayees).toEqual(['t2', 't1', 'ancienne']);
  });

  it('aucune teinte : aucun mur', () => {
    expect(couleursMurArrivee([])).toEqual([]);
  });
});

describe('relais vers la page Surfaces', () => {
  it('lit le mur et le nombre de teintes reçues', () => {
    const stocke = JSON.stringify({ couleurs: [couleur('t4')], teintesRecues: 4 });
    const arrivee = lireArriveeStockee(stocke);
    expect(arrivee.couleurs.map((c) => c.productHandle)).toEqual(['t4']);
    expect(arrivee.teintesRecues).toBe(4);
  });

  it('tolère un contenu absent, invalide ou altéré', () => {
    expect(lireArriveeStockee(null)).toEqual({ couleurs: [], teintesRecues: 0 });
    expect(lireArriveeStockee('{pas du json')).toEqual({ couleurs: [], teintesRecues: 0 });
    expect(lireArriveeStockee('[]')).toEqual({ couleurs: [], teintesRecues: 0 });
    expect(lireArriveeStockee(JSON.stringify({ couleurs: [{ x: 1 }], teintesRecues: 'deux' })))
      .toEqual({ couleurs: [], teintesRecues: 0 });
  });
});

describe('arrivée depuis le simulateur — papiers peints', () => {
  beforeEach(() => {
    stubStockages();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Écran d'arrivée puis « Calculer les quantités » : tri par la boutique, enregistrement */
  async function arriverAvec(references: string[], teintes: string[], papiers = [MONTGOLFIERE_TERRACOTTA, OMBRELLE_BLEU_NUIT]) {
    stubRoutesBoutique(teintes, papiers);
    const { couleurs, papiersPeints } = await trierReferences(references, { targetFinition: 'Mate' });
    const arrivee = enregistrerArriveeSimulateur(couleurs, papiersPeints);
    return {
      murs: arrivee.couleurs.map((c) => c.productHandle),
      essayees: getTeintesEssayees(),
      papiersPeints: getPapiersPeintsEssayes(),
      relais: getArriveeSimulateur(),
    };
  }

  it('2 teintes + 1 papier peint : 1 mur avec la 2e teinte, 2 teintes essayées, 1 papier peint stocké', async () => {
    const resultat = await arriverAvec(['t1', 't2', 'pp-montg-terracotta-le'], ['t1', 't2']);
    expect(resultat.murs).toEqual(['t2']);
    expect(resultat.essayees).toEqual(['t2', 't1']);
    expect(resultat.papiersPeints).toEqual(['pp-montg-terracotta-le']);
    expect(resultat.relais.teintesRecues).toBe(2);
    expect(resultat.relais.papiersPeintsRecus).toBe(1);
  });

  it('la dernière peinture appliquée, même si un papier peint a été appliqué après', async () => {
    const resultat = await arriverAvec(['t1', 'pp-montg-terracotta-le', 't2', 'pp-ombre-bleunuit-le'], ['t1', 't2']);
    expect(resultat.murs).toEqual(['t2']);
    expect(resultat.papiersPeints).toEqual(['pp-ombre-bleunuit-le', 'pp-montg-terracotta-le']);
  });

  it('papier peint seul : 1 mur sans couleur (aucune couleur relayée), papier peint stocké', async () => {
    const resultat = await arriverAvec(['pp-montg-terracotta-le'], []);
    expect(resultat.murs).toEqual([]);
    expect(resultat.essayees).toEqual([]);
    expect(resultat.papiersPeints).toEqual(['pp-montg-terracotta-le']);
    expect(resultat.relais).toEqual({ couleurs: [], teintesRecues: 0, papiersPeintsRecus: 1 });
  });

  it('13 papiers peints : 12 stockés, les plus récents', async () => {
    const papiers = Array.from({ length: 13 }, (_, i) =>
      papierPeint(`pp-test-${i + 1}-le`, 'Test', `Coloris ${i + 1}`, String(1000 + i), 'papier-peint-test'));
    const resultat = await arriverAvec(papiers.map((p) => p.sku), [], papiers);
    expect(resultat.papiersPeints).toHaveLength(12);
    expect(resultat.papiersPeints[0]).toBe('pp-test-13-le');
    expect(resultat.papiersPeints).not.toContain('pp-test-1-le');
  });

  it('relais : un nombre de papiers peints invalide est ignoré', () => {
    expect(lireArriveeStockee(JSON.stringify({ couleurs: [], teintesRecues: 0, papiersPeintsRecus: 'deux' })))
      .toEqual({ couleurs: [], teintesRecues: 0 });
  });
});
