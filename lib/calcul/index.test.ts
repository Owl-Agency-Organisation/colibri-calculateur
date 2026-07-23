import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  agregerSurfacesParCouleur,
  calculerLitresNecessaires,
  calculerLitresCommandes,
  calculerPrixTotal,
  calculerQuantites,
  determinerTypeSousCouche,
  estVariantGammeStandard,
  extraireContenancesDisponibles,
  optimiserContenants,
  selectionnerVariantGammeStandard,
  selectionnerVariantKit,
  KIT_HANDLES,
} from './index';
import type { Couleur, Piece } from '@/lib/types';

// ==================== HELPERS ====================

function couleur(overrides: Partial<Couleur> = {}): Couleur {
  return {
    productId: 'gid://shopify/Product/1',
    productHandle: 'peinture-blanc-schmidt',
    titre: 'Blanc Schmidt',
    collection: 'Les Blancs',
    base: 'Blanc',
    sousCouche: 'blanche',
    codeHex: '#FFFFFF',
    finition: 'Mate',
    imageUrl: '',
    ...overrides,
  };
}

function piece(overrides: Partial<Piece> = {}): Piece {
  return {
    id: '1',
    typePiece: 'piece-de-vie',
    nom: 'Salon',
    murs: [],
    ...overrides,
  };
}

const variant = (title: string, amount: string, id = `var-${title}`) => ({
  id,
  title,
  price: { amount },
});

// ==================== calculerLitresNecessaires ====================

describe('calculerLitresNecessaires', () => {
  it('applique 2 couches, rendement 10 m²/L et marge 5%, arrondi au litre le plus proche', () => {
    // 10 m² × 2 couches / 10 m²/L = 2 L × 1,05 = 2,1 → 2 L
    expect(calculerLitresNecessaires(10, 2)).toBe(2);
    // 84 m² × 2 / 10 = 16,8 × 1,05 = 17,64 → 18 L
    expect(calculerLitresNecessaires(84, 2)).toBe(18);
    // 30 m² × 2 / 10 = 6 × 1,05 = 6,3 → 6 L
    expect(calculerLitresNecessaires(30, 2)).toBe(6);
  });

  it('gère la sous-couche en 1 couche', () => {
    // 45 m² / 10 = 4,5 × 1,05 = 4,725 → 5 L
    expect(calculerLitresNecessaires(45, 1)).toBe(5);
    // 12 m² / 10 = 1,2 × 1,05 = 1,26 → 1 L
    expect(calculerLitresNecessaires(12, 1)).toBe(1);
  });

  it('arrondit au plus proche (pas systématiquement au supérieur)', () => {
    // 50 m² × 2 / 10 = 10 × 1,05 = 10,5 → 11 (demi arrondi au supérieur)
    expect(calculerLitresNecessaires(50, 2)).toBe(11);
    // 20 m² × 2 / 10 = 4 × 1,05 = 4,2 → 4 (arrondi à l'inférieur)
    expect(calculerLitresNecessaires(20, 2)).toBe(4);
  });

  it('retourne 0 pour une surface nulle', () => {
    expect(calculerLitresNecessaires(0, 2)).toBe(0);
  });
});

// ==================== optimiserContenants ====================

describe('optimiserContenants', () => {
  it('remplit en glouton du plus grand au plus petit contenant', () => {
    expect(optimiserContenants(25, ['12L', '3L', '1L'])).toEqual([
      { contenance: '12L', quantite: 2, litres: 24 },
      { contenance: '1L', quantite: 1, litres: 1 },
    ]);
    expect(optimiserContenants(17, ['12L', '3L', '1L'])).toEqual([
      { contenance: '12L', quantite: 1, litres: 12 },
      { contenance: '3L', quantite: 1, litres: 3 },
      { contenance: '1L', quantite: 2, litres: 2 },
    ]);
  });

  it('couvre exactement le litrage quand les contenances tombent juste', () => {
    expect(optimiserContenants(24, ['12L', '3L', '1L'])).toEqual([
      { contenance: '12L', quantite: 2, litres: 24 },
    ]);
  });

  it("empile des 3L quand la couleur n'existe pas en 12L", () => {
    expect(optimiserContenants(25, ['3L', '1L'])).toEqual([
      { contenance: '3L', quantite: 8, litres: 24 },
      { contenance: '1L', quantite: 1, litres: 1 },
    ]);
  });

  it('ajoute un pot de la plus petite contenance disponible pour couvrir le reste', () => {
    // 25 L avec seulement 12L et 3L : 2×12 = 24, reste 1 → +1×3L (surplus accepté)
    expect(optimiserContenants(25, ['12L', '3L'])).toEqual([
      { contenance: '12L', quantite: 2, litres: 24 },
      { contenance: '3L', quantite: 1, litres: 3 },
    ]);
  });

  it('couvre un petit litrage avec la plus petite contenance', () => {
    expect(optimiserContenants(2, ['12L', '3L', '1L'])).toEqual([
      { contenance: '1L', quantite: 2, litres: 2 },
    ]);
  });

  it('ne commande jamais moins que le litrage nécessaire', () => {
    for (const litres of [1, 5, 7, 13, 26, 40]) {
      for (const dispo of [['12L', '3L', '1L'], ['3L', '1L'], ['12L', '3L']] as const) {
        const commande = calculerLitresCommandes(optimiserContenants(litres, [...dispo]));
        expect(commande).toBeGreaterThanOrEqual(litres);
      }
    }
  });
});

// ==================== extraireContenancesDisponibles ====================

describe('extraireContenancesDisponibles', () => {
  it('extrait les contenances des titres de variants, ordonnées décroissantes', () => {
    const variants = [variant('1L / Mate', '10'), variant('3L / Mate', '25')];
    expect(extraireContenancesDisponibles(variants)).toEqual(['3L', '1L']);
  });

  it('retombe sur les contenances standard sans variants exploitables', () => {
    expect(extraireContenancesDisponibles([])).toEqual(['12L', '3L', '1L']);
    expect(extraireContenancesDisponibles([variant('Format unique', '10')])).toEqual([
      '12L',
      '3L',
      '1L',
    ]);
  });
});

// ==================== determinerTypeSousCouche ====================

describe('determinerTypeSousCouche', () => {
  it('retourne grise pour la base C', () => {
    expect(determinerTypeSousCouche('C')).toBe('grise');
    expect(determinerTypeSousCouche('c')).toBe('grise');
  });

  it('retourne blanche pour toutes les autres bases', () => {
    expect(determinerTypeSousCouche('B')).toBe('blanche');
    expect(determinerTypeSousCouche('BLC')).toBe('blanche');
    expect(determinerTypeSousCouche('Blanc')).toBe('blanche');
  });
});

// ==================== agregerSurfacesParCouleur ====================

describe('agregerSurfacesParCouleur', () => {
  it('mutualise la même couleur+finition entre murs et entre pièces', () => {
    const blancMat = couleur();
    const pieces: Piece[] = [
      piece({
        nom: 'Salon',
        murs: [
          { id: 'm1', surface: 10, couleur: blancMat },
          { id: 'm2', surface: 15, couleur: blancMat },
        ],
      }),
      piece({
        id: '2',
        nom: 'Chambre',
        murs: [{ id: 'm1', surface: 20, couleur: blancMat }],
      }),
    ];

    const resultat = agregerSurfacesParCouleur(pieces);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].surfaceTotale).toBe(45);
    expect(resultat[0].details).toHaveLength(3);
  });

  it('sépare STRICTEMENT deux finitions du même produit (prix différents)', () => {
    const pieces: Piece[] = [
      piece({
        murs: [
          { id: 'm1', surface: 10, couleur: couleur({ finition: 'Mate' }) },
          { id: 'm2', surface: 15, couleur: couleur({ finition: 'Velours' }) },
        ],
      }),
    ];

    const resultat = agregerSurfacesParCouleur(pieces);
    expect(resultat).toHaveLength(2);
    expect(resultat.map(r => r.surfaceTotale).sort()).toEqual([10, 15]);
  });

  it('sépare deux produits différents de même finition', () => {
    const pieces: Piece[] = [
      piece({
        murs: [
          { id: 'm1', surface: 10, couleur: couleur() },
          { id: 'm2', surface: 15, couleur: couleur({ productHandle: 'peinture-bleu-klein', titre: 'Bleu Klein' }) },
        ],
      }),
    ];

    expect(agregerSurfacesParCouleur(pieces)).toHaveLength(2);
  });

  it('intègre plafond et boiseries avec leurs couleurs propres', () => {
    const pieces: Piece[] = [
      piece({
        murs: [{ id: 'm1', surface: 10, couleur: couleur({ finition: 'Velours' }) }],
        surfacePlafond: 8,
        couleurPlafond: couleur({ finition: 'Mate' }),
        surfaceBoiseries: 2,
        couleurBoiseries: couleur({ productHandle: 'laque-boiseries', finition: 'Satin' }),
      }),
    ];

    const resultat = agregerSurfacesParCouleur(pieces);
    expect(resultat).toHaveLength(3);
    const types = resultat.flatMap(r => r.details.map(d => d.type)).sort();
    expect(types).toEqual(['boiseries', 'murs', 'plafond']);
  });
});

// ==================== calculerPrixTotal ====================

describe('calculerPrixTotal', () => {
  const variantsFinitions = [
    variant('3L / Mate', '50.00'),
    variant('3L / Velours', '60.00'),
    variant('12L / Mate', '150.00'),
  ];

  it('CAS CRITIQUE : même contenance, finitions différentes → prix différents', () => {
    const contenants = [{ contenance: '3L' as const, quantite: 2, litres: 6 }];
    expect(calculerPrixTotal(contenants, variantsFinitions, 'Mate')).toBe(100);
    expect(calculerPrixTotal(contenants, variantsFinitions, 'Velours')).toBe(120);
  });

  it('cumule plusieurs contenances de la même finition', () => {
    const contenants = [
      { contenance: '12L' as const, quantite: 1, litres: 12 },
      { contenance: '3L' as const, quantite: 1, litres: 3 },
    ];
    expect(calculerPrixTotal(contenants, variantsFinitions, 'Mate')).toBe(200);
  });

  it('CAS GAMME : retient la Biosourcée standard, jamais la Dépolluante, quel que soit l\'ordre API', () => {
    const contenants = [{ contenance: '3L' as const, quantite: 1, litres: 3 }];
    const standard = variant('Biosourcée / 3L / Mate', '92.68');
    const depolluante = variant('Biosourcée dépolluante / 3L / Mate', '107.65');

    expect(calculerPrixTotal(contenants, [depolluante, standard], 'Mate')).toBe(92.68);
    expect(calculerPrixTotal(contenants, [standard, depolluante], 'Mate')).toBe(92.68);
  });

  it('filtre sur la seule contenance quand la finition est absente (sous-couches)', () => {
    const contenants = [{ contenance: '3L' as const, quantite: 1, litres: 3 }];
    expect(calculerPrixTotal(contenants, [variant('12L', '80'), variant('3L', '30')])).toBe(30);
  });

  it('retourne 0 sans variants', () => {
    expect(calculerPrixTotal([{ contenance: '3L', quantite: 1, litres: 3 }], [])).toBe(0);
  });
});

// ==================== verrou de gamme ====================

describe('estVariantGammeStandard / selectionnerVariantGammeStandard', () => {
  it('détecte la gamme Dépolluante quel que soit le libellé', () => {
    expect(estVariantGammeStandard('Biosourcée / 3L / Mate')).toBe(true);
    expect(estVariantGammeStandard('Biosourcée dépolluante / 3L / Mate')).toBe(false);
    expect(estVariantGammeStandard('Dépolluante / 3L / Mate')).toBe(false);
    expect(estVariantGammeStandard('DEPOLLUANTE 3L')).toBe(false);
    expect(estVariantGammeStandard(undefined)).toBe(true);
  });

  it('retient la gamme standard parmi des candidats mixtes, sans dépendre de l\'ordre', () => {
    const standard = variant('Biosourcée / 3L / Mate', '92.68');
    const depolluante = variant('Biosourcée dépolluante / 3L / Mate', '107.65');
    expect(selectionnerVariantGammeStandard([depolluante, standard])).toBe(standard);
    expect(selectionnerVariantGammeStandard([standard, depolluante])).toBe(standard);
  });

  it('conserve les produits mono-gamme et gère la liste vide', () => {
    const depolluante = variant('Biosourcée dépolluante / 3L / Mate', '107.65');
    expect(selectionnerVariantGammeStandard([depolluante])).toBe(depolluante);
    expect(selectionnerVariantGammeStandard([])).toBeUndefined();
  });
});

// ==================== sélection de variante des kits ====================

describe('selectionnerVariantKit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne l\'unique variant d\'un kit (cas nominal)', () => {
    const v = variant('Default Title', '24.90');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(selectionnerVariantKit([v])).toBe(v);
    expect(spy).not.toHaveBeenCalled();
  });

  it('SIGNALE bruyamment un kit qui gagnerait une variante supplémentaire', () => {
    // Verrou : les kits sont des bundles à variant unique. Si la boutique en
    // ajoute un deuxième, la sélection devient ambiguë — ce test garantit que
    // le cas ne passe jamais silencieusement (console.error obligatoire).
    const v1 = variant('Standard', '24.90');
    const v2 = variant('Grand format', '49.90');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(selectionnerVariantKit([v1, v2])).toBe(v1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('2 variants');
  });

  it('retourne undefined sans variants', () => {
    expect(selectionnerVariantKit([])).toBeUndefined();
    expect(selectionnerVariantKit(undefined)).toBeUndefined();
    expect(selectionnerVariantKit(null)).toBeUndefined();
  });
});

// ==================== calculerQuantites (intégration kit) ====================

describe('calculerQuantites — kit selon la surface totale', () => {
  const blancMat = couleur();

  const shopifyData = {
    [KIT_HANDLES.petiteSurface]: {
      variants: [variant('Default Title', '24.90')],
    },
    [KIT_HANDLES.grandeSurface]: {
      variants: [variant('Default Title', '49.90')],
    },
  };

  it('recommande le kit petite surface à ≤ 30 m², au prix boutique', () => {
    const pieces = [piece({ murs: [{ id: 'm1', surface: 25, couleur: blancMat }] })];
    const resultat = calculerQuantites(pieces, shopifyData);

    expect(resultat.surfaceTotale).toBe(25);
    expect(resultat.kit.type).toBe('petite');
    expect(resultat.kit.handle).toBe(KIT_HANDLES.petiteSurface);
    expect(resultat.kit.prix).toBe(24.9);
  });

  it('bascule sur le kit moyenne/grande surface strictement au-dessus de 30 m²', () => {
    const pieces = [piece({ murs: [{ id: 'm1', surface: 31, couleur: blancMat }] })];
    const resultat = calculerQuantites(pieces, shopifyData);

    expect(resultat.kit.type).toBe('grande');
    expect(resultat.kit.handle).toBe(KIT_HANDLES.grandeSurface);
    expect(resultat.kit.prix).toBe(49.9);
  });

  it('compte murs + plafond + boiseries dans la surface totale du seuil', () => {
    const pieces = [
      piece({
        murs: [{ id: 'm1', surface: 20, couleur: blancMat }],
        surfacePlafond: 8,
        couleurPlafond: blancMat,
        surfaceBoiseries: 4,
        couleurBoiseries: blancMat,
      }),
    ];
    const resultat = calculerQuantites(pieces, shopifyData);
    expect(resultat.surfaceTotale).toBe(32);
    expect(resultat.kit.type).toBe('grande');
  });

  it('prix kit à 0 (jamais de prix inventé) si le produit boutique est introuvable', () => {
    const pieces = [piece({ murs: [{ id: 'm1', surface: 25, couleur: blancMat }] })];
    const resultat = calculerQuantites(pieces, {});
    expect(resultat.kit.prix).toBe(0);
  });
});
