import { describe, expect, it } from 'vitest';
import { chargerToutesLesPages, type PageStorefront } from '@/lib/shopify-pagination';

function pages(total: number, taille: number): (after: string | null) => Promise<PageStorefront<number>> {
  return async (after) => {
    const debut = after === null ? 0 : Number(after);
    const fin = Math.min(debut + taille, total);
    const nodes = Array.from({ length: fin - debut }, (_, i) => debut + i);
    return { nodes, pageInfo: { hasNextPage: fin < total, endCursor: String(fin) } };
  };
}

describe('chargerToutesLesPages', () => {
  it('rassemble toutes les pages, au-delà de la taille d’une page', async () => {
    const noeuds = await chargerToutesLesPages(pages(57, 30));
    expect(noeuds).toHaveLength(57);
    expect(noeuds[56]).toBe(56);
  });

  it('s’arrête sur une page unique', async () => {
    expect(await chargerToutesLesPages(pages(3, 100))).toEqual([0, 1, 2]);
  });

  it('s’arrête si le curseur ne progresse pas', async () => {
    let appels = 0;
    const noeuds = await chargerToutesLesPages(async () => {
      appels++;
      return { nodes: [appels], pageInfo: { hasNextPage: true, endCursor: 'meme' } };
    });
    expect(appels).toBe(2);
    expect(noeuds).toEqual([1, 2]);
  });

  it('renvoie une liste vide si la connexion est absente', async () => {
    expect(await chargerToutesLesPages(async () => null)).toEqual([]);
  });
});
