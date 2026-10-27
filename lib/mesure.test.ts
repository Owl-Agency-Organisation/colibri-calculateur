import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mesurer, ouiNon } from '@/lib/mesure';
import { PARENT_ORIGIN } from '@/lib/navigation';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Fenêtre de l'app : embarquée (top ≠ self) ou ouverte directement. */
function fenetreApp(embarquee: boolean) {
  const parent = { postMessage: vi.fn() };
  const fenetre: Record<string, unknown> = { parent, location: { origin: 'https://calculateur.colibripeinture.com' } };
  fenetre.self = fenetre;
  fenetre.top = embarquee ? parent : fenetre;
  vi.stubGlobal('window', fenetre);
  return parent;
}

describe('mesurer — colibri:mesure vers la page Shopify', () => {
  it('embarquée : message envoyé au parent, avec l’origine parente (jamais *)', () => {
    const parent = fenetreApp(true);
    mesurer('configurateur_sortie', { sortie: 'checkout' });
    mesurer('configurateur_panier_atteint', {});
    expect(parent.postMessage.mock.calls).toEqual([
      [{ type: 'colibri:mesure', evenement: 'configurateur_sortie', parametres: { sortie: 'checkout' } }, PARENT_ORIGIN],
      [{ type: 'colibri:mesure', evenement: 'configurateur_panier_atteint', parametres: {} }, PARENT_ORIGIN],
    ]);
    expect(PARENT_ORIGIN).toBe('https://www.colibripeinture.com');
  });

  it('window.top inaccessible (iframe cross-origin) : embarquée', () => {
    const parent = { postMessage: vi.fn() };
    const fenetre: Record<string, unknown> = { parent };
    fenetre.self = fenetre;
    Object.defineProperty(fenetre, 'top', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    vi.stubGlobal('window', fenetre);
    mesurer('configurateur_demarre', { arrivee: 'directe' });
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: 'colibri:mesure', evenement: 'configurateur_demarre', parametres: { arrivee: 'directe' } }, PARENT_ORIGIN,
    );
  });

  it('app ouverte directement (non embarquée) : aucun envoi', () => {
    const parent = fenetreApp(false);
    mesurer('configurateur_demarre', { arrivee: 'directe' });
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it('booléens de l’app → oui / non', () => {
    expect(ouiNon(true)).toBe('oui');
    expect(ouiNon(false)).toBe('non');
  });
});

describe('mesurer — aux mêmes endroits que les track() Vercel, inchangés', () => {
  const lire = (fichier: string) => readFileSync(path.join(__dirname, '..', fichier), 'utf8');

  // [fichier, appel track() d'origine (à l'identique), appel mesurer() qui le suit]
  const POINTS: [string, string, string][] = [
    ['app/page.tsx', "track('calcul_demarre');", "mesurer('configurateur_demarre', { arrivee: 'directe' });"],
    ['app/calculateur/piece/page.tsx', "track('piece_validee', { type_piece: typePiece });",
      "mesurer('configurateur_piece_validee', { type_piece: typePiece });"],
    ['app/calculateur/surfaces/page.tsx', "track('surfaces_saisies', { nombre_murs: mursData.length });",
      "mesurer('configurateur_surfaces_saisies', { nombre_murs: mursData.length });"],
    ['app/calculateur/options/page.tsx', "track('options_validees', { kit: optionKit, renovation: optionRenovation });",
      "mesurer('configurateur_options_validees', { kit: ouiNon(optionKit), renovation: ouiNon(optionRenovation) });"],
    ['app/calculateur/panier/page.tsx', "track('panier_atteint');", "mesurer('configurateur_panier_atteint', {});"],
    ['app/calculateur/panier/page.tsx', "track('sortie_choisie', { sortie: 'checkout' });",
      "mesurer('configurateur_sortie', { sortie: 'checkout' });"],
    ['app/calculateur/panier/page.tsx', "track('sortie_choisie', { sortie: 'permalink' });",
      "mesurer('configurateur_sortie', { sortie: 'permalink' });"],
    ['app/calculateur/panier/page.tsx', "track('sortie_choisie', { sortie: 'estimation' });",
      "mesurer('configurateur_sortie', { sortie: 'estimation' });"],
  ];

  it.each(POINTS)('%s : %s suivi de mesurer()', (fichier, appelTrack, appelMesure) => {
    const lignes = lire(fichier).split('\n').map((l) => l.trim());
    const index = lignes.indexOf(appelTrack);
    expect(index).toBeGreaterThan(-1);
    expect(lignes[index + 1]).toBe(appelMesure);
  });

  it('les appels track() sont exactement ceux d’avant (aucun ajouté, aucun retiré)', () => {
    const fichiers = [...new Set(POINTS.map(([f]) => f)), 'app/calculateur/simulateur/page.tsx'];
    const appels = fichiers.flatMap((f) => lire(f).match(/track\([^)]*\)/g) ?? []);
    expect(appels).toEqual([
      "track('calcul_demarre')",
      "track('piece_validee', { type_piece: typePiece })",
      "track('surfaces_saisies', { nombre_murs: mursData.length })",
      "track('options_validees', { kit: optionKit, renovation: optionRenovation })",
      "track('panier_atteint')",
      "track('sortie_choisie', { sortie: 'checkout' })",
      "track('sortie_choisie', { sortie: 'permalink' })",
      "track('sortie_choisie', { sortie: 'estimation' })",
    ]);
  });

  it('écran « Votre sélection du simulateur » : affichage, puis démarrage avec arrivee simulateur', () => {
    const source = lire('app/calculateur/simulateur/page.tsx');
    expect(source).toContain("mesurer('configurateur_selection_simulateur', {");
    expect(source).toContain('nb_teintes: triees.couleurs.length + triees.papiersPeints.length,');
    expect(source).toContain("mesurer('configurateur_demarre', { arrivee: 'simulateur' });");
  });
});
