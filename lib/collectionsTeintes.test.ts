import { describe, expect, it } from 'vitest';
import { estCollectionTeintes, selectionnerCollectionsTeintes } from '@/lib/collectionsTeintes';

// Titres réels de la boutique (colibripeinture.com, novembre 2026)
const TITRES_BOUTIQUE = [
  'Finitions laquées',
  'La laque blanche',
  'Les Beiges',
  'Les Blancs',
  'Les Blancs teintés',
  'Les Bleus',
  'Les Bruns',
  'Les Gris',
  'Les Jaunes',
  'Les laques beiges',
  'Les laques bleues',
  'Les laques claires',
  'Les laques grises',
  'Les laques noires',
  'Les laques vertes',
  'Les Noirs',
  'Les Oranges',
  'Les Pastels',
  'Les Peps',
  'Les Roses',
  'Les Rouges',
  'Les Tendances',
  'Les Terracottas',
  'Les Verts',
  'Les Violets',
  'Matériel',
  'Peinture intérieure',
  'Schmidt X Colibri',
  'Semaine blanche - Promotion sur les blancs',
];

describe('estCollectionTeintes', () => {
  it('garde les familles de couleurs, dont Les Beiges', () => {
    expect(estCollectionTeintes('Les Beiges')).toBe(true);
    expect(estCollectionTeintes('Les Blancs teintés')).toBe(true);
    expect(estCollectionTeintes('Schmidt X Colibri')).toBe(true);
  });

  it('écarte les laques, quelle que soit la casse', () => {
    expect(estCollectionTeintes('Les laques vertes')).toBe(false);
    expect(estCollectionTeintes('Les Laques Bleues')).toBe(false);
    expect(estCollectionTeintes('La laque blanche')).toBe(false);
  });

  it('écarte les sélections thématiques et les autres collections', () => {
    expect(estCollectionTeintes('Les Pastels')).toBe(false);
    expect(estCollectionTeintes('Les Peps')).toBe(false);
    expect(estCollectionTeintes('Les Tendances')).toBe(false);
    expect(estCollectionTeintes('Matériel')).toBe(false);
    expect(estCollectionTeintes('Semaine blanche - Promotion sur les blancs')).toBe(false);
  });
});

describe('selectionnerCollectionsTeintes', () => {
  it('renvoie les 14 familles triées A→Z puis Schmidt X Colibri', () => {
    const resultat = selectionnerCollectionsTeintes(TITRES_BOUTIQUE.map((title) => ({ title })));
    expect(resultat.map((c) => c.title)).toEqual([
      'Les Beiges',
      'Les Blancs',
      'Les Blancs teintés',
      'Les Bleus',
      'Les Bruns',
      'Les Gris',
      'Les Jaunes',
      'Les Noirs',
      'Les Oranges',
      'Les Roses',
      'Les Rouges',
      'Les Terracottas',
      'Les Verts',
      'Les Violets',
      'Schmidt X Colibri',
    ]);
  });

  it('ne modifie pas le tableau reçu', () => {
    const source = [{ title: 'Les Verts' }, { title: 'Les Beiges' }];
    selectionnerCollectionsTeintes(source);
    expect(source.map((c) => c.title)).toEqual(['Les Verts', 'Les Beiges']);
  });
});
