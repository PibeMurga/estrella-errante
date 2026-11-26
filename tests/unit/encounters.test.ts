import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import { crashPairRoll } from '../../src/sim/encounters';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, DEAD, FREE, hashWorld, KIND_ASTEROID, KIND_GAS, KIND_ICE, KIND_ROCKY, type World } from '../../src/sim/world';

// Encuentros entre planetas: el chico bordea al grande y sigue su camino; sólo dos casi iguales pueden chocar, y rara vez.
const IDLE: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, ...o });
const run = (w: World, secs: number, each?: () => void): void => {
  for (let k = 0; k < secs * 60; k++) { w.bh.active = false; step(w, IDLE); each?.(); }
};
const freeDebris = (w: World): number => { let n = 0; for (let i = 0; i < w.count; i++) if (w.kind[i] === KIND_ASTEROID && w.state[i] === FREE) n++; return n; };

// Lejos de la estrella, para que no los capture ni los dañe.
const X0 = 300, Y0 = 200;

describe('encuentros entre planetas', () => {
  it('el chico bordea al grande en arco, nunca lo toca, y sigue con su misma velocidad', () => {
    const w = createWorld(cfg({ crashChance: 0 }), 5, 10);
    const big = addBody(w, { x: X0, y: Y0, vx: 0, vy: 0, radius: 6, kind: KIND_ROCKY });
    const small = addBody(w, { x: X0 - 70, y: Y0 + 1, vx: 8, vy: 0, radius: 4.5, kind: KIND_ICE });
    let minD = Infinity, maxSide = 0;
    run(w, 20, () => {
      minD = Math.min(minD, Math.hypot(w.x[small]! - w.x[big]!, w.y[small]! - w.y[big]!));
      maxSide = Math.max(maxSide, Math.abs(w.y[small]! - Y0));
    });
    expect(minD).toBeGreaterThanOrEqual((6 + 4.5) * DEFAULT_CONFIG.encounterGap - 1e-6);
    expect(maxSide).toBeGreaterThan(6);                 // se desvió rodeándolo
    expect(w.x[small]).toBeGreaterThan(X0 + 70);        // y siguió de largo
    expect(w.vx[small]).toBe(8); expect(w.vy[small]).toBe(0);
    expect(w.x[big]).toBe(X0); expect(w.y[big]).toBe(Y0);   // el grande no se mueve
    expect(w.planetCrashes).toBe(0);
  });

  it('dos rocosos casi iguales que sí pueden chocar: explosión, uno se deshace y el otro queda partido', () => {
    const w = createWorld(cfg({ crashChance: 1 }), 5, 10);
    const a = addBody(w, { x: X0, y: Y0, vx: 0, vy: 0, radius: 5.2, kind: KIND_ROCKY });
    const b = addBody(w, { x: X0 - 40, y: Y0, vx: 10, vy: 0, radius: 5, kind: KIND_ROCKY });
    const before = freeDebris(w);
    run(w, 6);
    expect(w.planetCrashes).toBe(1);
    expect(w.tidalBreaks).toBe(0);                       // no es marea
    expect(w.state[b]).toBe(DEAD);
    expect(w.state[a]).toBe(FREE);
    expect(w.broken[a]).toBeGreaterThan(0);
    expect(freeDebris(w) - before).toBe(DEFAULT_CONFIG.tidalDebris * 2);
    // Cantidad de movimiento: el sobreviviente sigue con la velocidad combinada.
    const ma = 5.2 ** 3, mb = 5 ** 3;
    expect(w.vx[a]).toBeCloseTo((10 * mb) / (ma + mb), 5);
    expect(w.crashR).toBeCloseTo(10.2, 5);
  });

  it('si el par no salió sorteado para chocar, se esquivan igual', () => {
    const w = createWorld(cfg({ crashChance: 0 }), 5, 10);
    addBody(w, { x: X0, y: Y0, vx: 0, vy: 0, radius: 5.2, kind: KIND_ROCKY });
    addBody(w, { x: X0 - 40, y: Y0, vx: 10, vy: 0, radius: 5, kind: KIND_ROCKY });
    run(w, 10);
    expect(w.planetCrashes).toBe(0);
  });

  it('planetas de tamaños muy distintos nunca chocan', () => {
    const w = createWorld(cfg({ crashChance: 1 }), 5, 10);
    addBody(w, { x: X0, y: Y0, vx: 0, vy: 0, radius: 7, kind: KIND_ROCKY });
    addBody(w, { x: X0 - 50, y: Y0, vx: 10, vy: 0, radius: 3, kind: KIND_ROCKY });
    run(w, 10);
    expect(w.planetCrashes).toBe(0);
  });

  it('los gigantes gaseosos nunca chocan, aunque sean iguales', () => {
    const w = createWorld(cfg({ crashChance: 1 }), 5, 10);
    addBody(w, { x: X0, y: Y0, vx: 0, vy: 0, radius: 8, kind: KIND_GAS });
    addBody(w, { x: X0 - 50, y: Y0, vx: 10, vy: 0, radius: 8, kind: KIND_GAS });
    run(w, 10);
    expect(w.planetCrashes).toBe(0);
  });

  it('el sorteo por par es simétrico y reparte parejo', () => {
    expect(crashPairRoll(3, 9)).toBe(crashPairRoll(9, 3));
    let under = 0, n = 0;
    for (let i = 0; i < 60; i++) for (let j = i + 1; j < 60; j++) { n++; if (crashPairRoll(i, j) < 0.35) under++; }
    expect(under / n).toBeGreaterThan(0.28);
    expect(under / n).toBeLessThan(0.42);
  });

  it('el mapa completo sigue siendo determinista con los encuentros', () => {
    const a = createWorld(DEFAULT_CONFIG, 42), b = createWorld(DEFAULT_CONFIG, 42);
    for (let k = 0; k < 600; k++) { step(a, IDLE); step(b, IDLE); }
    expect(hashWorld(a)).toBe(hashWorld(b));
  });
});
