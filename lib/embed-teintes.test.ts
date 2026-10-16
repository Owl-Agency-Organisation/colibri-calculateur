import { describe, expect, it } from 'vitest';
import {
  MAX_HANDLES_TEINTES,
  lireHandlesDemandes,
  normaliserHex,
  origineAutorisee,
  requeteTeintes,
  versTeinteEmbed,
} from '@/lib/embed-teintes';

describe('endpoint teintes — logique pure', () => {
  it('ignore les handles invalides, garde l’ordre, sans doublon, borné', () => {
    expect(lireHandlesDemandes('bleu-ciel,<script>,../x,Vert-Sauge,bleu-ciel,')).toEqual(['bleu-ciel', 'vert-sauge']);
    expect(lireHandlesDemandes(null)).toEqual([]);
    const beaucoup = Array.from({ length: MAX_HANDLES_TEINTES + 5 }, (_, i) => `t${i}`).join(',');
    expect(lireHandlesDemandes(beaucoup)).toHaveLength(MAX_HANDLES_TEINTES);
  });

  it('normalise le code hexadécimal, null s’il est invalide', () => {
    expect(normaliserHex('#A1B2C3')).toBe('#a1b2c3');
    expect(normaliserHex('a1b2c3')).toBe('#a1b2c3');
    expect(normaliserHex(' #fff ')).toBe('#fff');
    expect(normaliserHex('rouge')).toBeNull();
    expect(normaliserHex(null)).toBeNull();
  });

  it('autorise la boutique, l’app et les requêtes de même origine, refuse le reste', () => {
    const app = 'https://calculateur.colibripeinture.com';
    expect(origineAutorisee('https://www.colibripeinture.com', app)).toBe(true);
    expect(origineAutorisee(app, app)).toBe(true);
    expect(origineAutorisee(null, app)).toBe(true);
    expect(origineAutorisee('https://evil.example', app)).toBe(false);
    expect(origineAutorisee('https://colibripeinture.com', app)).toBe(false);
  });

  it('renvoie handle, nom court et hex — rien d’autre', () => {
    expect(versTeinteEmbed({
      handle: 'deguesde-peinture-biosourcee-murs-et-plafonds',
      title: 'Deguesde - Peinture biosourcée murs et plafonds',
      hex: { value: '#C9B8A6' },
    })).toEqual({ handle: 'deguesde-peinture-biosourcee-murs-et-plafonds', nom: 'Deguesde', hex: '#c9b8a6' });
    expect(versTeinteEmbed({ handle: 'a', title: 'A', hex: null })).toEqual({ handle: 'a', nom: 'A', hex: null });
  });

  it('requête Storefront : un alias par handle, valeurs en variables', () => {
    const requete = requeteTeintes(2);
    expect(requete).toContain('query TeintesEmbed($h0: String!, $h1: String!)');
    expect(requete).toContain('t1: product(handle: $h1)');
    expect(requete).toContain('key: "code_hexadecimal"');
    expect(requete).not.toMatch(/price/i);
  });
});
