import { beforeEach, describe, expect, it, vi } from 'vitest';

const shopifyFetch = vi.fn();
vi.mock('@/lib/shopify', () => ({ shopifyFetch: (...args: unknown[]) => shopifyFetch(...args) }));

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
      { handle: 'horizon', nom: 'Horizon', hex: '#8fa9b8' },
      { handle: 'deguesde', nom: 'Deguesde', hex: null },
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
