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
    '%i m² (11 L) : le garde-fou pots retient 4×3L (un pot de moins, écart +4,8 %% < 5 %%)',
    (surface) => {
      // Conséquence documentée de la tolérance 5 % : 4×3L (391,60 €, 4 pots)
      // remplace 3×3L + 2×1L (373,50 €, 5 pots). L'empilement de 3L reste la
      // règle (jamais de 12L inventé), avec justification affichée.
      const litres = calculerLitresNecessaires(surface, 2);
      const { contenants, justification } = optimiserContenantsParPrix(
        litres,
        ['3L', '1L'],
        VARIANTS_SANS_12L,
        'Mate'
      );
      expect(contenants).toEqual([{ contenance: '3L', quantite: 4, litres: 12 }]);
      expect(justification).toContain('nombre de pots');
    }
  );
});

// ==================== DÉPARTAGE ET TOLÉRANCE ====================

describe('optimiserContenantsParPrix — départage et garde-fou pots', () => {
  it('à prix égal, moins de pots gagne (1×12L face à 3×3L)', () => {
    const variants = [variant('3L / Mate', '30.00'), variant('12L / Mate', '90.00')];
    const { contenants, justification } = optimiserContenantsParPrix(9, TOUTES, variants, 'Mate');
    expect(contenants).toEqual([{ contenance: '12L', quantite: 1, litres: 12 }]);
    expect(justification).toContain('même prix');
  });

  it('à prix et pots comparables, moins cher puis moindre excès départagent', () => {
    // Besoin 4 L, 1L=10 €, 3L=30 € : 4×1L (40 €, 4 pots) vs 3L+1L (40 €, 2 pots)
    // → même prix, moins de pots : 3L+1L
    const variants = [variant('1L / Mate', '10.00'), variant('3L / Mate', '30.00')];
    const { contenants } = optimiserContenantsParPrix(4, ['3L', '1L'], variants, 'Mate');
    expect(contenants).toEqual([
      { contenance: '3L', quantite: 1, litres: 3 },
      { contenance: '1L', quantite: 1, litres: 1 },
    ]);
  });

  it('GARDE-FOU : à moins de 5 % d\'écart, la composition avec le moins de pots gagne', () => {
    // Promo absurde : 1L à 10 € → 11×1L = 110 € optimal ; 12L à 115 € (+4,5 %)
    // → le 12L (1 pot) est préféré aux 11 pots
    const variants = [
      variant('1L / Mate', '10.00'),
      variant('3L / Mate', '38.00'),
      variant('12L / Mate', '115.00'),
    ];
    const { contenants, justification } = optimiserContenantsParPrix(11, TOUTES, variants, 'Mate');
    expect(contenants).toEqual([{ contenance: '12L', quantite: 1, litres: 12 }]);
    expect(justification).toBeDefined();
  });

  it('au-delà de 5 % d\'écart, le vrai optimum est conservé même avec plus de pots', () => {
    // 12L à 116 € = +5,45 % au-dessus de 11×1L (110 €) → hors fenêtre
    const variants = [variant('1L / Mate', '10.00'), variant('12L / Mate', '116.00')];
    const { contenants } = optimiserContenantsParPrix(11, ['12L', '1L'], variants, 'Mate');
    expect(contenants).toEqual([{ contenance: '1L', quantite: 11, litres: 11 }]);
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
  it('couvre toujours au moins le besoin et ne coûte jamais plus de 105 % du glouton', () => {
    const jeux = [VARIANTS_AIR, VARIANTS_SANS_12L, [variant('1L / Mate', '10.00'), variant('12L / Mate', '95.00')]];
    for (const variants of jeux) {
      // Contenances dérivées des variants, comme dans calculerQuantites
      const contenances = extraireContenancesDisponibles(variants);
      for (let litres = 1; litres <= 40; litres++) {
        const { contenants } = optimiserContenantsParPrix(litres, contenances, variants, 'Mate');
        expect(calculerLitresCommandes(contenants)).toBeGreaterThanOrEqual(litres);
        const coutNouveau = coutAvec(contenants, variants);
        const coutGlouton = coutAvec(optimiserContenants(litres, contenances), variants);
        expect(coutNouveau).toBeLessThanOrEqual(coutGlouton * 1.05 + 0.001);
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
