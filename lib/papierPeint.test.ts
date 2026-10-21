import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chargerPapierPeint,
  chargerPapiersPeints,
  estTypePapierPeint,
  libellePapierPeint,
  lienFichePapierPeint,
  requetePapiersPeints,
  versPapierPeint,
  type VariantePapierPeintAdmin,
} from '@/lib/papierPeint';
import { MONTGOLFIERE_TERRACOTTA, stubRoutesBoutique } from '@/lib/test/simulateurFixtures';

const variante: VariantePapierPeintAdmin = {
  id: 'gid://shopify/ProductVariant/57166674919769',
  legacyResourceId: '57166674919769',
  sku: 'pp-rayur-bleu-le',
  selectedOptions: [
    { name: 'Couleur', value: 'Rayures bleues' },
    { name: 'Taille', value: 'Lé : 60x280cm' },
  ],
  image: { url: 'https://cdn.shopify.com/mockup_salon_4_-_motif_2_-_bleu.png' },
  product: {
    handle: 'rayures-papier-peint-ecologique',
    title: 'Rayures - Papier peint écologique',
    productType: 'Papier peint',
    featuredImage: { url: 'https://cdn.shopify.com/Fichier_49.png' },
  },
};

describe('papier peint — logique pure', () => {
  it('reconnaît le productType « Papier peint »', () => {
    expect(estTypePapierPeint('Papier peint')).toBe(true);
    expect(estTypePapierPeint('papiers peints')).toBe(true);
    expect(estTypePapierPeint('Matériel Papier peint')).toBe(false);
    expect(estTypePapierPeint('Peinture')).toBe(false);
    expect(estTypePapierPeint(null)).toBe(false);
  });

  it('construit le papier peint d’une variante « Lé » : motif, coloris, image, fiche', () => {
    expect(versPapierPeint('pp-rayur-bleu-le', variante)).toEqual({
      sku: 'pp-rayur-bleu-le',
      handle: 'rayures-papier-peint-ecologique',
      titre: 'Rayures - Papier peint écologique',
      motif: 'Rayures',
      coloris: 'Rayures bleues',
      imageUrl: 'https://cdn.shopify.com/mockup_salon_4_-_motif_2_-_bleu.png',
      variantId: 'gid://shopify/ProductVariant/57166674919769',
      lien: 'https://www.colibripeinture.com/products/rayures-papier-peint-ecologique?variant=57166674919769',
    });
  });

  it('à défaut d’image de variante, prend l’image du produit', () => {
    expect(versPapierPeint('pp-rayur-bleu-le', { ...variante, image: null })?.imageUrl).toBe('https://cdn.shopify.com/Fichier_49.png');
  });

  it('écarte un SKU voisin, une variante absente ou un produit qui n’est pas un papier peint', () => {
    expect(versPapierPeint('pp-rayur-bleu', variante)).toBeNull();
    expect(versPapierPeint('pp-rayur-bleu-le', null)).toBeNull();
    expect(versPapierPeint('pp-rayur-bleu-le', { ...variante, product: { ...variante.product, productType: 'Peinture' } })).toBeNull();
  });

  it('libellé sans répéter le motif', () => {
    expect(libellePapierPeint('Montgolfières', 'Terracotta')).toBe('Montgolfières, Terracotta');
    expect(libellePapierPeint('Montgolfières', 'Terracotta', ' ')).toBe('Montgolfières Terracotta');
    expect(libellePapierPeint('Rayures', 'Rayures bleues')).toBe('Rayures bleues');
    expect(libellePapierPeint('Ombrelle', 'Ombrelle bleu nuit', ' - ')).toBe('Ombrelle bleu nuit');
    expect(libellePapierPeint('Rayures', '')).toBe('Rayures');
  });

  it('fiche boutique sur la variante', () => {
    expect(lienFichePapierPeint('papier-peint-montgolfiere', '57106064965977'))
      .toBe('https://www.colibripeinture.com/products/papier-peint-montgolfiere?variant=57106064965977');
  });

  it('requête Admin : un alias par SKU, valeurs en variables, aucun prix', () => {
    const requete = requetePapiersPeints(2);
    expect(requete).toContain('query PapiersPeints($q0: String!, $q1: String!)');
    expect(requete).toContain('v1: productVariants(first: 5, query: $q1)');
    expect(requete).not.toMatch(/price/i);
  });
});

describe('chargerPapierPeint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('charge un papier peint par la route de l’app ; inconnu ignoré et signalé', async () => {
    stubRoutesBoutique([], [MONTGOLFIERE_TERRACOTTA]);
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(chargerPapierPeint('pp-montg-terracotta-le')).resolves.toEqual(MONTGOLFIERE_TERRACOTTA);
    await expect(chargerPapierPeint('pp-inconnu-le')).resolves.toBeNull();
    expect(avertissement).toHaveBeenCalledWith(expect.stringContaining('pp-inconnu-le'));
    expect(await chargerPapiersPeints(['pp-inconnu-le', 'pp-montg-terracotta-le'])).toEqual([MONTGOLFIERE_TERRACOTTA]);
  });

  it('référence invalide : aucun appel', async () => {
    const appels = stubRoutesBoutique([], []);
    await expect(chargerPapierPeint('../x')).resolves.toBeNull();
    expect(appels).toEqual([]);
  });
});
