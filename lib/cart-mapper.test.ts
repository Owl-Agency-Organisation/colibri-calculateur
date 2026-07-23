import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapCalculToCartLines, type ShopifyProductData } from './cart-mapper';
import { KIT_HANDLES, type ResultatCalcul } from './calcul';
import type { Couleur } from './types';

// ==================== HELPERS ====================

const couleurBlancMat: Couleur = {
  productId: 'gid://shopify/Product/1',
  productHandle: 'peinture-blanc-schmidt',
  titre: 'Blanc Schmidt',
  collection: 'Les Blancs',
  base: 'Blanc',
  sousCouche: 'blanche',
  codeHex: '#FFFFFF',
  finition: 'Mate',
  imageUrl: '',
};

function produit(
  handle: string,
  variants: Array<{ id: string; title: string; amount: string }>
): ShopifyProductData {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    title: handle,
    variants: variants.map(v => ({
      id: v.id,
      title: v.title,
      sku: '',
      price: { amount: v.amount, currencyCode: 'EUR' },
      availableForSale: true,
    })),
  };
}

function resultatAvecKit(kitHandle: string): ResultatCalcul {
  return {
    peintures: [],
    sousCouches: [],
    kit: { type: 'petite', handle: kitHandle, titre: 'Kit matériel', prix: 24.9 },
    surfaceTotale: 25,
    resume: {
      nombrePieces: 1,
      nombreCouleurs: 1,
      surfaceMurs: 25,
      surfacePlafonds: 0,
      surfaceBoiseries: 0,
    },
  };
}

const optionsKitSeul = { sousCouche: false, kit: true, renovation: false };

// ==================== KIT TOUT-OU-RIEN ====================

describe('mapCalculToCartLines — kit tout-ou-rien', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produit UNE seule ligne au variant du bundle, quantité 1', () => {
    const shopifyData = {
      [KIT_HANDLES.petiteSurface]: produit(KIT_HANDLES.petiteSurface, [
        { id: 'gid://shopify/ProductVariant/100', title: 'Default Title', amount: '24.90' },
      ]),
    };

    const lines = mapCalculToCartLines(
      resultatAvecKit(KIT_HANDLES.petiteSurface),
      shopifyData,
      optionsKitSeul
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].merchandiseId).toBe('gid://shopify/ProductVariant/100');
    expect(lines[0].quantity).toBe(1);
    expect(lines[0].attributes).toContainEqual({ key: '_type', value: 'kit' });
  });

  it('SIGNALE un kit à plusieurs variants (verrou partagé avec le calcul du prix)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shopifyData = {
      [KIT_HANDLES.petiteSurface]: produit(KIT_HANDLES.petiteSurface, [
        { id: 'gid://shopify/ProductVariant/100', title: 'Standard', amount: '24.90' },
        { id: 'gid://shopify/ProductVariant/101', title: 'Grand format', amount: '49.90' },
      ]),
    };

    const lines = mapCalculToCartLines(
      resultatAvecKit(KIT_HANDLES.petiteSurface),
      shopifyData,
      optionsKitSeul
    );

    // Une seule ligne quand même (premier variant), mais l'anomalie est loggée
    expect(lines).toHaveLength(1);
    expect(lines[0].merchandiseId).toBe('gid://shopify/ProductVariant/100');
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0][0])).toContain('variants');
  });

  it("n'ajoute aucune ligne si le kit est introuvable ou l'option décochée", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      mapCalculToCartLines(resultatAvecKit(KIT_HANDLES.petiteSurface), {}, optionsKitSeul)
    ).toHaveLength(0);
    expect(spy).toHaveBeenCalled();

    const shopifyData = {
      [KIT_HANDLES.petiteSurface]: produit(KIT_HANDLES.petiteSurface, [
        { id: 'gid://shopify/ProductVariant/100', title: 'Default Title', amount: '24.90' },
      ]),
    };
    expect(
      mapCalculToCartLines(resultatAvecKit(KIT_HANDLES.petiteSurface), shopifyData, {
        ...optionsKitSeul,
        kit: false,
      })
    ).toHaveLength(0);
  });
});

// ==================== VERROU DE GAMME CÔTÉ PANIER ====================

describe('mapCalculToCartLines — verrou de gamme sur les peintures', () => {
  it('envoie au panier le variant Biosourcée standard, jamais la Dépolluante', () => {
    const resultat: ResultatCalcul = {
      peintures: [
        {
          couleur: couleurBlancMat,
          surfaceTotale: 10,
          litresNecessaires: 2,
          litresCommandes: 3,
          contenants: [{ contenance: '3L', quantite: 1, litres: 3 }],
          prixTotal: 92.68,
        },
      ],
      sousCouches: [],
      kit: { type: 'petite', handle: KIT_HANDLES.petiteSurface, titre: 'Kit', prix: 0 },
      surfaceTotale: 10,
      resume: { nombrePieces: 1, nombreCouleurs: 1, surfaceMurs: 10, surfacePlafonds: 0, surfaceBoiseries: 0 },
    };

    // La Dépolluante arrive EN PREMIER dans l'ordre API : elle ne doit pas gagner
    const shopifyData = {
      [couleurBlancMat.productHandle]: produit(couleurBlancMat.productHandle, [
        { id: 'gid://shopify/ProductVariant/201', title: 'Biosourcée dépolluante / 3L / Mate', amount: '107.65' },
        { id: 'gid://shopify/ProductVariant/200', title: 'Biosourcée / 3L / Mate', amount: '92.68' },
      ]),
    };

    const lines = mapCalculToCartLines(resultat, shopifyData, {
      sousCouche: false,
      kit: false,
      renovation: false,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].merchandiseId).toBe('gid://shopify/ProductVariant/200');
  });
});
