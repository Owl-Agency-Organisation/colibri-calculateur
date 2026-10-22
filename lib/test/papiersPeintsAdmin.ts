import type { ProduitPapierPeintAdmin } from '@/lib/papierPeint';

/**
 * Réponses de l'Admin API au catalogue des papiers peints (données réelles
 * du 21/10/2026, réduites aux variantes utiles aux tests).
 */

export const MONTGOLFIERES_ADMIN: ProduitPapierPeintAdmin = {
  handle: 'papier-peint-montgolfiere',
  title: 'Montgolfières - Papier peint écologique enfant',
  productType: 'Papier peint',
  featuredImage: null,
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/57106064965977',
        legacyResourceId: '57106064965977',
        sku: 'pp-montg-terracotta-le',
        selectedOptions: [{ name: 'Couleur', value: 'Terracotta' }, { name: 'Taille', value: 'Lé : 60x280cm' }],
        image: { url: 'https://cdn.shopify.com/s/files/1/0971/0436/3865/files/mockup_bebe_-_motif_1_-_terracotta.png' },
      },
    ],
  },
};

export const OMBRELLE_ADMIN: ProduitPapierPeintAdmin = {
  handle: 'ombrelle-papier-peint-ecologique',
  title: 'Ombrelle - Papier peint écologique',
  productType: 'Papier peint',
  featuredImage: null,
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/57173225832793',
        legacyResourceId: '57173225832793',
        sku: 'pp-ombre-bleunuit-le',
        selectedOptions: [{ name: 'Couleur', value: 'Ombrelle bleu nuit' }, { name: 'Taille', value: 'Lé : 53x280cm' }],
        image: { url: 'https://cdn.shopify.com/mockup_salon_4_-_motif_3_-_bleu_nuit.png' },
      },
    ],
  },
};

/** Réponse Admin du catalogue (une page) */
export function reponseCatalogue(produits: ProduitPapierPeintAdmin[]) {
  return { products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: produits } };
}
