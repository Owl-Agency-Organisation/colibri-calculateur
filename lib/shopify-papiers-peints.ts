import { callAdminAPI } from '@/lib/shopify-admin';
import {
  rechercheSku,
  requetePapiersPeints,
  versPapierPeint,
  type PapierPeint,
  type VariantePapierPeintAdmin,
} from '@/lib/papierPeint';

/**
 * Résolution des SKU de papiers peints — SERVEUR UNIQUEMENT (Admin API).
 * La Storefront API ne permet pas de chercher une variante par SKU (filtres
 * de `products(query:)` : type, tag, titre, vendeur, prix, disponibilité).
 */

type ReponseVariantes = Record<string, { nodes: VariantePapierPeintAdmin[] } | null>;

/**
 * Papiers peints connus parmi les SKU donnés (déjà validés), en une seule
 * requête Admin. Les SKU inconnus sont absents de la table. Lève une erreur
 * si l'Admin API est indisponible.
 */
export async function resoudrePapiersPeints(skus: readonly string[]): Promise<Map<string, PapierPeint>> {
  const trouves = new Map<string, PapierPeint>();
  if (skus.length === 0) return trouves;
  const variables = Object.fromEntries(skus.map((sku, i) => [`q${i}`, rechercheSku(sku)]));
  const data = await callAdminAPI<ReponseVariantes>(requetePapiersPeints(skus.length), variables);
  skus.forEach((sku, i) => {
    for (const variante of data?.[`v${i}`]?.nodes ?? []) {
      const papier = versPapierPeint(sku, variante);
      if (papier) {
        trouves.set(sku, papier);
        return;
      }
    }
  });
  return trouves;
}
