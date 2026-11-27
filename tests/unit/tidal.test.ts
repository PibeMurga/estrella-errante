import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, DEAD, FREE, hashWorld, KIND_ASTEROID, KIND_GAS, KIND_ICE, KIND_ROCKY, type World } from '../../src/sim/world';

// Planeta partido por marea: al acercarse demasiado al agujero negro se desgarra y suelta una corriente de escombros.
const IDLE: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, ...o });

function worldWithBh(): World {
  const w = createWorld(cfg(), 3, 20);
  w.bh.active = true;
  w.bh.x = w.bh.prevX = 200; w.bh.y = w.bh.prevY = 0;
  w.bh.speed = 0;
  return w;
}
const freeAsteroids = (w: World): number => { let n = 0; for (let i = 0; i < w.count; i++) if (w.kind[i] === KIND_ASTEROID && w.state[i] === FREE && w.radius[i] > 0.3) n++; return n; };   // sin las esquirlas de los choques
const rocheFor = (w: World, i: number): number => w.bh.radius * DEFAULT_CONFIG.rocheFactor + w.radius[i]!;

describe('ruptura por marea', () => {
  it('un planeta rocoso dentro del límite se parte y suelta escombros', () => {
    const w = worldWithBh();
    const p = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 4, kind: KIND_ROCKY });
    w.x[p] = w.prevX[p] = 200 - rocheFor(w, p) + 1; w.y[p] = w.prevY[p] = 0;
    const r0 = w.radius[p]!, before = freeAsteroids(w);
    step(w, IDLE);
    expect(w.broken[p]).toBeGreaterThan(0);
    expect(w.tidalBreaks).toBe(1);
    const got = freeAsteroids(w) - before;   // cantidad distinta en cada ruptura
    expect(got).toBeGreaterThanOrEqual(Math.round(DEFAULT_CONFIG.tidalDebris * 0.5));
    expect(got).toBeLessThanOrEqual(Math.round(DEFAULT_CONFIG.tidalDebris * 1.5));
    expect(w.radius[p]).toBeLessThan(r0);
    expect(w.state[p]).toBe(FREE);
    // El eje apunta al agujero negro.
    expect(w.breakAx[p]).toBeCloseTo(1, 3);
    expect(Math.abs(w.breakAy[p]!)).toBeLessThan(1e-3);
  });

  it('los escombros salen en dos chorros: hacia el agujero negro y hacia afuera', () => {
    const w = worldWithBh();
    const p = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 4, kind: KIND_ICE });
    w.x[p] = w.prevX[p] = 200 - rocheFor(w, p) + 1;
    const freeBefore = new Set<number>();
    for (let i = 0; i < w.count; i++) if (w.state[i] === FREE) freeBefore.add(i);
    step(w, IDLE);
    let toward = 0, away = 0;
    for (let i = 0; i < w.count; i++) {
      if (freeBefore.has(i) || w.state[i] !== FREE || w.kind[i] !== KIND_ASTEROID) continue;
      const rel = w.vx[i] - w.vx[p];
      if (rel > 0) toward++; else away++;
    }
    expect(toward).toBeGreaterThan(3);
    expect(away).toBeGreaterThan(3);
  });

  it('se parte una sola vez y el tiempo desde la ruptura avanza', () => {
    const w = worldWithBh();
    const p = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 4, kind: KIND_ROCKY });
    w.x[p] = w.prevX[p] = 200 - rocheFor(w, p) + 1;
    step(w, IDLE);
    const t1 = w.broken[p]!, n1 = freeAsteroids(w);
    for (let k = 0; k < 10; k++) step(w, IDLE);
    expect(w.tidalBreaks).toBe(1);
    expect(w.broken[p]).toBeGreaterThan(t1);
    expect(freeAsteroids(w)).toBeLessThanOrEqual(n1);
  });

  it('fuera del límite no pasa nada', () => {
    const w = worldWithBh();
    const p = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 4, kind: KIND_ROCKY });
    w.x[p] = w.prevX[p] = 200 - rocheFor(w, p) - 5;
    step(w, IDLE);
    expect(w.broken[p]).toBe(0);
    expect(w.tidalBreaks).toBe(0);
  });

  it('un gigante gaseoso no se parte: se lo termina tragando', () => {
    const w = worldWithBh();
    const p = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 4, kind: KIND_GAS });
    w.x[p] = w.prevX[p] = 200 - rocheFor(w, p) + 1;
    for (let k = 0; k < 600 && w.state[p] !== DEAD; k++) step(w, IDLE);
    expect(w.broken[p]).toBe(0);
    expect(w.state[p]).toBe(DEAD);
  });

  it('sin agujero negro activo no se parte nada', () => {
    const w = worldWithBh();
    w.bh.active = false;
    const p = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 4, kind: KIND_ROCKY });
    w.x[p] = w.prevX[p] = 199;
    step(w, IDLE);
    expect(w.broken[p]).toBe(0);
  });
});

describe('planetas que ya arrancan partidos', () => {
  it('son pocos y sólo rocosos o helados', () => {
    let broken = 0, planets = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = createWorld(DEFAULT_CONFIG, seed);
      for (let i = 0; i < w.count; i++) {
        const k = w.kind[i]!;
        if (k !== KIND_ROCKY && k !== KIND_ICE && k !== KIND_GAS) continue;
        planets++;
        if (w.broken[i]! > 0) { broken++; expect(k === KIND_ROCKY || k === KIND_ICE).toBe(true); }
      }
    }
    expect(broken).toBeGreaterThan(0);
    expect(broken / planets).toBeLessThan(0.08);
  });

  it('el mapa sigue siendo determinista', () => {
    expect(hashWorld(createWorld(DEFAULT_CONFIG, 77))).toBe(hashWorld(createWorld(DEFAULT_CONFIG, 77)));
  });
});
