import { beforeEach, describe, expect, it, vi } from 'vitest';

const callAdminAPI = vi.fn();
vi.mock('@/lib/shopify-admin', () => ({ callAdminAPI: (...args: unknown[]) => callAdminAPI(...args) }));

const { GET } = await import('./route');

const VARIANTE = {
  id: 'gid://shopify/ProductVariant/57173225832793',
  legacyResourceId: '57173225832793',
  sku: 'pp-ombre-bleunuit-le',
  selectedOptions: [{ name: 'Couleur', value: 'Ombrelle bleu nuit' }, { name: 'Taille', value: 'Lé : 53x280cm' }],
  image: { url: 'https://cdn.shopify.com/mockup_salon_4_-_motif_3_-_bleu_nuit.png' },
  product: {
    handle: 'ombrelle-papier-peint-ecologique',
    title: 'Ombrelle - Papier peint écologique',
    productType: 'Papier peint',
    featuredImage: null,
  },
};

const appeler = (sku: string) => GET(new Request(`https://app.test/api/shopify/papier-peint/${sku}`), {
  params: Promise.resolve({ sku }),
});

describe('GET /api/shopify/papier-peint/{sku}', () => {
  beforeEach(() => {
    callAdminAPI.mockReset();
  });

  it('résout un SKU de variante « Lé »', async () => {
    callAdminAPI.mockResolvedValue({ v0: { nodes: [VARIANTE] } });
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
    expect(callAdminAPI.mock.calls[0][1]).toEqual({ q0: 'sku:"pp-ombre-bleunuit-le"' });
  });

  it('404 si inconnu ou invalide (sans appel Admin pour une référence invalide)', async () => {
    callAdminAPI.mockResolvedValue({ v0: { nodes: [] } });
    expect((await appeler('pp-inconnu-le')).status).toBe(404);
    callAdminAPI.mockClear();
    expect((await appeler('Pas valide!')).status).toBe(404);
    expect(callAdminAPI).not.toHaveBeenCalled();
  });

  it('502 si l’Admin API est indisponible', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    callAdminAPI.mockRejectedValue(new Error('panne'));
    expect((await appeler('pp-ombre-bleunuit-le')).status).toBe(502);
  });
});
