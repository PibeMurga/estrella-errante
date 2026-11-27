import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import { spawnComet } from '../../src/sim/comets';
import { type Intent, step } from '../../src/sim/step';
import { addBody, BOLT, CARRIED, createWorld, FREE, KIND_ASTEROID, MAX_COMETS, ORBITING, PROJECTILE, type World } from '../../src/sim/world';

const IDLE: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, ...o });

function withOrbit(w: World, n: number): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const i = addBody(w, { x: Math.cos(a) * 8, y: Math.sin(a) * 8, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    w.state[i] = ORBITING; w.orbitR[i] = 8; w.orbitTarget[i] = 8; w.orbitAngle[i] = a;
    w.orbitingCount++;
    w.star.mass += w.mass[i];
  }
}

const active = (w: World): number => { let n = 0; for (let k = 0; k < MAX_COMETS; k++) if (w.comets.mode[k] !== 0) n++; return n; };

describe('cometa cazador', () => {
  it('el primero aparece al minuto, en un borde del mapa', () => {
    const w = createWorld(cfg(), 2, 10);
    for (let k = 0; k < DEFAULT_CONFIG.cometFirst * 60 - 2; k++) step(w, IDLE);
    expect(active(w)).toBe(0);
    for (let k = 0; k < 4; k++) step(w, IDLE);
    expect(active(w)).toBe(1);
    const x = w.comets.x[0]!, y = w.comets.y[0]!;
    const onEdge = Math.abs(x) > DEFAULT_CONFIG.arenaHalfWidth * 0.9 || Math.abs(y) > DEFAULT_CONFIG.arenaHalfHeight * 0.9;
    expect(onEdge).toBe(true);
  });

  it('persigue a la estrella', () => {
    const w = createWorld(cfg(), 2, 10);
    const k = spawnComet(w, 120, 60);
    const d0 = Math.hypot(w.comets.x[k]! - w.star.x, w.comets.y[k]! - w.star.y);
    for (let s = 0; s < 120; s++) step(w, IDLE);
    expect(Math.hypot(w.comets.x[k]! - w.star.x, w.comets.y[k]! - w.star.y)).toBeLessThan(d0 - 20);
  });

  it('al tocarla le roba un mundo, lo arrastra y huye; después vuelve a cazar', () => {
    const w = createWorld(cfg(), 2, 10);
    withOrbit(w, 2);
    const k = spawnComet(w, 3, 0);
    step(w, IDLE);
    expect(w.orbitingCount).toBe(1);
    expect(w.cometSteals).toBe(1);
    const c = w.comets.carry[k]!;
    expect(c).toBeGreaterThanOrEqual(0);
    expect(w.state[c]).toBe(CARRIED);
    expect(w.comets.mode[k]).toBe(2);
    for (let s = 0; s < 60; s++) step(w, IDLE);
    expect(Math.hypot(w.x[c] - w.comets.x[k]!, w.y[c] - w.comets.y[k]!)).toBeLessThan(6);
    for (let s = 0; s < DEFAULT_CONFIG.cometFleeTime * 60; s++) step(w, IDLE);
    expect(w.comets.mode[k]).toBe(1);
  });

  it('un golpe de honda le saca uno de vida', () => {
    const w = createWorld(cfg(), 2, 10);
    const k = spawnComet(w, 100, 0);
    const i = addBody(w, { x: 100, y: 0, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    w.state[i] = PROJECTILE; w.life[i] = 1;
    step(w, IDLE);
    expect(w.comets.hp[k]).toBe(DEFAULT_CONFIG.cometHp - 1);
  });

  it('un bólido lo destruye de un golpe: suelta lo robado y deja asteroides', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 }, 1, 40);
    const k = spawnComet(w, 30, 0);
    const b = addBody(w, { x: 30, y: 0, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    w.state[b] = BOLT; w.life[b] = 1;
    step(w, { targetX: 0, targetY: 0, hasTarget: false });
    expect(w.comets.mode[k]).toBe(0);
    expect(w.cometKills).toBe(1);
  });

  it('nunca hay más cometas que el tamaño de la reserva', () => {
    const w = createWorld(cfg({ cometFirst: 0.1, cometEvery: 0.1 }), 2, 10);
    for (let s = 0; s < 600; s++) step(w, IDLE);
    expect(active(w)).toBe(MAX_COMETS);
  });
});
