import { describe, expect, it } from 'vitest';
import {
  calculerLitresCommandes,
  calculerLitresNecessaires,
  calculerPrixTotal,
  extraireContenancesDisponibles,
  optimiserContenants,
  optimiserContenantsParPrix,
  selectionnerVariantContenance,
  KIT_HANDLES,
  type ResultatCalcul,
} from './index';
import { mapCalculToCartLines, type ShopifyProductData } from '../cart-mapper';
import type { Couleur } from '../types';

// ==================== HELPERS ====================

const variant = (title: string, amount: string, id = `var-${title}`) => ({
  id,
  title,
  price: { amount },
});

// Jeu de prix type "Air" : le 12L est nettement plus avantageux au litre
const VARIANTS_AIR = [
  variant('1L / Mate', '39.90'),
  variant('3L / Mate', '97.90'),
  variant('12L / Mate', '249.90'),
];

// Couleur type "Silence" : pas de 12L
const VARIANTS_SANS_12L = [variant('1L / Mate', '39.90'), variant('3L / Mate', '97.90')];

const TOUTES: ('1L' | '3L' | '12L')[] = ['12L', '3L', '1L'];

const coutAvec = (contenants: ReturnType<typeof optimiserContenants>, variants: any[]) =>
  calculerPrixTotal(contenants, variants, 'Mate');

// ==================== CAS NOMINAL : LE 12L GAGNE ====================

describe('optimiserContenantsParPrix — le 12L est retenu quand il est moins cher', () => {
  // 45 / 48 / 50 / 52 m² → 9 / 10 / 11 / 11 L (2 couches, marge 5%)
  it.each([
    [45, 9],
    [48, 10],
    [50, 11],
    [52, 11],
  ])('%i m² (%i L) : 1×12L retenu, total inférieur à l\'ancienne composition', (surface, litresAttendus) => {
    const litres = calculerLitresNecessaires(surface, 2);
    expect(litres).toBe(litresAttendus);

    const ancien = optimiserContenants(litres, TOUTES);
    const { contenants, justification } = optimiserContenantsParPrix(litres, TOUTES, VARIANTS_AIR, 'Mate');

    expect(contenants).toEqual([{ contenance: '12L', quantite: 1, litres: 12 }]);
    expect(coutAvec(contenants, VARIANTS_AIR)).toBeLessThan(coutAvec(ancien, VARIANTS_AIR));
    // Composition au-delà du besoin → justification affichée
    expect(justification).toContain('12 L');
    expect(justification).toContain('moins cher');
  });

  it('ne sur-provisionne pas quand le petit format reste le moins cher (5 L)', () => {
    // 5 L : 1×3L + 2×1L = 177,70 € bat 2×3L (195,80) et 12L (249,90)
    const { contenants, justification } = optimiserContenantsParPrix(5, TOUTES, VARIANTS_AIR, 'Mate');
    expect(contenants).toEqual([
      { contenance: '3L', quantite: 1, litres: 3 },
      { contenance: '1L', quantite: 2, litres: 2 },
    ]);
    // Identique au glouton → pas de justification
    expect(justification).toBeUndefined();
  });

  it('reste inchangé quand le glouton retenait déjà le 12L (55 m² → 12 L)', () => {
    const litres = calculerLitresNecessaires(55, 2); // 11,55 → 12 L
    const ancien = optimiserContenants(litres, TOUTES);
    const { contenants, justification } = optimiserContenantsParPrix(litres, TOUTES, VARIANTS_AIR, 'Mate');
    expect(contenants).toEqual(ancien);
    expect(justification).toBeUndefined();
  });
});

// ==================== CONTENANCE MANQUANTE ====================

describe('optimiserContenantsParPrix — couleur sans 12L (Silence)', () => {
  it.each([45, 48])('%i m² : empilement de 3L, composition strictement inchangée', (surface) => {
    const litres = calculerLitresNecessaires(surface, 2);
    const contenances: ('1L' | '3L')[] = ['3L', '1L'];
    const ancien = optimiserContenants(litres, contenances);
    const { contenants } = optimiserContenantsParPrix(litres, contenances, VARIANTS_SANS_12L, 'Mate');
    expect(contenants).toEqual(ancien);
  });

  it.each([50, 52])(
    '%i m² (11 L) : 3×3L + 2×1L conservé (2×1L sous le plafond), comportement inchangé',
    (surface) => {
      // Le plafond (3 pots max du plus petit format) n'écarte pas 2×1L : la
      // composition la moins chère reste celle du glouton historique.
      const litres = calculerLitresNecessaires(surface, 2);
      const { contenants, justification } = optimiserContenantsParPrix(
        litres,
        ['3L', '1L'],
        VARIANTS_SANS_12L,
        'Mate'
      );
      expect(contenants).toEqual(optimiserContenants(litres, ['3L', '1L']));
      expect(justification).toBeUndefined();
    }
  );
});

// ==================== DÉPARTAGE ET TOLÉRANCE ====================

describe('optimiserContenantsParPrix — départage et plafond pots', () => {
  it('à prix égal, le moindre excès de litres gagne (3×3L face à 1×12L)', () => {
    const variants = [variant('3L / Mate', '30.00'), variant('12L / Mate', '90.00')];
    const { contenants, justification } = optimiserContenantsParPrix(9, TOUTES, variants, 'Mate');
    expect(contenants).toEqual([{ contenance: '3L', quantite: 3, litres: 9 }]);
    // Composition = glouton → aucune mention
    expect(justification).toBeUndefined();
  });

  it('à prix et excès égaux, moins de contenants départage (3L+1L face à 4×1L)', () => {
    // Besoin 4 L, 1L=10 €, 3L=30 € : 4×1L (40 €, 4 pots, écarté aussi par le
    // plafond) vs 3L+1L (40 €, 2 pots) → 3L+1L
    const variants = [variant('1L / Mate', '10.00'), variant('3L / Mate', '30.00')];
    const { contenants } = optimiserContenantsParPrix(4, ['3L', '1L'], variants, 'Mate');
    expect(contenants).toEqual([
      { contenance: '3L', quantite: 1, litres: 3 },
      { contenance: '1L', quantite: 1, litres: 1 },
    ]);
  });

  it('PLAFOND : une composition à 11×1L est écartée même si elle est la moins chère', () => {
    // Promo absurde : 1L à 10 € → 11×1L = 110 € optimal mais 11 pots > plafond
    // de 3 → écartée. La moins chère des compositions valides est retenue :
    // 12L à 115 € (< 3×3L + 2×1L à 134 €), et la mention est légitime
    // (réellement moins cher que le glouton 3×3L + 2×1L).
    const variants = [
      variant('1L / Mate', '10.00'),
      variant('3L / Mate', '38.00'),
      variant('12L / Mate', '115.00'),
    ];
    const { contenants, justification } = optimiserContenantsParPrix(11, TOUTES, variants, 'Mate');
    expect(contenants).toEqual([{ contenance: '12L', quantite: 1, litres: 12 }]);
    expect(justification).toContain('moins cher');
  });

  it('AUCUNE mention 💡 quand le choix est dicté par le plafond et coûte plus cher', () => {
    // Sans 3L : glouton = 11×1L (110 €), écarté par le plafond → 12L à 116 €
    // retenu. Il coûte PLUS cher que le glouton : la mention « revient moins
    // cher » serait mensongère → aucune justification affichée.
    const variants = [variant('1L / Mate', '10.00'), variant('12L / Mate', '116.00')];
    const { contenants, justification } = optimiserContenantsParPrix(11, ['12L', '1L'], variants, 'Mate');
    expect(contenants).toEqual([{ contenance: '12L', quantite: 1, litres: 12 }]);
    expect(justification).toBeUndefined();
  });

  it('repli ultime : produit mono-format 1L sur un gros besoin, le plafond est levé', () => {
    // Toutes les compositions dépassent le plafond (seul le 1L existe) :
    // mieux vaut 5×1L qu'un échec — le plafond est ignoré dans ce cas limite.
    const variants = [variant('1L / Mate', '10.00')];
    const { contenants } = optimiserContenantsParPrix(5, ['1L'], variants, 'Mate');
    expect(contenants).toEqual([{ contenance: '1L', quantite: 5, litres: 5 }]);
  });
});

// ==================== REPLI GLOUTON ====================

describe('optimiserContenantsParPrix — repli sans prix', () => {
  it.each([[3], [9], [11], [17], [25]])(
    'sans variants (%i L) : sortie strictement identique au glouton',
    (litres) => {
      const { contenants, justification } = optimiserContenantsParPrix(litres, TOUTES, []);
      expect(contenants).toEqual(optimiserContenants(litres, TOUTES));
      expect(justification).toBeUndefined();
    }
  );

  it('sans prix exploitable pour la finition ni la contenance : repli glouton', () => {
    const variants = [variant('Format spécial', '0')];
    const { contenants } = optimiserContenantsParPrix(9, TOUTES, variants, 'Mate');
    expect(contenants).toEqual(optimiserContenants(9, TOUTES));
  });

  it('litrage nul : liste vide, comme le glouton', () => {
    expect(optimiserContenantsParPrix(0, TOUTES, VARIANTS_AIR, 'Mate').contenants).toEqual([]);
  });
});

// ==================== PROPRIÉTÉS ====================

describe('optimiserContenantsParPrix — propriétés invariantes', () => {
  // Énumérateur de référence indépendant : coût minimal (en centimes) parmi
  // TOUTES les compositions couvrant le besoin et respectant le plafond de
  // 3 pots du plus petit format disponible.
  function meilleurCoutSousPlafond(
    litres: number,
    variants: Array<{ title: string; price: { amount: string } }>
  ): number {
    const tailles: Record<string, number> = { '1L': 1, '3L': 3, '12L': 12 };
    const formats = extraireContenancesDisponibles(variants)
      .map((c) => ({
        contenance: c,
        taille: tailles[c],
        prix: Math.round(
          parseFloat(selectionnerVariantContenance(variants, c, 'Mate')!.price.amount) * 100
        ),
      }))
      .sort((a, b) => b.taille - a.taille);
    const plusPetit = formats[formats.length - 1].contenance;
    const tMax = litres + formats[0].taille;

    let meilleur = Number.POSITIVE_INFINITY;
    const explorer = (index: number, totalLitres: number, cout: number, potsPetit: number) => {
      if (index === formats.length) {
        if (totalLitres >= litres && potsPetit <= 3) meilleur = Math.min(meilleur, cout);
        return;
      }
      const f = formats[index];
      for (let q = 0; q * f.taille + totalLitres <= tMax; q++) {
        explorer(
          index + 1,
          totalLitres + q * f.taille,
          cout + q * f.prix,
          f.contenance === plusPetit ? potsPetit + q : potsPetit
        );
      }
    };
    explorer(0, 0, 0, 0);
    return meilleur;
  }

  it('couvre toujours le besoin et atteint le coût de la meilleure composition sous plafond', () => {
    const jeux = [VARIANTS_AIR, VARIANTS_SANS_12L, [variant('1L / Mate', '10.00'), variant('12L / Mate', '95.00')]];
    for (const variants of jeux) {
      // Contenances dérivées des variants, comme dans calculerQuantites
      const contenances = extraireContenancesDisponibles(variants);
      for (let litres = 1; litres <= 40; litres++) {
        const { contenants } = optimiserContenantsParPrix(litres, contenances, variants, 'Mate');
        expect(calculerLitresCommandes(contenants)).toBeGreaterThanOrEqual(litres);
        // Jamais plus cher que la meilleure composition respectant le plafond
        const coutNouveauCentimes = Math.round(coutAvec(contenants, variants) * 100);
        expect(coutNouveauCentimes).toBe(meilleurCoutSousPlafond(litres, variants));
      }
    }
  });
});

// ==================== ANTI-DIVERGENCE PRIX/PANIER ====================

describe('optimiserContenantsParPrix — la voie de sélection est partagée', () => {
  // Gamme Dépolluante EN PREMIER dans l'ordre API : ni la table de prix de la
  // DP, ni le prix affiché, ni la ligne panier ne doivent la retenir
  const variantsDeuxGammes = [
    variant('Biosourcée dépolluante / 12L / Mate', '300.00', 'gid://shopify/ProductVariant/912'),
    variant('Biosourcée / 12L / Mate', '249.90', 'gid://shopify/ProductVariant/12'),
    variant('Biosourcée dépolluante / 3L / Mate', '120.00', 'gid://shopify/ProductVariant/903'),
    variant('Biosourcée / 3L / Mate', '97.90', 'gid://shopify/ProductVariant/3'),
  ];

  it('la DP optimise sur les prix de la gamme standard (le 12L à 249,90 gagne)', () => {
    // Si la table de prix retenait la Dépolluante (12L à 300 > 3×3L standard à
    // 293,70), la DP garderait les 3L : choisir le 12L prouve le prix standard
    const { contenants } = optimiserContenantsParPrix(9, ['12L', '3L'], variantsDeuxGammes, 'Mate');
    expect(contenants).toEqual([{ contenance: '12L', quantite: 1, litres: 12 }]);
  });

  it('prix affiché = prix qui a guidé la DP = variant mis au panier', () => {
    const { contenants } = optimiserContenantsParPrix(9, ['12L', '3L'], variantsDeuxGammes, 'Mate');

    // Prix affiché : même sélection → 249,90 (jamais 300)
    expect(calculerPrixTotal(contenants, variantsDeuxGammes, 'Mate')).toBe(249.9);
    expect(selectionnerVariantContenance(variantsDeuxGammes, '12L', 'Mate')?.id).toBe(
      'gid://shopify/ProductVariant/12'
    );

    // Ligne panier : même variant standard
    const couleur: Couleur = {
      productId: 'gid://shopify/Product/1',
      productHandle: 'peinture-air',
      titre: 'Air',
      collection: 'Les Blancs',
      base: 'Blanc',
      sousCouche: 'blanche',
      codeHex: '#FFF',
      finition: 'Mate',
      imageUrl: '',
    };
    const resultat: ResultatCalcul = {
      peintures: [
        {
          couleur,
          surfaceTotale: 45,
          litresNecessaires: 9,
          litresCommandes: 12,
          contenants,
          prixTotal: 249.9,
          justification: 'Le format 12 L revient moins cher que 3×3 L.',
        },
      ],
      sousCouches: [],
      kit: { type: 'petite', handle: KIT_HANDLES.petiteSurface, titre: 'Kit', prix: 0 },
      surfaceTotale: 45,
      resume: { nombrePieces: 1, nombreCouleurs: 1, surfaceMurs: 45, surfacePlafonds: 0, surfaceBoiseries: 0 },
    };
    const shopifyData: Record<string, ShopifyProductData> = {
      'peinture-air': {
        id: 'gid://shopify/Product/1',
        handle: 'peinture-air',
        title: 'Air',
        variants: variantsDeuxGammes.map(v => ({
          id: v.id,
          title: v.title,
          sku: '',
          price: { amount: v.price.amount, currencyCode: 'EUR' },
          availableForSale: true,
        })),
      },
    };

    const lines = mapCalculToCartLines(resultat, shopifyData, { sousCouche: false, kit: false, renovation: false });
    expect(lines).toHaveLength(1);
    expect(lines[0].merchandiseId).toBe('gid://shopify/ProductVariant/12');
    // La justification est transportée sur la première ligne
    expect(lines[0].attributes).toContainEqual({
      key: '_justification',
      value: 'Le format 12 L revient moins cher que 3×3 L.',
    });
  });
});
