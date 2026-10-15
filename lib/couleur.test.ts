import { afterEach, describe, expect, it, vi } from 'vitest';
import { chargerCouleur, chargerCouleurs, choisirFinition, construireCouleur, type DetailProduit } from '@/lib/couleur';

const variante = (id: string, finition: string | null) => ({
  id,
  title: finition ?? 'Défaut',
  sku: id,
  price: { amount: '30.00', currencyCode: 'EUR' },
  availableForSale: true,
  selectedOptions: [
    { name: 'Contenance', value: '3L' },
    ...(finition ? [{ name: 'Finition', value: finition }] : []),
  ],
});

const detail: DetailProduit = {
  id: 'gid://shopify/Product/1',
  handle: 'bleu-ciel',
  title: 'Bleu Ciel - Peinture biosourcée murs et plafonds',
  images: { edges: [{ node: { url: 'https://cdn.shopify.com/bleu.jpg' } }] },
  variants: [variante('v1', 'Mate'), variante('v2', 'Velours'), variante('v3', 'Satin')],
  base: 'C',
  sousCouche: 'grise',
  codeHex: '#88AACC',
};

describe('choisirFinition', () => {
  it('retient la variante de la finition cible (insensible à la casse)', () => {
    expect(choisirFinition(detail.variants, 'Velours')).toBe('Velours');
    expect(choisirFinition(detail.variants, 'satin')).toBe('Satin');
  });

  it('à défaut, prend la finition de la première variante qui en porte une', () => {
    expect(choisirFinition([variante('v0', null), variante('v1', 'Velours')], 'Mate')).toBe('Velours');
    expect(choisirFinition(detail.variants, undefined)).toBe('Mate');
  });

  it('sans variante ou sans option Finition : aucune finition', () => {
    expect(choisirFinition([], 'Mate')).toBeUndefined();
    expect(choisirFinition(undefined, 'Mate')).toBeUndefined();
    expect(choisirFinition([variante('v0', null)], 'Mate')).toBeUndefined();
  });
});

describe('construireCouleur', () => {
  it('construit la Couleur depuis un handle chargé et la finition cible', () => {
    expect(construireCouleur(detail, { targetFinition: 'Velours' })).toEqual({
      productId: 'gid://shopify/Product/1',
      productHandle: 'bleu-ciel',
      titre: 'Bleu Ciel - Peinture biosourcée murs et plafonds',
      collection: '',
      base: 'C',
      sousCouche: 'grise',
      codeHex: '#88AACC',
      finition: 'Velours',
      imageUrl: 'https://cdn.shopify.com/bleu.jpg',
      variants: detail.variants,
    });
  });

  it('même teinte, finitions cibles différentes → finitions différentes', () => {
    const murs = construireCouleur(detail, { targetFinition: 'Satin' });
    const plafond = construireCouleur(detail, { targetFinition: 'Mate' });
    expect(murs.finition).toBe('Satin');
    expect(plafond.finition).toBe('Mate');
  });

  it('garde l’identité du produit choisi dans la popup et sa collection', () => {
    const couleur = construireCouleur(detail, {
      targetFinition: 'Mate',
      collection: 'Les Bleus',
      produit: { id: 'p-liste', handle: 'bleu-ciel', title: 'Bleu Ciel', imageUrl: 'https://cdn.shopify.com/liste.jpg' },
    });
    expect(couleur.productId).toBe('p-liste');
    expect(couleur.titre).toBe('Bleu Ciel');
    expect(couleur.imageUrl).toBe('https://cdn.shopify.com/liste.jpg');
    expect(couleur.collection).toBe('Les Bleus');
  });

  it('applique les valeurs par défaut historiques', () => {
    const couleur = construireCouleur(
      { id: 'p', handle: 'blanc', title: 'Blanc', base: null, sousCouche: null, codeHex: null },
      {},
    );
    expect(couleur.base).toBe('Blanc');
    expect(couleur.sousCouche).toBe('blanche');
    expect(couleur.codeHex).toBe('#FFFFFF');
    expect(couleur.imageUrl).toBe('');
    expect(couleur.variants).toEqual([]);
    expect(couleur.finition).toBeUndefined();
  });

  it('normalise la casse de la base sans changer le type de sous-couche', () => {
    expect(construireCouleur({ ...detail, base: 'c' }, {}).base).toBe('C');
    expect(construireCouleur({ ...detail, base: 'inconnue' }, {}).base).toBe('Blanc');
  });
});

describe('chargerCouleur', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ignore un handle inconnu de la boutique et le signale en console', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"Product not found"}', { status: 404 })));
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(chargerCouleur('inconnue')).resolves.toBeNull();
    expect(avertissement).toHaveBeenCalledWith(expect.stringContaining('inconnue'));
  });

  it('charge plusieurs teintes dans l’ordre en écartant les inconnues', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/inconnue')) return new Response('{}', { status: 404 });
      const handle = url.split('/').pop() ?? '';
      return new Response(JSON.stringify({ ...detail, handle, id: handle }), { status: 200 });
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const couleurs = await chargerCouleurs(['vert', 'inconnue', 'bleu'], { targetFinition: 'Satin' });
    expect(couleurs.map((c) => c.productHandle)).toEqual(['vert', 'bleu']);
    expect(couleurs.every((c) => c.finition === 'Satin')).toBe(true);
  });
});
