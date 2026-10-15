import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Script d'intégration des pages Shopify (source : embed/colibri.js).
 * Configuration injectée au moment de servir :
 * - origine de l'app = origine du script lui-même (un script servi par un
 *   preview pilote donc ce preview) ;
 * - token Wizart (`NEXT_PUBLIC_WIZART_TOKEN`, public par nature, lu au build :
 *   un ajout dans Vercel exige un redéploiement). Absent : pas de simulateur ;
 * - indicateur `labo` (`NEXT_PUBLIC_COLIBRI_LABO`, fixé au build, jamais en
 *   production) : seul cas où un kit déjà présent sur la page (faux simulateur
 *   de /labo/pont) tient lieu de token.
 */
export const dynamic = 'force-dynamic';

const MARQUEUR_CONFIG = '__COLIBRI_CONFIG__';

// Cache court : un correctif est pris par les navigateurs en quelques minutes
const CACHE_CONTROL = 'public, max-age=300, s-maxage=300';

let source: string | null = null;

function lireSource(): string {
  if (source === null) {
    // Fichier embarqué dans la fonction : outputFileTracingIncludes (next.config.ts)
    source = readFileSync(path.join(process.cwd(), 'embed', 'colibri.js'), 'utf8');
  }
  return source;
}

export function GET(request: Request) {
  const config = {
    origineApp: new URL(request.url).origin,
    tokenWizart: process.env.NEXT_PUBLIC_WIZART_TOKEN?.trim() ?? '',
    labo: process.env.NEXT_PUBLIC_COLIBRI_LABO === '1',
  };
  const script = lireSource().replace(MARQUEUR_CONFIG, JSON.stringify(config));

  return new Response(script, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
