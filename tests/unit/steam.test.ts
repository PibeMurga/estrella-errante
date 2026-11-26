import { describe, expect, it } from 'vitest';
import { createSteamBridge, type SteamClient } from '../../src/main/steam';

const fakeClient = (ok = true): SteamClient & { unlocked: string[] } => {
  const unlocked: string[] = [];
  return {
    unlocked,
    init: () => ok,
    playerName: () => 'Jugador',
    unlockAchievement: (id) => { unlocked.push(id); return true; },
  };
};

describe('puente con Steam', () => {
  it('sin la librería, responde que no está disponible y no rompe', () => {
    const b = createSteamBridge(() => null, 480);
    expect(b.status()).toEqual({ available: false, reason: 'Steam no está conectado en esta versión' });
    expect(b.testAchievement()).toBe(false);
  });

  it('si cargar la librería falla, tampoco rompe', () => {
    const b = createSteamBridge(() => { throw new Error('dll faltante'); }, 480);
    const st = b.status();
    expect(st.available).toBe(false);
    expect(st.available ? '' : st.reason).toContain('dll faltante');
  });

  it('si Steam no está abierto, lo informa', () => {
    const b = createSteamBridge(() => fakeClient(false), 480);
    expect(b.status()).toEqual({ available: false, reason: 'Steam no está abierto o la cuenta no tiene el juego' });
  });

  it('con Steam disponible, saluda y desbloquea el logro de prueba', () => {
    const client = fakeClient();
    const b = createSteamBridge(() => client, 480);
    expect(b.status()).toEqual({ available: true, appId: 480, player: 'Jugador' });
    expect(b.testAchievement()).toBe(true);
    expect(client.unlocked).toEqual(['ACH_WIN_ONE_GAME']);
  });
});
