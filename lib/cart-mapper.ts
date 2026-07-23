/**
 * Cart Mapper - Conversion des résultats de calcul vers les lignes de panier Shopify
 * 
 * Ce module convertit le ResultatCalcul (logique métier) en CartLineInput[] (API Shopify)
 * tout en préservant la logique de sélection des contenances et des finitions.
 */

import type { CartLineInput } from './shopify-cart';
import type { ResultatCalcul, CalculPeinture, CalculSousCouche, CalculKit } from './calcul';
import { selectionnerVariantGammeStandard } from './calcul';
import { determinerKit, KITS_CONFIG, type ComposantKit } from './kits-config';

/**
 * Interface pour les options de panier
 */
export interface CartOptions {
  sousCouche: boolean;
  kit: boolean;
  renovation: boolean;
  composantsKit?: string[];
  produitsRenovation?: string[];
}

/**
 * Interface pour les données Shopify stockées
 */
export interface ShopifyProductData {
  id: string;
  handle: string;
  title: string;
  variants: Array<{
    id: string;
    title: string;
    sku: string;
    price: {
      amount: string;
      currencyCode: string;
    };
    availableForSale: boolean;
    selectedOptions?: Array<{
      name: string;
      value: string;
    }>;
  }>;
  featuredImage?: {
    url: string;
    altText?: string;
  };
}

/**
 * Produits de rénovation disponibles
 */
export const PRODUITS_RENOVATION = [
  { handle: 'pate-a-renover-multi-materiaux', titre: 'Pâte à rénover multi matériaux' },
  { handle: 'couteau-de-peintre', titre: 'Couteau de peintre (spatule)' },
  { handle: 'papier-a-poncer', titre: 'Papier à poncer grain 120' },
  { handle: 'cale-a-poncer-auto-agrippante', titre: 'Cale à poncer' },
];

/**
 * Trouve le variant Shopify correspondant à une contenance et une finition
 */
function findVariant(
  variants: ShopifyProductData['variants'],
  contenance: string,
  finition?: string
): ShopifyProductData['variants'][0] | undefined {
  if (!variants || variants.length === 0) return undefined;

  // Chercher avec contenance + finition, puis verrouiller la gamme standard (Biosourcée)
  // parmi les candidats — même logique que `calculerPrixTotal` pour que le prix envoyé
  // à Shopify ne diverge jamais du prix affiché.
  if (finition) {
    const candidats = variants.filter(v => {
      const title = (v.title || '').toLowerCase();
      return title.includes(contenance.toLowerCase()) && title.includes(finition.toLowerCase());
    });
    const variant = selectionnerVariantGammeStandard(candidats);
    if (variant) return variant;
  }

  // Fallback : chercher uniquement avec la contenance
  return variants.find(v => (v.title || '').toLowerCase().includes(contenance.toLowerCase()));
}

/**
 * Convertit les peintures calculées en lignes de panier Shopify
 */
function mapPeinturesToCartLines(
  peintures: CalculPeinture[],
  shopifyData: Record<string, ShopifyProductData>
): CartLineInput[] {
  const lines: CartLineInput[] = [];

  peintures.forEach((peinture) => {
    const productData = shopifyData[peinture.couleur.productHandle];
    
    if (!productData) {
      console.error(`Produit peinture non trouvé: ${peinture.couleur.productHandle}`);
      return;
    }

    // Pour chaque contenant calculé
    peinture.contenants.forEach((contenant) => {
      const variant = findVariant(
        productData.variants,
        contenant.contenance,
        peinture.couleur.finition
      );

      if (!variant) {
        console.error(
          `Variant peinture non trouvé: ${peinture.couleur.productHandle} - ${contenant.contenance} - ${peinture.couleur.finition}`
        );
        return;
      }

      lines.push({
        merchandiseId: variant.id,
        quantity: contenant.quantite,
        attributes: [
          { key: '_type', value: 'peinture' },
          { key: '_couleur', value: peinture.couleur.titre },
          { key: '_finition', value: peinture.couleur.finition || '' },
          { key: '_surface_originale', value: `${peinture.surfaceTotale.toFixed(1)}` },
          { key: '_surface_display', value: `${peinture.surfaceTotale.toFixed(1)}m²` },
          { key: '_contenance', value: contenant.contenance },
        ],
      });
    });
  });

  return lines;
}

/**
 * Convertit les sous-couches calculées en lignes de panier Shopify
 */
function mapSousCouchesToCartLines(
  sousCouches: CalculSousCouche[],
  shopifyData: Record<string, ShopifyProductData>
): CartLineInput[] {
  const lines: CartLineInput[] = [];

  sousCouches.forEach((sousCouche) => {
    const productData = shopifyData[sousCouche.handle];
    
    if (!productData) {
      console.error(`Sous-couche non trouvée: ${sousCouche.handle}`);
      return;
    }

    sousCouche.contenants.forEach((contenant) => {
      const variant = findVariant(productData.variants, contenant.contenance);

      if (!variant) {
        console.error(`Variant sous-couche non trouvé: ${sousCouche.handle} - ${contenant.contenance}`);
        return;
      }

      lines.push({
        merchandiseId: variant.id,
        quantity: contenant.quantite,
        attributes: [
          { key: '_type', value: 'sous-couche' },
          { key: '_sous_couche_type', value: sousCouche.type },
          { key: '_contenance', value: contenant.contenance },
        ],
      });
    });
  });

  return lines;
}

/**
 * Trouve un variant Shopify en utilisant un filtre optionnel sur les selectedOptions
 */
function findVariantByFilter(
  variants: ShopifyProductData['variants'],
  filter?: ComposantKit['variantFilter']
): ShopifyProductData['variants'][0] | undefined {
  if (!variants || variants.length === 0) return undefined;

  // Si un filtre est défini, chercher le variant correspondant
  if (filter) {
    const variant = variants.find(v =>
      v.selectedOptions?.some(opt =>
        opt.name === filter.option && opt.value === filter.value
      )
    );
    if (variant) return variant;
  }

  // Fallback : retourner le premier variant
  return variants[0];
}

/**
 * Convertit le kit matériel en lignes de panier Shopify
 * Ajoute chaque composant du kit individuellement
 */
function mapKitToCartLines(
  surfaceTotale: number,
  shopifyData: Record<string, ShopifyProductData>,
  composantsSelectionnes?: string[]
): CartLineInput[] {
  const lines: CartLineInput[] = [];
  
  // Déterminer le type de kit selon la surface
  const kitType = determinerKit(surfaceTotale);
  const kitConfig = KITS_CONFIG[kitType];

  // Pour chaque composant du kit (filtrer par composants sélectionnés si fournis)
  const composantsATraiter = composantsSelectionnes
    ? kitConfig.composants.filter(c => composantsSelectionnes.includes(c.handle))
    : kitConfig.composants;

  composantsATraiter.forEach((composant) => {
    const productData = shopifyData[composant.handle];
    
    if (!productData) {
      console.warn(`Composant kit indisponible: ${composant.nom} (${composant.handle})`);
      return;
    }

    // Trouver le variant approprié (avec filtre si nécessaire)
    const variant = findVariantByFilter(productData.variants, composant.variantFilter);

    if (!variant) {
      console.warn(
        `Variant non trouvé pour composant kit: ${composant.nom} - ${composant.handle}`,
        composant.variantFilter
      );
      return;
    }

    lines.push({
      merchandiseId: variant.id,
      quantity: 1,
      attributes: [
        { key: '_type', value: 'kit' },
        { key: '_kit_type', value: kitType },
        { key: '_composant', value: composant.handle },
        { key: '_composant_nom', value: composant.nom },
      ],
    });
  });

  return lines;
}

/**
 * Convertit les produits de rénovation en lignes de panier Shopify
 */
function mapRenovationToCartLines(
  shopifyData: Record<string, ShopifyProductData>,
  produitsSelectionnes?: string[]
): CartLineInput[] {
  const lines: CartLineInput[] = [];

  // Filtrer par produits sélectionnés si fournis
  const produitsATraiter = produitsSelectionnes
    ? PRODUITS_RENOVATION.filter(p => produitsSelectionnes.includes(p.handle))
    : PRODUITS_RENOVATION;

  produitsATraiter.forEach((produit) => {
    const productData = shopifyData[produit.handle];
    
    if (!productData || !productData.variants || productData.variants.length === 0) {
      console.error(`Produit rénovation non trouvé: ${produit.handle}`);
      return;
    }

    const variant = productData.variants[0];

    lines.push({
      merchandiseId: variant.id,
      quantity: 1,
      attributes: [
        { key: '_type', value: 'renovation' },
        { key: '_produit', value: produit.handle },
        { key: '_produit_nom', value: produit.titre },
      ],
    });
  });

  return lines;
}

/**
 * Fonction principale : Convertit le résultat de calcul complet en lignes de panier Shopify
 */
export function mapCalculToCartLines(
  resultat: ResultatCalcul,
  shopifyData: Record<string, ShopifyProductData>,
  options: CartOptions
): CartLineInput[] {
  const lines: CartLineInput[] = [];

  // 1. Peintures (toujours incluses)
  const peintureLines = mapPeinturesToCartLines(resultat.peintures, shopifyData);
  lines.push(...peintureLines);

  // 2. Sous-couches (si option activée)
  if (options.sousCouche) {
    const sousCoucheLines = mapSousCouchesToCartLines(resultat.sousCouches, shopifyData);
    lines.push(...sousCoucheLines);
  }

  // 3. Kit matériel (si option activée)
  if (options.kit) {
    const kitLines = mapKitToCartLines(
      resultat.surfaceTotale,
      shopifyData,
      options.composantsKit
    );
    lines.push(...kitLines);
  }

  // 4. Produits de rénovation (si option activée)
  if (options.renovation) {
    const renovationLines = mapRenovationToCartLines(
      shopifyData,
      options.produitsRenovation
    );
    lines.push(...renovationLines);
  }

  return lines;
}

/**
 * Extrait le type de produit depuis les attributs d'une ligne de panier
 * 
 * TODO [2026-03-01]: Supprimer le fallback `|| attributes.find(a => a.key === 'type')`
 * après expiration des paniers existants (7 jours d'inactivité Shopify).
 * Cette compatibilité ascendante permet la transition vers les attributs préfixés `_`
 * qui sont masqués au checkout Shopify.
 */
export function getLineType(attributes: Array<{ key: string; value: string }>): string {
  const typeAttr = attributes.find(a => a.key === '_type') || attributes.find(a => a.key === 'type');
  return typeAttr?.value || 'unknown';
}

/**
 * Vérifie si une ligne de panier peut être supprimée
 * Les peintures et sous-couches ne peuvent pas être supprimées
 */
export function canRemoveLine(attributes: Array<{ key: string; value: string }>): boolean {
  const type = getLineType(attributes);
  return type !== 'peinture' && type !== 'sous-couche';
}
