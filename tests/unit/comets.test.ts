import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import { spawnComet } from '../../src/sim/comets';
import { type Intent, step } from '../../src/sim/step';
import { addBody, BOLT, CARRIED, createWorld, FREE, KIND_ASTEROID, KIND_ROCKY, MAX_COMETS, ORBITING, PROJECTILE, type World } from '../../src/sim/world';

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
  it('el primero aparece a su tiempo, fuera de cuadro pero no lejos', () => {
    const w = createWorld(cfg(), 2, 10);
    for (let k = 0; k < DEFAULT_CONFIG.cometFirst * 60 - 2; k++) step(w, IDLE);
    expect(active(w)).toBe(0);
    for (let k = 0; k < 4; k++) step(w, IDLE);
    expect(active(w)).toBe(1);
    const x = w.comets.x[0]!, y = w.comets.y[0]!;
    const d = Math.hypot(x - w.star.x, y - w.star.y);
    expect(d).toBeGreaterThan(150); expect(d).toBeLessThan(400);
  });

  it('persigue a la estrella', () => {
    const w = createWorld(cfg(), 2, 10);
    const k = spawnComet(w, 120, 60);
    const d0 = Math.hypot(w.comets.x[k]! - w.star.x, w.comets.y[k]! - w.star.y);
    for (let s = 0; s < 120; s++) step(w, IDLE);
    expect(Math.hypot(w.comets.x[k]! - w.star.x, w.comets.y[k]! - w.star.y)).toBeLessThan(d0 - 20);
  });

  it('al tocarla le roba varios cuerpos (de 2 a 20, según su tamaño), los arrastra en fila y huye; después vuelve a cazar', () => {
    const w = createWorld(cfg(), 2, 20);
    withOrbit(w, 8);
    const k = spawnComet(w, 3, 0);
    step(w, IDLE);
    const n = w.comets.carry[k]!;
    expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(20);
    expect(w.lastStealCount).toBe(n);
    expect(w.orbitingCount).toBe(8 - n);
    expect(w.cometSteals).toBe(1);
    expect(w.comets.mode[k]).toBe(2);
    for (let s = 0; s < 60; s++) step(w, IDLE);
    for (let i = 0; i < w.count; i++) if (w.state[i] === CARRIED) expect(Math.hypot(w.x[i] - w.comets.x[k]!, w.y[i] - w.comets.y[k]!)).toBeLessThan(6 + 1.6 * n);
    for (let s = 0; s < DEFAULT_CONFIG.cometFleeTime * 60; s++) step(w, IDLE);
    expect(w.comets.mode[k]).toBe(1);
  });

  it('a veces, al azar, también se lleva un planeta de tu órbita (sin importar la habilidad)', () => {
    const run = (chance: number): number => {
      const w = createWorld(cfg({ cometPlanetChance: chance }), 2, 20);
      withOrbit(w, 8);
      const p = addBody(w, { x: 0, y: 14, vx: 0, vy: 0, radius: 1.2, kind: KIND_ROCKY });
      w.state[p] = ORBITING; w.orbitR[p] = 14; w.orbitTarget[p] = 14; w.orbitAngle[p] = Math.PI / 2; w.orbitingCount++;
      expect(w.ability).toBe(0);
      spawnComet(w, 3, 0);
      step(w, IDLE);
      return w.state[p]!;
    };
    expect(run(1)).toBe(CARRIED);
    expect(run(0)).toBe(ORBITING);
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
    for (let i = 0; i < w.count; i++) expect(w.state[i]).not.toBe(CARRIED);
  });

  it('nunca hay más cometas que el tamaño de la reserva', () => {
    const w = createWorld(cfg({ cometFirst: 0.1, cometEvery: 0.1 }), 2, 10);
    for (let s = 0; s < 600; s++) step(w, IDLE);
    expect(active(w)).toBe(MAX_COMETS);
  });
  it('si se cruza con un planeta suelto se destroza contra él (se lo puede llevar a chocar)', () => {
    const w = createWorld(cfg({ cometFirst: 1e9 }), 2, 10);
    const p = addBody(w, { x: 60, y: 0, vx: 0, vy: 0, radius: 6, kind: KIND_ROCKY });
    w.planets = Int32Array.of(p);
    const k = spawnComet(w, 120, 0);   // el planeta queda entre el cometa y vos
    for (let t = 0; t < 240 && w.comets.mode[k] !== 0; t++) step(w, IDLE);
    expect(w.comets.mode[k]).toBe(0);
    expect(w.cometCrashes).toBe(1);
  });

  it('no te persigue como un misil: ya cerca deja de corregir y cruza de largo', () => {
    const w = createWorld(cfg({ cometFirst: 1e9 }), 2, 10);
    const k = spawnComet(w, 200, 40);
    w.comets.chase[k] = 0;   // de los que cruzan
    w.star.vx = 0; w.star.vy = 0;
    // Te corrés de costado de golpe cuando ya lo tenés cerca: el cometa casi no gira.
    for (let t = 0; t < 600 && Math.hypot(w.comets.x[k]! - w.star.x, w.comets.y[k]! - w.star.y) > 60; t++) step(w, IDLE);
    const h0 = Math.atan2(w.comets.vy[k]!, w.comets.vx[k]!);
    w.star.y += 40; w.star.prevY += 40;
    for (let t = 0; t < 30; t++) step(w, IDLE);
    const h1 = Math.atan2(w.comets.vy[k]!, w.comets.vx[k]!);
    expect(Math.abs(h1 - h0)).toBeLessThan(0.3);
  });
  it('los que persiguen sí corrigen el rumbo hacia vos, aunque son más lentos', () => {
    const w = createWorld(cfg({ cometFirst: 1e9 }), 2, 10);
    const k = spawnComet(w, 200, 40);
    w.comets.chase[k] = 1;
    for (let t = 0; t < 600 && Math.hypot(w.comets.x[k]! - w.star.x, w.comets.y[k]! - w.star.y) > 60; t++) step(w, IDLE);
    const h0 = Math.atan2(w.comets.vy[k]!, w.comets.vx[k]!);
    w.star.y += 40; w.star.prevY += 40;
    for (let t = 0; t < 30; t++) step(w, IDLE);
    const h1 = Math.atan2(w.comets.vy[k]!, w.comets.vx[k]!);
    expect(Math.abs(h1 - h0)).toBeGreaterThan(0.3);
  });
});
