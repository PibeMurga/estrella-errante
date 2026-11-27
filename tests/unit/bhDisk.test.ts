import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, KIND_ASTEROID, OVER_NONE, OVER_SWALLOWED, ORBITING, type World } from '../../src/sim/world';

const cfg = (o: Partial<SimConfig> = {}): SimConfig => ({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9, bhStartSpeed: 0, bhAccel: 0, ...o });
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };

// Una estrella con 30 asteroides en órbita, lanzada a fondo hacia +x; el agujero negro quieto adelante, corrido `off` en y.
function flyBy(off: number, bh = true): World {
  const w = createWorld(cfg({ blackHole: bh }), 4, 60);
  w.star.mass = 30;
  for (let k = 0; k < 30; k++) {
    const a = (k / 30) * Math.PI * 2;
    const i = addBody(w, { x: Math.cos(a) * 9, y: Math.sin(a) * 9, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[i] = ORBITING; w.orbitR[i] = 9; w.orbitTarget[i] = 9; w.orbitAngle[i] = a; w.orbitingCount++;
  }
  for (let k = 0; k < 10; k++) step(w, idle);
  w.bh.x = w.bh.prevX = w.star.x + 60; w.bh.y = w.bh.prevY = w.star.y + off;
  w.star.vx = DEFAULT_CONFIG.starMaxSpeed; w.star.vy = 0;
  for (let k = 0; k < 240 && w.over === OVER_NONE; k++) step(w, { targetX: w.star.x + 500, targetY: w.star.y, hasTarget: true });
  return w;
}

describe('disco del agujero negro', () => {
  it('cruzar el disco cuesta: te arranca cuerpos de la órbita y masa, aunque pases rápido', () => {
    const free = flyBy(0, false), w = flyBy(15);
    expect(w.over).toBe(OVER_NONE);
    expect(w.orbitingCount).toBeLessThan(free.orbitingCount - 5);
    expect(w.star.mass).toBeLessThan(free.star.mass * 0.95);
    expect(w.diskGrazes).toBeGreaterThan(0);
  });

  it('pasar cerca del centro te traga, aunque vayas a toda velocidad', () => {
    expect(flyBy(8).over).toBe(OVER_SWALLOWED);
  });

  it('lejos del disco no pasa nada', () => {
    const free = flyBy(0, false), w = flyBy(45);
    expect(w.orbitingCount).toBe(free.orbitingCount);
  });
});
