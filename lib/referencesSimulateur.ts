import { chargerCouleur } from '@/lib/couleur';
import { chargerPapierPeint, type PapierPeint } from '@/lib/papierPeint';
import type { Couleur } from '@/lib/types';

/**
 * Tri des références reçues du simulateur (`teintes` des messages et de
 * l'URL d'arrivée, contrat inchangé) : chacune est une teinte connue de la
 * boutique (handle produit), un papier peint connu (SKU de variante « Lé »),
 * ou inconnue (ignorée et signalée). La distinction se fait par la boutique,
 * jamais d'après la forme de la référence.
 */

export type ReferenceTriee =
  | { type: 'peinture'; reference: string; couleur: Couleur }
  | { type: 'papier-peint'; reference: string; papierPeint: PapierPeint }
  | { type: 'inconnue'; reference: string }
  /** Erreur réseau ou serveur : ni reconnue, ni écartée comme inconnue */
  | { type: 'erreur'; reference: string };

export interface ReferencesTriees {
  /** Toutes les références, dans l'ordre reçu (ordre d'application) */
  references: ReferenceTriee[];
  /** Teintes connues, dans l'ordre reçu : la dernière est la dernière peinture appliquée */
  couleurs: Couleur[];
  /** Papiers peints connus, dans l'ordre reçu */
  papiersPeints: PapierPeint[];
}

async function trierReference(reference: string, targetFinition: string | undefined): Promise<ReferenceTriee> {
  try {
    const couleur = await chargerCouleur(reference, { targetFinition, signalerInconnue: false });
    if (couleur) return { type: 'peinture', reference, couleur };
    const papierPeint = await chargerPapierPeint(reference, { signalerInconnu: false });
    if (papierPeint) return { type: 'papier-peint', reference, papierPeint };
    console.warn(`Référence du simulateur inconnue de la boutique, ignorée : ${reference}`);
    return { type: 'inconnue', reference };
  } catch (err: unknown) {
    console.error(`Impossible de charger la référence ${reference}`, err);
    return { type: 'erreur', reference };
  }
}

/** Trie les références en parallèle, dans l'ordre reçu. */
export async function trierReferences(
  references: readonly string[],
  options: { targetFinition?: string } = {},
): Promise<ReferencesTriees> {
  const triees = await Promise.all(references.map((reference) => trierReference(reference, options.targetFinition)));
  const couleurs: Couleur[] = [];
  const papiersPeints: PapierPeint[] = [];
  for (const reference of triees) {
    if (reference.type === 'peinture') couleurs.push(reference.couleur);
    else if (reference.type === 'papier-peint') papiersPeints.push(reference.papierPeint);
  }
  return { references: triees, couleurs, papiersPeints };
}
