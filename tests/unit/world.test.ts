import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import {
  addBody, captureRadiusFor, createWorld, FREE, hashWorld, KIND_ASTEROID, KIND_GAS, KIND_ROCKY,
} from '../../src/sim/world';

const cfg: SimConfig = { ...DEFAULT_CONFIG, asteroidCount: 200, planetCount: 6 };

describe('createWorld', () => {
  it('crea los cuerpos pedidos, dentro de la arena y lejos del centro', () => {
    const w = createWorld(cfg, 5);
    expect(w.count).toBe(206);
    let asteroids = 0;
    let planets = 0;
    for (let i = 0; i < w.count; i++) {
      expect(Math.abs(w.x[i])).toBeLessThanOrEqual(cfg.arenaHalfWidth);
      expect(Math.abs(w.y[i])).toBeLessThanOrEqual(cfg.arenaHalfHeight);
      expect(Math.hypot(w.x[i], w.y[i])).toBeGreaterThanOrEqual(cfg.spawnClearRadius);
      expect(w.state[i]).toBe(FREE);
      if (w.kind[i] === KIND_ASTEROID) asteroids++;
      else if (w.kind[i] >= KIND_ROCKY && w.kind[i] <= KIND_GAS) planets++;
    }
    expect(asteroids).toBe(200);
    expect(planets).toBe(6);
  });

  it('es determinista para la misma semilla y cambia con otra', () => {
    expect(hashWorld(createWorld(cfg, 5))).toBe(hashWorld(createWorld(cfg, 5)));
    expect(hashWorld(createWorld(cfg, 5))).not.toBe(hashWorld(createWorld(cfg, 6)));
  });

  it('arranca con la estrella en el centro y el radio de captura según su masa', () => {
    const w = createWorld(cfg, 1);
    expect(w.star.x).toBe(0);
    expect(w.star.y).toBe(0);
    expect(w.star.mass).toBe(cfg.starStartMass);
    expect(w.star.captureRadius).toBe(captureRadiusFor(cfg, cfg.starStartMass));
  });
});

describe('addBody', () => {
  it('devuelve -1 cuando no queda lugar', () => {
    const w = createWorld({ ...cfg, asteroidCount: 0, planetCount: 0 }, 1, 1);
    const body = { x: 0, y: 0, vx: 0, vy: 0, radius: 1, kind: KIND_ASTEROID };
    expect(addBody(w, body)).toBe(0);
    expect(addBody(w, body)).toBe(-1);
    expect(w.count).toBe(1);
  });

  it('la masa es el radio al cubo', () => {
    const w = createWorld({ ...cfg, asteroidCount: 0, planetCount: 0 }, 1, 1);
    const i = addBody(w, { x: 1, y: 2, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    expect(w.mass[i]).toBeCloseTo(0.125, 12);
    expect(w.prevX[i]).toBe(1);
    expect(w.prevY[i]).toBe(2);
  });
});
