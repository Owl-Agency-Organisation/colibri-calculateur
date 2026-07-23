/**
 * Klaviyo Events API — serveur uniquement.
 *
 * La clé privée (`KLAVIYO_PRIVATE_API_KEY`, jamais NEXT_PUBLIC_) ne transite
 * jamais côté client : ce module n'est importé que par des routes app/api/*.
 *
 * Format vérifié contre le spec OpenAPI officiel Klaviyo (révision 2026-07-15,
 * github.com/klaviyo/openapi) : POST /api/events, corps JSON:API avec metric et
 * profile en objets `data` imbriqués, succès HTTP 202.
 */

const KLAVIYO_EVENTS_ENDPOINT = 'https://a.klaviyo.com/api/events';
const KLAVIYO_API_REVISION = '2026-07-15';
// Timeout court : l'envoi d'événement ne doit jamais retenir la réponse d'une
// route au-delà de quelques secondes (fail-soft).
const KLAVIYO_TIMEOUT_MS = 5000;

export interface KlaviyoEventInput {
  /** Nom de la métrique Klaviyo (ex. "Estimation calculateur demandée") */
  metricName: string;
  profile: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  /** Propriétés libres de l'événement (visibles dans les templates de flow) */
  properties: Record<string, unknown>;
  /** Valeur monétaire de l'événement (convention Klaviyo pour le revenu) */
  value?: number;
  /** Identifiant de déduplication : un même unique_id n'est compté qu'une fois */
  uniqueId?: string;
}

/**
 * Envoie un événement à Klaviyo. Fail-soft par construction : toute erreur
 * (clé absente, HTTP non-2xx, timeout, réseau) est loggée et retourne false —
 * l'appelant ne doit JAMAIS faire échouer son flux sur ce retour.
 */
export async function sendKlaviyoEvent(input: KlaviyoEventInput): Promise<boolean> {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;

  if (!apiKey) {
    console.warn(
      `Klaviyo : KLAVIYO_PRIVATE_API_KEY absente — événement "${input.metricName}" ignoré ` +
        '(comportement normal sur un environnement sans clé, ex. preview).'
    );
    return false;
  }

  const payload = {
    data: {
      type: 'event',
      attributes: {
        properties: input.properties,
        ...(input.value !== undefined ? { value: input.value, value_currency: 'EUR' } : {}),
        ...(input.uniqueId ? { unique_id: input.uniqueId } : {}),
        metric: {
          data: {
            type: 'metric',
            attributes: { name: input.metricName },
          },
        },
        profile: {
          data: {
            type: 'profile',
            attributes: {
              email: input.profile.email,
              ...(input.profile.firstName ? { first_name: input.profile.firstName } : {}),
              ...(input.profile.lastName ? { last_name: input.profile.lastName } : {}),
            },
          },
        },
      },
    },
  };

  try {
    const response = await fetch(KLAVIYO_EVENTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_API_REVISION,
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(KLAVIYO_TIMEOUT_MS),
    });

    // Succès attendu : 202 Accepted
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(
        `Klaviyo : échec de l'envoi de l'événement "${input.metricName}" ` +
          `(HTTP ${response.status}) : ${body.slice(0, 500)}`
      );
      return false;
    }

    return true;
  } catch (error) {
    // Timeout (TimeoutError), réseau, DNS… — jamais bloquant pour l'appelant
    console.error(`Klaviyo : erreur lors de l'envoi de l'événement "${input.metricName}" :`, error);
    return false;
  }
}
