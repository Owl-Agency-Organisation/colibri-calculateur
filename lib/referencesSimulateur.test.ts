import { afterEach, describe, expect, it, vi } from 'vitest';
import { trierReferences } from '@/lib/referencesSimulateur';
import { MONTGOLFIERE_TERRACOTTA, stubRoutesBoutique } from '@/lib/test/simulateurFixtures';

describe('tri des références du simulateur', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('teinte, papier peint, inconnue : dans l’ordre reçu, l’inconnue ignorée et signalée', async () => {
    stubRoutesBoutique(['deguesde'], [MONTGOLFIERE_TERRACOTTA]);
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const triees = await trierReferences(['deguesde', 'pp-montg-terracotta-le', 'inconnue'], { targetFinition: 'Mate' });
    expect(triees.references.map((r) => `${r.type}:${r.reference}`)).toEqual([
      'peinture:deguesde',
      'papier-peint:pp-montg-terracotta-le',
      'inconnue:inconnue',
    ]);
    expect(triees.couleurs.map((c) => c.productHandle)).toEqual(['deguesde']);
    expect(triees.papiersPeints).toEqual([MONTGOLFIERE_TERRACOTTA]);
    // Seule l'inconnue est signalée (pas le papier peint, absent des teintes)
    expect(avertissement).toHaveBeenCalledTimes(1);
    expect(avertissement).toHaveBeenCalledWith(expect.stringContaining('inconnue'));
  });

  it('une teinte n’est jamais cherchée comme papier peint', async () => {
    const appels = stubRoutesBoutique(['horizon'], []);
    await trierReferences(['horizon']);
    expect(appels).toEqual(['/api/shopify/product/horizon']);
  });

  it('erreur serveur : référence en erreur, ni teinte ni papier peint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const triees = await trierReferences(['horizon']);
    expect(triees.references).toEqual([{ type: 'erreur', reference: 'horizon' }]);
    expect(triees.couleurs).toEqual([]);
  });
});
