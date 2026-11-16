/**
 * Recherche de teintes par nom, avec saisie semi-automatique (popup couleur).
 *
 * L'index contient toutes les teintes des collections affichées dans la
 * popup (`selectionnerCollectionsTeintes` : familles « Les … » hors laques et
 * sélections, plus Schmidt X Colibri). Il est construit côté serveur
 * (`/api/shopify/teintes`) puis filtré localement à chaque frappe : aucune
 * requête par caractère saisi.
 */
import { nomCourtTeinte } from '@/lib/couleur';

export interface TeinteIndex {
  id: string;
  handle: string;
  /** Titre complet du produit Shopify */
  titre: string;
  /** Nom court affiché (partie avant « - ») */
  nom: string;
  /** Titre de la collection d'origine (ex. « Les Beiges ») */
  collection: string;
  imageUrl: string;
  finitions: string[];
}

export interface CollectionAIndexer {
  titre: string;
  produits: {
    id: string;
    handle: string;
    title: string;
    images: { edges: { node: { url: string } }[] };
    finitions: string[];
  }[];
}

/** Nombre minimal de caractères avant d'afficher des suggestions. */
export const LONGUEUR_MIN_RECHERCHE = 2;

/** Nombre maximal de suggestions affichées. */
export const SUGGESTIONS_MAX = 8;

/**
 * Index des teintes, dans l'ordre des collections reçues. Une teinte présente
 * dans plusieurs familles n'apparaît qu'une fois, rattachée à la première.
 */
export function construireIndexTeintes(collections: readonly CollectionAIndexer[]): TeinteIndex[] {
  const vus = new Set<string>();
  const index: TeinteIndex[] = [];
  for (const collection of collections) {
    for (const produit of collection.produits) {
      if (vus.has(produit.handle)) continue;
      vus.add(produit.handle);
      index.push({
        id: produit.id,
        handle: produit.handle,
        titre: produit.title,
        nom: nomCourtTeinte(produit.title),
        collection: collection.titre,
        imageUrl: produit.images.edges[0]?.node.url ?? '',
        finitions: produit.finitions,
      });
    }
  }
  return index;
}

/** Minuscules, sans accents, ponctuation remplacée par des espaces. */
export function normaliserTexte(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mots(texte: string): string[] {
  return normaliserTexte(texte).split(' ').filter(Boolean);
}

/** Finition cible normalisée, comme dans la popup (« Mate » → « mat »). */
function finitionCible(targetFinition: string | undefined): string | null {
  if (!targetFinition) return null;
  const valeur = targetFinition.toLowerCase();
  return valeur === 'mate' ? 'mat' : valeur;
}

function proposeFinition(teinte: TeinteIndex, cible: string): boolean {
  return teinte.finitions.some((f) => f.toLowerCase().includes(cible));
}

/**
 * Score de pertinence (plus petit = meilleur), ou null si la teinte ne
 * correspond pas :
 * 0. le nom commence par la saisie ;
 * 1. chaque mot saisi commence un mot du nom ;
 * 2. la saisie apparaît dans le nom ;
 * 3. chaque mot saisi commence un mot du nom ou de la famille (« beige »
 *    trouve les teintes de « Les Beiges »).
 */
function score(teinte: TeinteIndex, requete: string, motsRequete: string[]): number | null {
  const nom = normaliserTexte(teinte.nom);
  if (nom.startsWith(requete)) return 0;
  const motsNom = nom.split(' ');
  const commenceUnMot = (liste: string[]) =>
    motsRequete.every((mot) => liste.some((candidat) => candidat.startsWith(mot)));
  if (commenceUnMot(motsNom)) return 1;
  if (nom.includes(requete)) return 2;
  // « Les » n'apporte rien : sinon toute saisie « les » listerait toutes les teintes
  const motsFamille = mots(teinte.collection).filter((mot) => mot !== 'les');
  if (commenceUnMot([...motsNom, ...motsFamille])) return 3;
  return null;
}

/**
 * Suggestions pour une saisie. Filtre de finition identique à la popup : dans
 * une famille, seules les teintes proposées dans la finition recommandée ;
 * si aucune teinte de la famille ne l'est, toute la famille reste proposée.
 */
export function rechercherTeintes(
  index: readonly TeinteIndex[],
  saisie: string,
  options: { targetFinition?: string; limite?: number } = {},
): TeinteIndex[] {
  const requete = normaliserTexte(saisie);
  if (requete.length < LONGUEUR_MIN_RECHERCHE) return [];
  const motsRequete = requete.split(' ');

  const cible = finitionCible(options.targetFinition);
  const famillesAvecFinition = new Set<string>();
  if (cible) {
    for (const teinte of index) {
      if (proposeFinition(teinte, cible)) famillesAvecFinition.add(teinte.collection);
    }
  }
  const disponible = (teinte: TeinteIndex) =>
    !cible || !famillesAvecFinition.has(teinte.collection) || proposeFinition(teinte, cible);

  return index
    .filter(disponible)
    .map((teinte) => ({ teinte, score: score(teinte, requete, motsRequete) }))
    .filter((r): r is { teinte: TeinteIndex; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.teinte.nom.localeCompare(b.teinte.nom, 'fr', { sensitivity: 'base' }))
    .slice(0, options.limite ?? SUGGESTIONS_MAX)
    .map((r) => r.teinte);
}

/** URL d'image du CDN Shopify redimensionnée (vignettes de suggestions). */
export function vignette(url: string, largeur: number): string {
  if (!url) return url;
  try {
    const adresse = new URL(url);
    adresse.searchParams.set('width', String(largeur));
    return adresse.toString();
  } catch {
    return url;
  }
}
