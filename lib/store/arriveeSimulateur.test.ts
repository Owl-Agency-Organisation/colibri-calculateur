import { describe, expect, it } from 'vitest';
import { couleursMurArrivee, lireArriveeStockee } from '@/lib/store/arriveeSimulateur';
import { MAX_TEINTES_ESSAYEES, fusionnerSelectionSimulateur } from '@/lib/store/teintesEssayees';
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
