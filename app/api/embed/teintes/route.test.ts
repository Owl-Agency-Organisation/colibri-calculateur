import { beforeEach, describe, expect, it, vi } from 'vitest';

const shopifyFetch = vi.fn();
vi.mock('@/lib/shopify', () => ({ shopifyFetch: (...args: unknown[]) => shopifyFetch(...args) }));
// Admin API (résolution des SKU papier peint) : aucune variante par défaut
const callAdminAPI = vi.fn();
vi.mock('@/lib/shopify-admin', () => ({ callAdminAPI: (...args: unknown[]) => callAdminAPI(...args) }));

const { GET, OPTIONS } = await import('./route');

const APP = 'https://calculateur.colibripeinture.com';
const BOUTIQUE = 'https://www.colibripeinture.com';

function requete(handles: string, origine?: string): Request {
  return new Request(`${APP}/api/embed/teintes?handles=${handles}`, {
    headers: origine ? { Origin: origine } : {},
  });
}

describe('GET /api/embed/teintes', () => {
  beforeEach(() => {
    shopifyFetch.mockReset();
    callAdminAPI.mockReset();
    callAdminAPI.mockResolvedValue({});
  });

  it('renvoie [{ handle, nom, hex }] dans l’ordre demandé, inconnus et invalides ignorés', async () => {
    shopifyFetch.mockResolvedValue({
      data: {
        t0: { handle: 'horizon', title: 'Horizon - Peinture biosourcée murs et plafonds', hex: { value: '#8FA9B8' } },
        t1: null,
        t2: { handle: 'deguesde', title: 'Deguesde - Peinture', hex: null },
      },
    });
    const reponse = await GET(requete('horizon,inconnue,<x>,deguesde', BOUTIQUE));
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual([
      { handle: 'horizon', nom: 'Horizon', hex: '#8fa9b8', type: 'peinture', image: null, lien: null },
      { handle: 'deguesde', nom: 'Deguesde', hex: null, type: 'peinture', image: null, lien: null },
    ]);
    expect(shopifyFetch).toHaveBeenCalledWith(expect.objectContaining({
      variables: { h0: 'horizon', h1: 'inconnue', h2: 'deguesde' },
    }));
    expect(reponse.headers.get('Access-Control-Allow-Origin')).toBe(BOUTIQUE);
    expect(reponse.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(reponse.headers.get('Vary')).toBe('Origin');
  });

  it('refuse une autre origine sans interroger la boutique', async () => {
    const reponse = await GET(requete('horizon', 'https://evil.example'));
    expect(reponse.status).toBe(403);
    expect(reponse.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(shopifyFetch).not.toHaveBeenCalled();
    expect((await OPTIONS(requete('horizon', 'https://evil.example'))).status).toBe(403);
  });

  it('accepte l’origine de l’app (labo) et les requêtes sans Origin', async () => {
    shopifyFetch.mockResolvedValue({ data: { t0: { handle: 'horizon', title: 'Horizon', hex: null } } });
    expect((await GET(requete('horizon', APP))).headers.get('Access-Control-Allow-Origin')).toBe(APP);
    const sansOrigine = await GET(requete('horizon'));
    expect(sansOrigine.status).toBe(200);
    expect(sansOrigine.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('aucun handle valide : liste vide sans appel à la boutique', async () => {
    const reponse = await GET(requete('<x>,', BOUTIQUE));
    expect(await reponse.json()).toEqual([]);
    expect(shopifyFetch).not.toHaveBeenCalled();
  });

  it('catalogue indisponible : 502, liste vide, pas de cache', async () => {
    shopifyFetch.mockRejectedValue(new Error('panne'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reponse = await GET(requete('horizon', BOUTIQUE));
    expect(reponse.status).toBe(502);
    expect(await reponse.json()).toEqual([]);
    expect(reponse.headers.get('Cache-Control')).toBe('no-store');
  });
});

/** Variante « Lé » telle que renvoyée par l'Admin API (données réelles du 21/10/2026) */
const VARIANTE_MONTGOLFIERE = {
  id: 'gid://shopify/ProductVariant/57106064965977',
  legacyResourceId: '57106064965977',
  sku: 'pp-montg-terracotta-le',
  selectedOptions: [
    { name: 'Couleur', value: 'Terracotta' },
    { name: 'Taille', value: 'Lé : 60x280cm' },
  ],
  image: { url: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/mockup_bebe_-_motif_1_-_terracotta.png' },
  product: {
    handle: 'papier-peint-montgolfiere',
    title: 'Montgolfières - Papier peint écologique enfant',
    productType: 'Papier peint',
    featuredImage: null,
  },
};

const REFERENCE_MONTGOLFIERE = {
  handle: 'pp-montg-terracotta-le',
  nom: 'Montgolfières Terracotta',
  hex: null,
  type: 'papier-peint',
  image: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/mockup_bebe_-_motif_1_-_terracotta.png',
  lien: 'https://www.colibripeinture.com/products/papier-peint-montgolfiere?variant=57106064965977',
};

describe('GET /api/embed/teintes — papiers peints', () => {
  beforeEach(() => {
    shopifyFetch.mockReset();
    callAdminAPI.mockReset();
  });

  it('référence teinte seule : type peinture, sans appel Admin', async () => {
    shopifyFetch.mockResolvedValue({ data: { t0: { handle: 'horizon', title: 'Horizon - Peinture', hex: { value: '#8FA9B8' } } } });
    const reponse = await GET(requete('horizon', BOUTIQUE));
    expect(await reponse.json()).toEqual([
      { handle: 'horizon', nom: 'Horizon', hex: '#8fa9b8', type: 'peinture', image: null, lien: null },
    ]);
    expect(callAdminAPI).not.toHaveBeenCalled();
  });

  it('référence papier peint : type, image, lien de la variante, hex null', async () => {
    shopifyFetch.mockResolvedValue({ data: { t0: null } });
    callAdminAPI.mockResolvedValue({ v0: { nodes: [VARIANTE_MONTGOLFIERE] } });
    const reponse = await GET(requete('pp-montg-terracotta-le', BOUTIQUE));
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual([REFERENCE_MONTGOLFIERE]);
    const [, variables] = callAdminAPI.mock.calls[0];
    expect(variables).toEqual({ q0: 'sku:"pp-montg-terracotta-le"' });
    expect(reponse.headers.get('Cache-Control')).toBe('public, max-age=300');
  });

  it('référence inconnue (ni teinte ni papier peint) : absente', async () => {
    shopifyFetch.mockResolvedValue({ data: { t0: null } });
    // La recherche Admin est permissive : un SKU voisin n'est pas retenu
    callAdminAPI.mockResolvedValue({ v0: { nodes: [{ ...VARIANTE_MONTGOLFIERE, sku: 'pp-montg-terracotta-ech' }] } });
    const reponse = await GET(requete('pp-montg-terracotta', BOUTIQUE));
    expect(await reponse.json()).toEqual([]);
  });

  it('mélange : ordre demandé, teintes et papiers peints, inconnue absente, Admin interrogé pour les seules non-teintes', async () => {
    shopifyFetch.mockResolvedValue({
      data: {
        t0: { handle: 'horizon', title: 'Horizon - Peinture', hex: { value: '#8fa9b8' } },
        t1: null,
        t2: null,
        t3: { handle: 'deguesde', title: 'Deguesde - Peinture', hex: null },
      },
    });
    callAdminAPI.mockResolvedValue({ v0: { nodes: [VARIANTE_MONTGOLFIERE] }, v1: { nodes: [] } });
    const reponse = await GET(requete('horizon,pp-montg-terracotta-le,inconnue,deguesde', BOUTIQUE));
    expect((await reponse.json()).map((r: { handle: string; type: string }) => `${r.type}:${r.handle}`)).toEqual([
      'peinture:horizon',
      'papier-peint:pp-montg-terracotta-le',
      'peinture:deguesde',
    ]);
    const [, variables] = callAdminAPI.mock.calls[0];
    expect(variables).toEqual({ q0: 'sku:"pp-montg-terracotta-le"', q1: 'sku:"inconnue"' });
  });

  it('un produit qui n’est pas un papier peint n’est pas retenu', async () => {
    shopifyFetch.mockResolvedValue({ data: { t0: null } });
    callAdminAPI.mockResolvedValue({
      v0: { nodes: [{ ...VARIANTE_MONTGOLFIERE, product: { ...VARIANTE_MONTGOLFIERE.product, productType: 'Peinture' } }] },
    });
    expect(await (await GET(requete('pp-montg-terracotta-le', BOUTIQUE))).json()).toEqual([]);
  });

  it('Admin indisponible : teintes renvoyées sans les papiers peints, sans cache', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    shopifyFetch.mockResolvedValue({ data: { t0: { handle: 'horizon', title: 'Horizon', hex: null }, t1: null } });
    callAdminAPI.mockRejectedValue(new Error('panne'));
    const reponse = await GET(requete('horizon,pp-montg-terracotta-le', BOUTIQUE));
    expect(reponse.status).toBe(200);
    expect((await reponse.json()).map((r: { handle: string }) => r.handle)).toEqual(['horizon']);
    expect(reponse.headers.get('Cache-Control')).toBe('no-store');
  });
});
