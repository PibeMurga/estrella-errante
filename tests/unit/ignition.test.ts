import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, type SimConfig } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, KIND_ASTEROID, ORBITING, PHASE_IGNITION, PHASE_PLAY, type World } from '../../src/sim/world';

const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({ ...GAME_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1, upgrades: false, ...o });
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const run = (w: World, secs: number, it: Intent = idle): void => { for (let k = 0; k < Math.round(secs * 60); k++) step(w, it); };
function withOrbit(w: World, n: number): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const i = addBody(w, { x: Math.cos(a) * 6, y: Math.sin(a) * 6, vx: 0, vy: 0, radius: 0.4, kind: KIND_ASTEROID });
    w.state[i] = ORBITING; w.orbitR[i] = 6; w.orbitTarget[i] = 6; w.orbitAngle[i] = a; w.orbitingCount++;
  }
}

describe('arranque como planeta', () => {
  it('siendo planeta no se dispara (ni queda una carga a medias)', () => {
    const w = createWorld(cfg(), 2, 40);
    withOrbit(w, 10);
    run(w, 1, { ...idle, hold: true, aimX: 50, aimY: 0, hasAim: true });
    run(w, 0.1, { ...idle, hold: false });
    expect(w.shots + w.bolts).toBe(0);
    expect(w.charge).toBe(0);
  });

  it('el agujero negro duerme: no se mueve ni traga; los cometas llegan más despacio que siendo estrella', () => {
    const w = createWorld(cfg(), 2, 40);
    const bx = w.bh.x, by = w.bh.y;
    const i = addBody(w, { x: bx + 2, y: by, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    run(w, 5);
    expect(w.bh.x).toBe(bx); expect(w.bh.y).toBe(by);
    expect(w.state[i]).not.toBe(3);
    let comets = 0; for (let k = 0; k < w.comets.mode.length; k++) if (w.comets.mode[k] !== 0) comets++;
    expect(comets).toBeGreaterThan(0);   // siendo planeta también vienen
    expect(w.cometClock).toBeGreaterThan(0);
  });

  it('al llegar a la masa de ignición: cinemática una sola vez, y al terminar se desbloquea todo', () => {
    const w = createWorld(cfg(), 2, 40);
    withOrbit(w, 10);
    w.star.mass = 30.5;
    step(w, idle);
    expect(w.phase).toBe(PHASE_IGNITION);
    expect(w.ignitions).toBe(1);
    run(w, GAME_CONFIG.ignitionTime + 0.1);
    expect(w.phase).toBe(PHASE_PLAY);
    expect(w.ignited).toBe(true);
    // Ya podés disparar.
    run(w, 0.1, { ...idle, hold: true, aimX: 50, aimY: 0, hasAim: true });
    run(w, 0.05, { ...idle, hold: false });
    expect(w.shots).toBe(1);
    // Perder masa no vuelve atrás.
    w.star.mass = 5;
    run(w, 0.5);
    expect(w.ignited).toBe(true);
    expect(w.ignitions).toBe(1);
  });
});
