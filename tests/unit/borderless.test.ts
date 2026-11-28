import { describe, expect, it } from 'vitest';
import { CameraRig } from '../../src/render/cameraRig';
import { spawnComet, stepComets } from '../../src/sim/comets';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, KIND_ASTEROID, KIND_GAS, MAX_COMETS, type World } from '../../src/sim/world';

// Espacio sin bordes: la vuelta del mapa se calcula alrededor de la estrella, así la costura queda siempre lejos y fuera de cámara.
const NO_INPUT: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, ...o });
const hw = DEFAULT_CONFIG.arenaHalfWidth, hh = DEFAULT_CONFIG.arenaHalfHeight;

function starAt(w: World, x: number, y: number): void {
  w.star.x = w.star.prevX = x; w.star.y = w.star.prevY = y;
}

describe('espacio sin bordes', () => {
  it('la estrella no frena contra ningún borde', () => {
    const w = createWorld(cfg(), 1, 10);
    for (let k = 0; k < 9000; k++) step(w, { targetX: w.star.x + 1000, targetY: w.star.y - 1000, hasTarget: true });
    expect(w.star.x).toBeGreaterThan(hw * 1.5);
    expect(w.star.y).toBeLessThan(-hh * 1.5);
  });

  it('un cuerpo cerca de la estrella nunca salta, aunque esté pasando el viejo borde', () => {
    const w = createWorld(cfg(), 1, 10);
    starAt(w, hw, 0);
    const i = addBody(w, { x: hw + 20, y: 30, vx: 5, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    for (let k = 0; k < 60; k++) step(w, NO_INPUT);
    expect(w.x[i]).toBeGreaterThan(hw + 20);
    expect(w.x[i]).toBeLessThan(hw + 30);
  });

  it('lo que se aleja más de media arena de la estrella reaparece del lado opuesto de la estrella', () => {
    const w = createWorld(cfg(), 1, 10);
    starAt(w, 2000, -900);
    const i = addBody(w, { x: 2000 + hw - 0.01, y: -900 + 30, vx: 60, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    step(w, NO_INPUT);
    expect(w.x[i]).toBeCloseTo(2000 - hw + 0.99, 6);
    expect(Math.abs(w.x[i] - w.prevX[i])).toBeLessThan(2);
    const j = addBody(w, { x: 2000, y: -900 - hh + 0.01, vx: 0, vy: -60, radius: 0.5, kind: KIND_ASTEROID });
    step(w, NO_INPUT);
    expect(w.y[j]).toBeCloseTo(-900 + hh - 0.99, 6);
    expect(Math.abs(w.y[j] - w.prevY[j])).toBeLessThan(2);
  });

  it('los planetas también siguen la vuelta alrededor de la estrella', () => {
    const w = createWorld(cfg(), 1, 10);
    starAt(w, -3000, 0);
    const p = addBody(w, { x: -3000 - hw + 0.01, y: 50, vx: -60, vy: 0, radius: 5, kind: KIND_GAS });
    step(w, NO_INPUT);
    expect(w.x[p]).toBeCloseTo(-3000 + hw - 0.99, 6);
  });

  it('el agujero negro se mueve sin quedar trabado en los bordes viejos', () => {
    const w = createWorld({ ...cfg(), blackHole: true }, 1, 10);
    starAt(w, 3000, 0);
    w.bh.x = w.bh.prevX = 3000 - 300; w.bh.y = w.bh.prevY = 0;
    const d0 = 300;
    for (let k = 0; k < 120; k++) step(w, NO_INPUT);
    const d1 = Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y);
    expect(d1).toBeLessThan(d0);
    expect(w.bh.x).toBeGreaterThan(hw);
  });

  it('los cometas aparecen lejos de la estrella, donde esté, y la persiguen', () => {
    const w = createWorld(cfg({ cometFirst: 0.01 }), 1, 10);
    starAt(w, 5000, 4000);
    w.cometClock = 0;
    stepComets(w);
    let k = -1;
    for (let c = 0; c < MAX_COMETS; c++) if (w.comets.mode[c] !== 0) k = c;
    expect(k).toBeGreaterThanOrEqual(0);
    const dx = Math.abs(w.comets.x[k]! - 5000), dy = Math.abs(w.comets.y[k]! - 4000);
    expect(Math.hypot(dx, dy)).toBeGreaterThan(150);   // fuera de cuadro
    const d0 = Math.hypot(dx, dy);
    for (let s = 0; s < 120; s++) step(w, NO_INPUT);
    expect(Math.hypot(w.comets.x[k]! - w.star.x, w.comets.y[k]! - w.star.y)).toBeLessThan(d0);
  });

  it('un cometa lejos de la estrella no queda trabado en los bordes viejos', () => {
    const w = createWorld(cfg(), 1, 10);
    starAt(w, 3000, 0);
    const k = spawnComet(w, 3000 - 200, 0);
    for (let s = 0; s < 60; s++) step(w, NO_INPUT);
    expect(w.comets.x[k]!).toBeGreaterThan(3000 - 200 + 10);
  });
});

describe('la cámara nunca ve la costura', () => {
  for (const aspect of [16 / 9, 21 / 9, 4 / 3]) {
    it(`ni con la estrella enorme (aspecto ${aspect.toFixed(2)})`, () => {
      const rig = new CameraRig(); rig.aspect = aspect; rig.snap(0, 0);
      for (let k = 0; k < 4000; k++) rig.followMass(1e6, 0.1);
      const o = { x: 0, y: 0 };
      const margin = 40;   // radio de los planetas más grandes
      for (const [a, b] of [[-1, 1], [1, 1], [-1, -1], [1, -1], [0, 1], [1, 0]] as const) {
        expect(rig.screenToSim(a, b, o)).toBe(true);
        expect(Math.abs(o.x)).toBeLessThan(hw - margin);
        expect(Math.abs(o.y)).toBeLessThan(hh - margin);
      }
    });
  }
});
