import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, addSatellite, createWorld, DEAD, FREE, KIND_ASTEROID, KIND_GAS, KIND_MOON, OVER_SWALLOWED } from '../../src/sim/world';

const NO_INPUT: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, ...o });

describe('agujero negro', () => {
  it('aparece en un borde del mapa, lejos de la estrella', () => {
    const w = createWorld(cfg(), 3, 10);
    expect(w.bh.active).toBe(true);
    expect(Math.abs(w.bh.x)).toBeGreaterThan(cfg().arenaHalfWidth * 0.9);
  });

  it('avanza hacia la estrella sin pasar su velocidad máxima', () => {
    const w = createWorld(cfg(), 3, 10);
    const d0 = Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y);
    for (let i = 0; i < 600; i++) {
      step(w, NO_INPUT);
      expect(w.bh.speed).toBeLessThanOrEqual(cfg().bhMaxSpeed + 1e-9);
    }
    expect(Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y)).toBeLessThan(d0 - 5);
  });

  it('atrae a los cuerpos cercanos', () => {
    const w = createWorld(cfg({ bhStartSpeed: 0, bhAccel: 0 }), 3, 10);
    w.bh.x = 200; w.bh.y = 100;
    const i = addBody(w, { x: 260, y: 100, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    for (let k = 0; k < 60; k++) step(w, NO_INPUT);
    expect(w.x[i]).toBeLessThan(259);
  });

  it('no afecta a lo que está fuera de su alcance', () => {
    const w = createWorld(cfg({ bhStartSpeed: 0, bhAccel: 0 }), 3, 10);
    w.bh.x = 200; w.bh.y = 100;
    const i = addBody(w, { x: -200, y: -100, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    for (let k = 0; k < 60; k++) step(w, NO_INPUT);
    expect(w.x[i]).toBe(-200);
  });

  it('se traga lo que lo toca y crece', () => {
    const w = createWorld(cfg({ bhStartSpeed: 0, bhAccel: 0 }), 3, 10);
    w.bh.x = 200; w.bh.y = 100;
    const r0 = w.bh.radius;
    const i = addBody(w, { x: 201, y: 100, vx: 0, vy: 0, radius: 0.8, kind: KIND_ASTEROID });
    step(w, NO_INPUT);
    expect(w.state[i]).toBe(DEAD);
    expect(w.bh.radius).toBeGreaterThan(r0);
  });

  it('si se traga un planeta, sus lunas quedan sueltas', () => {
    const w = createWorld(cfg({ bhStartSpeed: 0, bhAccel: 0 }), 3, 10);
    w.bh.x = 200; w.bh.y = 100;
    const p = addBody(w, { x: 202, y: 100, vx: 0, vy: 0, radius: 3, kind: KIND_GAS });
    const m = addSatellite(w, p, 30, 0, 0.8, KIND_MOON, 0.1);
    step(w, NO_INPUT);
    expect(w.state[p]).toBe(DEAD);
    expect(w.state[m]).toBe(FREE);
    expect(w.parent[m]).toBe(-1);
  });

  it('si toca la estrella, se termina la partida y la simulación se detiene', () => {
    const w = createWorld(cfg({ bhStartSpeed: 0, bhAccel: 0 }), 3, 10);
    w.bh.x = 1; w.bh.y = 0;
    step(w, NO_INPUT);
    expect(w.over).toBe(OVER_SWALLOWED);
    const x = w.star.x, t = w.tick;
    step(w, { targetX: 50, targetY: 0, hasTarget: true });
    expect(w.star.x).toBe(x);
    expect(w.tick).toBe(t);
  });

  it('se puede desactivar (para pruebas y laboratorio)', () => {
    const w = createWorld(cfg({ blackHole: false }), 3, 10);
    expect(w.bh.active).toBe(false);
    const x = w.bh.x;
    for (let k = 0; k < 60; k++) step(w, NO_INPUT);
    expect(w.bh.x).toBe(x);
  });
});
