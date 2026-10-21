import { vi } from 'vitest';
import type { PapierPeint } from '@/lib/papierPeint';

/**
 * Données de test des références du simulateur : teintes (route produit) et
 * papiers peints (route papier peint), relevées sur la boutique le 21/10/2026.
 */

export function papierPeint(sku: string, motif: string, coloris: string, idVariante: string, handle: string): PapierPeint {
  return {
    sku,
    handle,
    titre: `${motif} - Papier peint écologique`,
    motif,
    coloris,
    imageUrl: `https://cdn.shopify.com/s/files/1/0971/0436/3865/files/${sku}.png`,
    variantId: `gid://shopify/ProductVariant/${idVariante}`,
    lien: `https://www.colibripeinture.com/products/${handle}?variant=${idVariante}`,
  };
}

export const MONTGOLFIERE_TERRACOTTA = papierPeint(
  'pp-montg-terracotta-le', 'Montgolfières', 'Terracotta', '57106064965977', 'papier-peint-montgolfiere',
);
export const OMBRELLE_BLEU_NUIT = papierPeint(
  'pp-ombre-bleunuit-le', 'Ombrelle', 'Ombrelle bleu nuit', '57173225832793', 'ombrelle-papier-peint-ecologique',
);

/**
 * `fetch` des routes de l'app : un handle de `teintes` est une teinte connue,
 * un SKU de `papiers` un papier peint connu, le reste est inconnu (404).
 */
export function stubRoutesBoutique(teintes: readonly string[], papiers: readonly PapierPeint[]) {
  const appels: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    appels.push(url);
    const reference = decodeURIComponent(url.split('/').pop() ?? '');
    if (url.startsWith('/api/shopify/product/') && teintes.includes(reference)) {
      return new Response(JSON.stringify({
        id: `gid://shopify/Product/${reference}`,
        handle: reference,
        title: `${reference} - Peinture biosourcée murs et plafonds`,
        variants: [],
        codeHex: '#88AACC',
      }), { status: 200 });
    }
    const papier = papiers.find((p) => p.sku === reference);
    if (url.startsWith('/api/shopify/papier-peint/') && papier) {
      return new Response(JSON.stringify(papier), { status: 200 });
    }
    return new Response('{"error":"introuvable"}', { status: 404 });
  }));
  return appels;
}

/** localStorage et sessionStorage en mémoire, `window` défini (stores côté client). */
export function stubStockages() {
  const creer = () => {
    const donnees = new Map<string, string>();
    return {
      getItem: (cle: string) => donnees.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => { donnees.set(cle, valeur); },
      removeItem: (cle: string) => { donnees.delete(cle); },
    };
  };
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', creer());
  vi.stubGlobal('sessionStorage', creer());
}
