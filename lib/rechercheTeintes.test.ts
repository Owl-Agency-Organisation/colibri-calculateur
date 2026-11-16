import { describe, expect, it } from 'vitest';
import {
  construireIndexTeintes,
  normaliserTexte,
  rechercherTeintes,
  vignette,
  type CollectionAIndexer,
  type TeinteIndex,
} from '@/lib/rechercheTeintes';

const SUFFIXE = ' - Peinture biosourcée murs et plafonds';

function produit(handle: string, nom: string, finitions = ['Mat', 'Velours', 'Satin']) {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    title: `${nom}${SUFFIXE}`,
    images: { edges: [{ node: { url: `https://cdn.shopify.com/${handle}.jpg?v=1` } }] },
    finitions,
  };
}

// Noms fictifs : seuls la forme des titres et le découpage en familles comptent
const COLLECTIONS: CollectionAIndexer[] = [
  { titre: 'Les Beiges', produits: [produit('sable-dore', 'Sable doré'), produit('creme-brulee', 'Crème brûlée')] },
  { titre: 'Les Blancs', produits: [produit('blanc-pur', 'Blanc pur'), produit('creme-brulee', 'Crème brûlée')] },
  { titre: 'Les Bleus', produits: [produit('bleu-ardoise', 'Bleu ardoise'), produit('ardoise-claire', 'Ardoise claire')] },
  {
    titre: 'Les Gris',
    produits: [produit('gris-perle', 'Gris perle', ['Mat', 'Velours']), produit('gris-orage', 'Gris orage', ['Satin'])],
  },
  { titre: 'Schmidt X Colibri', produits: [produit('cuisine-sable', 'Cuisine sable', ['Mat'])] },
];

const INDEX: TeinteIndex[] = construireIndexTeintes(COLLECTIONS);
const noms = (teintes: TeinteIndex[]) => teintes.map((t) => t.nom);

describe('construireIndexTeintes', () => {
  it('garde le nom court et la famille, sans doublon de teinte', () => {
    expect(INDEX).toHaveLength(8);
    const creme = INDEX.find((t) => t.handle === 'creme-brulee');
    expect(creme).toMatchObject({ nom: 'Crème brûlée', collection: 'Les Beiges' });
    expect(creme?.imageUrl).toBe('https://cdn.shopify.com/creme-brulee.jpg?v=1');
  });
});

describe('normaliserTexte', () => {
  it('ignore casse, accents et ponctuation', () => {
    expect(normaliserTexte('  Crème-Brûlée ')).toBe('creme brulee');
  });
});

describe('rechercherTeintes', () => {
  it('ne propose rien sous 2 caractères', () => {
    expect(rechercherTeintes(INDEX, 'c')).toEqual([]);
    expect(rechercherTeintes(INDEX, '  ')).toEqual([]);
  });

  it('trouve sans accents ni majuscules', () => {
    expect(noms(rechercherTeintes(INDEX, 'CREME'))).toEqual(['Crème brûlée']);
  });

  it('classe le début du nom avant un mot intérieur', () => {
    expect(noms(rechercherTeintes(INDEX, 'ardoise'))).toEqual(['Ardoise claire', 'Bleu ardoise']);
  });

  it('accepte plusieurs mots dans le désordre', () => {
    expect(noms(rechercherTeintes(INDEX, 'claire ard'))).toEqual(['Ardoise claire']);
  });

  it('trouve une partie de mot dans le nom', () => {
    expect(noms(rechercherTeintes(INDEX, 'rulee'))).toEqual(['Crème brûlée']);
  });

  it('trouve les teintes d’une famille par son nom, après les noms', () => {
    expect(noms(rechercherTeintes(INDEX, 'beige'))).toEqual(['Crème brûlée', 'Sable doré']);
    expect(noms(rechercherTeintes(INDEX, 'sable'))).toEqual(['Sable doré', 'Cuisine sable']);
  });

  it('n’utilise pas « Les » comme critère de famille', () => {
    expect(rechercherTeintes(INDEX, 'les')).toEqual([]);
  });

  it('applique le filtre de finition de la popup', () => {
    // Les Gris : seule « Gris orage » existe en satin
    expect(noms(rechercherTeintes(INDEX, 'gris', { targetFinition: 'Satin' }))).toEqual(['Gris orage']);
    expect(noms(rechercherTeintes(INDEX, 'gris', { targetFinition: 'Mate' }))).toEqual(['Gris perle']);
    // Schmidt X Colibri : aucune teinte en satin, toute la famille reste proposée
    expect(noms(rechercherTeintes(INDEX, 'cuisine', { targetFinition: 'Satin' }))).toEqual(['Cuisine sable']);
  });

  it('respecte la limite de suggestions', () => {
    const grandIndex = construireIndexTeintes([
      { titre: 'Les Verts', produits: Array.from({ length: 20 }, (_, i) => produit(`vert-${i}`, `Vert ${i}`)) },
    ]);
    expect(rechercherTeintes(grandIndex, 'vert')).toHaveLength(8);
    expect(rechercherTeintes(grandIndex, 'vert', { limite: 3 })).toHaveLength(3);
  });
});

describe('vignette', () => {
  it('ajoute la largeur à une URL du CDN', () => {
    expect(vignette('https://cdn.shopify.com/a.jpg?v=1', 96)).toBe('https://cdn.shopify.com/a.jpg?v=1&width=96');
  });

  it('laisse une URL vide ou invalide telle quelle', () => {
    expect(vignette('', 96)).toBe('');
    expect(vignette('pas une url', 96)).toBe('pas une url');
  });
});
