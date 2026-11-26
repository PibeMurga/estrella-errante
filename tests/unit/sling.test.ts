import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, FREE, KIND_ASTEROID, ORBITING, PROJECTILE, RETURNING, type World } from '../../src/sim/world';

const IDLE: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const aim = (x: number, y: number, fire = true): Intent => ({ targetX: x, targetY: y, hasTarget: true, fire });

function worldWithOrbit(angles: number[]): { w: World; ids: number[] } {
  const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false }, 5, 40);
  const ids = angles.map((a) => {
    const i = addBody(w, { x: Math.cos(a) * 8, y: Math.sin(a) * 8, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    w.state[i] = ORBITING; w.orbitR[i] = 8; w.orbitTarget[i] = 8; w.orbitAngle[i] = a;
    w.orbitingCount++;
    w.star.mass += w.mass[i];
    return i;
  });
  return { w, ids };
}

describe('honda', () => {
  it('lanza el mundo en órbita más alineado con la mira', () => {
    const { w, ids } = worldWithOrbit([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    step(w, aim(0, 50));
    expect(w.state[ids[1]!]).toBe(PROJECTILE);
    expect(w.orbitingCount).toBe(3);
    expect(w.vy[ids[1]!]).toBeGreaterThan(50);
    expect(w.shots).toBe(1);
  });

  it('respeta el tiempo de recarga', () => {
    const { w } = worldWithOrbit([0, 1, 2, 3]);
    step(w, aim(50, 0));
    step(w, aim(50, 0));
    expect(w.orbitingCount).toBe(3);
    for (let k = 0; k < Math.ceil(DEFAULT_CONFIG.slingCooldown * 60); k++) step(w, aim(50, 0, false));
    step(w, aim(50, 0));
    expect(w.orbitingCount).toBe(2);
  });

  it('el proyectil viaja, después vuelve y se reincorpora a la órbita', () => {
    const { w, ids } = worldWithOrbit([0]);
    step(w, aim(50, 0));
    for (let k = 0; k < 60; k++) step(w, IDLE);
    expect(Math.hypot(w.x[ids[0]!] - w.star.x, w.y[ids[0]!] - w.star.y)).toBeGreaterThan(40);
    let back = false;
    for (let k = 0; k < 60 * 8 && !back; k++) { step(w, IDLE); back = w.state[ids[0]!] === ORBITING; }
    expect(back).toBe(true);
    expect(w.orbitingCount).toBe(1);
  });

  it('si al volver quedó demasiado lejos, se pierde', () => {
    const { w, ids } = worldWithOrbit([0]);
    const m0 = w.star.mass;
    step(w, aim(50, 0));
    const i = ids[0]!;
    w.x[i] = w.star.x + DEFAULT_CONFIG.slingLoseDist + 50;
    let lost = false;
    for (let k = 0; k < 60 * 4 && !lost; k++) { step(w, IDLE); lost = w.state[i] === FREE; }
    expect(lost).toBe(true);
    expect(w.state[i]).not.toBe(RETURNING);
    expect(w.star.mass).toBeLessThan(m0);
  });

  it('sin mundos en órbita no pasa nada', () => {
    const { w } = worldWithOrbit([]);
    step(w, aim(50, 0));
    expect(w.shots).toBe(0);
  });
});
