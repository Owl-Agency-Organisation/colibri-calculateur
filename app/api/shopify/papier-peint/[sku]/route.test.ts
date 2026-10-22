import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OMBRELLE_ADMIN, reponseCatalogue } from '@/lib/test/papiersPeintsAdmin';

const callAdminAPI = vi.fn();
vi.mock('@/lib/shopify-admin', () => ({ callAdminAPI: (...args: unknown[]) => callAdminAPI(...args) }));

const { GET } = await import('./route');
const { viderCachePapiersPeints } = await import('@/lib/shopify-papiers-peints');

const appeler = (sku: string) => GET(new Request(`https://app.test/api/shopify/papier-peint/${sku}`), {
  params: Promise.resolve({ sku }),
});

describe('GET /api/shopify/papier-peint/{sku}', () => {
  beforeEach(() => {
    callAdminAPI.mockReset();
    callAdminAPI.mockResolvedValue(reponseCatalogue([OMBRELLE_ADMIN]));
    viderCachePapiersPeints();
  });

  it('résout un SKU de variante « Lé »', async () => {
    const reponse = await appeler('pp-ombre-bleunuit-le');
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({
      sku: 'pp-ombre-bleunuit-le',
      handle: 'ombrelle-papier-peint-ecologique',
      titre: 'Ombrelle - Papier peint écologique',
      motif: 'Ombrelle',
      coloris: 'Ombrelle bleu nuit',
      imageUrl: 'https://cdn.shopify.com/mockup_salon_4_-_motif_3_-_bleu_nuit.png',
      variantId: 'gid://shopify/ProductVariant/57173225832793',
      lien: 'https://www.colibripeinture.com/products/ombrelle-papier-peint-ecologique?variant=57173225832793',
    });
  });

  it('404 si inconnu ou invalide ; une fois le catalogue en cache, aucun appel Admin par référence', async () => {
    expect((await appeler('pp-ombre-bleunuit-le')).status).toBe(200);
    expect((await appeler('zz-random-sku')).status).toBe(404);
    expect((await appeler('pp-inconnu-le')).status).toBe(404);
    expect((await appeler('Pas valide!')).status).toBe(404);
    expect(callAdminAPI).toHaveBeenCalledTimes(1);
  });

  it('502 si l’Admin API est indisponible', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    callAdminAPI.mockRejectedValue(new Error('panne'));
    expect((await appeler('pp-ombre-bleunuit-le')).status).toBe(502);
  });
});
