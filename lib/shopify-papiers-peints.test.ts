import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MONTGOLFIERES_ADMIN, OMBRELLE_ADMIN, reponseCatalogue } from '@/lib/test/papiersPeintsAdmin';

const callAdminAPI = vi.fn();
vi.mock('@/lib/shopify-admin', () => ({ callAdminAPI: (...args: unknown[]) => callAdminAPI(...args) }));

const { DUREE_CACHE_PAPIERS_PEINTS_MS, resoudrePapiersPeints, viderCachePapiersPeints } = await import('./shopify-papiers-peints');

describe('catalogue des papiers peints en cache serveur', () => {
  beforeEach(() => {
    viderCachePapiersPeints();
    callAdminAPI.mockReset();
    callAdminAPI.mockResolvedValue(reponseCatalogue([MONTGOLFIERES_ADMIN, OMBRELLE_ADMIN]));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T09:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deux résolutions successives : un seul appel Admin', async () => {
    expect([...(await resoudrePapiersPeints(['pp-montg-terracotta-le'])).keys()]).toEqual(['pp-montg-terracotta-le']);
    expect([...(await resoudrePapiersPeints(['pp-ombre-bleunuit-le'])).keys()]).toEqual(['pp-ombre-bleunuit-le']);
    expect(callAdminAPI).toHaveBeenCalledTimes(1);
  });

  it('référence inconnue : aucun appel supplémentaire', async () => {
    await resoudrePapiersPeints(['pp-montg-terracotta-le']);
    expect((await resoudrePapiersPeints(['zz-random-sku', 'autre-inconnue'])).size).toBe(0);
    expect(callAdminAPI).toHaveBeenCalledTimes(1);
  });

  it('aucune référence : aucun appel', async () => {
    expect((await resoudrePapiersPeints([])).size).toBe(0);
    expect(callAdminAPI).not.toHaveBeenCalled();
  });

  it('requêtes simultanées : une seule lecture du catalogue', async () => {
    await Promise.all([resoudrePapiersPeints(['pp-montg-terracotta-le']), resoudrePapiersPeints(['zz-random-sku'])]);
    expect(callAdminAPI).toHaveBeenCalledTimes(1);
  });

  it('rechargement après expiration (10 minutes)', async () => {
    await resoudrePapiersPeints(['pp-montg-terracotta-le']);
    vi.advanceTimersByTime(DUREE_CACHE_PAPIERS_PEINTS_MS - 1000);
    await resoudrePapiersPeints(['pp-montg-terracotta-le']);
    expect(callAdminAPI).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    callAdminAPI.mockResolvedValue(reponseCatalogue([OMBRELLE_ADMIN]));
    expect((await resoudrePapiersPeints(['pp-montg-terracotta-le'])).size).toBe(0);
    expect(callAdminAPI).toHaveBeenCalledTimes(2);
  });

  it('échec Admin jamais mis en cache : relu à la résolution suivante', async () => {
    callAdminAPI.mockRejectedValueOnce(new Error('panne'));
    await expect(resoudrePapiersPeints(['pp-montg-terracotta-le'])).rejects.toThrow('panne');
    expect((await resoudrePapiersPeints(['pp-montg-terracotta-le'])).size).toBe(1);
    expect(callAdminAPI).toHaveBeenCalledTimes(2);
  });

  it('pagination : toutes les pages du catalogue sont lues', async () => {
    callAdminAPI
      .mockResolvedValueOnce({ products: { pageInfo: { hasNextPage: true, endCursor: 'c1' }, nodes: [MONTGOLFIERES_ADMIN] } })
      .mockResolvedValueOnce(reponseCatalogue([OMBRELLE_ADMIN]));
    const trouves = await resoudrePapiersPeints(['pp-montg-terracotta-le', 'pp-ombre-bleunuit-le']);
    expect(trouves.size).toBe(2);
    expect(callAdminAPI.mock.calls.map(([, variables]) => variables)).toEqual([{ after: null }, { after: 'c1' }]);
  });
});
