// Puente con Steam. Vive sólo en el proceso principal; la página lo usa por IPC (ver preload).
// La librería concreta (steamworks-ffi-node, ya elegida en el diseño) se conecta con un adaptador a SteamClient:
// sumarla como dependencia y traer los archivos del SDK de Steamworks queda pendiente de hacerlo con Lucas.
// Mientras tanto el juego funciona igual: el puente responde "no disponible" y nunca rompe.

export interface SteamClient {
  init(appId: number): boolean;           // false si Steam no está abierto o la cuenta no tiene el juego
  playerName(): string;
  unlockAchievement(id: string): boolean;
}

export type SteamStatus =
  | { available: true; appId: number; player: string }
  | { available: false; reason: string };

export interface SteamBridge {
  status(): SteamStatus;
  testAchievement(): boolean;
}

// Logro de prueba del App ID 480 (Spacewar), el que Valve deja usar para desarrollo.
const TEST_ACHIEVEMENT = 'ACH_WIN_ONE_GAME';

export function createSteamBridge(load: () => SteamClient | null, appId: number): SteamBridge {
  let state: SteamStatus;
  let client: SteamClient | null = null;
  try {
    const c = load();
    if (!c) state = { available: false, reason: 'Steam no está conectado en esta versión' };
    else if (!c.init(appId)) state = { available: false, reason: 'Steam no está abierto o la cuenta no tiene el juego' };
    else { client = c; state = { available: true, appId, player: c.playerName() }; }
  } catch (e) {
    state = { available: false, reason: `No se pudo cargar Steam: ${e instanceof Error ? e.message : String(e)}` };
  }
  return {
    status: () => state,
    testAchievement: () => {
      if (!client) return false;
      try { return client.unlockAchievement(TEST_ACHIEVEMENT); } catch { return false; }
    },
  };
}

// App ID: el real se pasa por variable de entorno; en desarrollo, 480.
export function steamAppId(env: Record<string, string | undefined>): number {
  const n = Number(env['STEAM_APP_ID']);
  return Number.isInteger(n) && n > 0 ? n : 480;
}
