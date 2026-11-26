import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import {
  addBody, captureRadiusFor, createWorld, FREE, hashWorld, KIND_ASTEROID, KIND_GAS, KIND_MOON, KIND_ROCKY, ORBIT_PLANET, DEAD,
} from '../../src/sim/world';

const cfg: SimConfig = { ...DEFAULT_CONFIG, asteroidCount: 200, planetCount: 6 };

describe('createWorld', () => {
  it('crea los cuerpos pedidos, dentro de la arena y lejos del centro', () => {
    const w = createWorld(cfg, 5);
    let asteroids = 0;
    let planets = 0;
    for (let i = 0; i < w.count; i++) {
      if (w.parent[i] >= 0) continue;   // lunas y cinturones se prueban aparte
      if (w.state[i] === DEAD) continue; // reserva de escombros para los cometas
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
    const w = createWorld({ ...cfg, asteroidCount: 0, planetCount: 0, debrisReserve: 0 }, 1, 1);
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

describe('mapa irregular', () => {
  const big = { ...DEFAULT_CONFIG, asteroidCount: 3000, planetCount: 30 };

  it('tiene campos densos y zonas casi vacías', () => {
    const w = createWorld(big, 11);
    const cols = 9, rows = 6;
    const cells = new Array(cols * rows).fill(0) as number[];
    let n = 0;
    for (let i = 0; i < w.count; i++) {
      if (w.kind[i] !== KIND_ASTEROID || w.parent[i] >= 0) continue;
      const cx = Math.min(cols - 1, Math.floor(((w.x[i] + big.arenaHalfWidth) / (2 * big.arenaHalfWidth)) * cols));
      const cy = Math.min(rows - 1, Math.floor(((w.y[i] + big.arenaHalfHeight) / (2 * big.arenaHalfHeight)) * rows));
      cells[cy * cols + cx]!++; n++;
    }
    const mean = n / cells.length;
    expect(Math.max(...cells)).toBeGreaterThan(mean * 2.5);
    expect(Math.min(...cells)).toBeLessThan(mean * 0.3);
  });

  it('cada semilla da un mapa distinto y la misma semilla el mismo', () => {
    expect(hashWorld(createWorld(big, 1))).toBe(hashWorld(createWorld(big, 1)));
    expect(hashWorld(createWorld(big, 1))).not.toBe(hashWorld(createWorld(big, 2)));
  });

  it('algunos planetas tienen lunas que los orbitan', () => {
    const w = createWorld(big, 11);
    let moons = 0;
    for (let i = 0; i < w.count; i++) {
      if (w.kind[i] !== KIND_MOON) continue;
      moons++;
      const p = w.parent[i]!;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(w.kind[p]).toBeGreaterThanOrEqual(KIND_ROCKY);
      expect(w.state[i]).toBe(ORBIT_PLANET);
      expect(Math.hypot(w.x[i] - w.x[p], w.y[i] - w.y[p])).toBeCloseTo(w.orbitR[i], 9);
    }
    expect(moons).toBeGreaterThan(3);
  });

  it('algunos planetas tienen su propio cinturón de escombros', () => {
    const w = createWorld(big, 11);
    let debris = 0;
    for (let i = 0; i < w.count; i++) if (w.kind[i] === KIND_ASTEROID && w.parent[i] >= 0) debris++;
    expect(debris).toBeGreaterThan(20);
  });

  it('hay asteroides cerca del punto de partida para empezar a jugar', () => {
    const w = createWorld(big, 11);
    let near = 0;
    for (let i = 0; i < w.count; i++) if (w.kind[i] === KIND_ASTEROID && Math.hypot(w.x[i], w.y[i]) < 70) near++;
    expect(near).toBeGreaterThan(25);
  });
});
