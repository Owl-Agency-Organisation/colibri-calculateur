import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

async function configServie(): Promise<Record<string, unknown>> {
  const reponse = GET(new Request('https://calculateur.colibripeinture.com/embed/colibri.js'));
  const script = await reponse.text();
  const appel = script.match(/colibri\.demarrer\(racine, (\{.*?\})\);/);
  if (!appel) throw new Error('configuration introuvable dans le script servi');
  return JSON.parse(appel[1]);
}

describe('/embed/colibri.js — configuration servie', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('origine du script, token et labo désactivé par défaut', async () => {
    vi.stubEnv('NEXT_PUBLIC_WIZART_TOKEN', ' jeton ');
    vi.stubEnv('NEXT_PUBLIC_COLIBRI_LABO', '');
    expect(await configServie()).toEqual({
      origineApp: 'https://calculateur.colibripeinture.com',
      tokenWizart: 'jeton',
      labo: false,
    });
  });

  it('labo vrai uniquement quand NEXT_PUBLIC_COLIBRI_LABO vaut 1', async () => {
    vi.stubEnv('NEXT_PUBLIC_COLIBRI_LABO', '1');
    expect((await configServie()).labo).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_COLIBRI_LABO', 'true');
    expect((await configServie()).labo).toBe(false);
  });
});
