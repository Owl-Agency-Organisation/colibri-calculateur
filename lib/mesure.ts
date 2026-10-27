import type { EvenementMesure, ParametresMesure } from '@/lib/embed-messages';
import { estEmbarque, postToParent } from '@/lib/navigation';

/**
 * Événement GA4 du parcours du calculateur : envoyé à la page Shopify
 * (`colibri:mesure`, origine parente uniquement), qui le relaie à GA4 avec son
 * propre `gtag` et son consentement (script hébergé). App non embarquée :
 * aucun envoi. Appelé aux mêmes endroits que les `track()` Vercel Analytics,
 * qui restent en place.
 */
export function mesurer<E extends EvenementMesure>(evenement: E, parametres: ParametresMesure[E]): void {
  if (!estEmbarque()) return;
  postToParent({ type: 'colibri:mesure', evenement, parametres });
}

/** Booléen de l'app → valeur GA4 d'une liste fermée. */
export function ouiNon(valeur: boolean): 'oui' | 'non' {
  return valeur ? 'oui' : 'non';
}
