import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, KIND_ASTEROID, ORBITING, type World } from '../../src/sim/world';

const IDLE: Intent = { targetX: 0, targetY: 0, hasTarget: false };

function worldWithOrbit(angles: number[]): World {
  const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, eclipseMin: 3 }, 5, 400);
  for (const a of angles) {
    const i = addBody(w, { x: Math.cos(a) * 8, y: Math.sin(a) * 8, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    w.state[i] = ORBITING; w.orbitR[i] = 8; w.orbitTarget[i] = 8; w.orbitAngle[i] = a;
    w.orbitingCount++;
  }
  return w;
}

const angleDiff = (a: number, b: number): number => {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
};

describe('eclipses', () => {
  it('tres mundos alineados con la estrella producen un eclipse en esa dirección', () => {
    const w = worldWithOrbit([1.0, 1.03, 1.06, 3, 4.5]);
    step(w, IDLE);
    expect(w.eclipses).toBe(1);
    expect(w.eclipseStrength).toBe(3);
    const moved = DEFAULT_CONFIG.orbitSpeedK * Math.pow(DEFAULT_CONFIG.orbitMin / 8, 1.5) / 60;
    expect(angleDiff(w.eclipseAngle, 1.03 + moved)).toBeLessThan(0.02);
    expect(w.beamTime).toBeGreaterThan(0);
  });

  it('con muchos mundos repartidos parejo no hay eclipse: hace falta una concentración real', () => {
    const angles: number[] = [];
    for (let k = 0; k < 200; k++) angles.push((k / 200) * Math.PI * 2);
    const w = worldWithOrbit(angles);
    step(w, IDLE);
    expect(w.eclipses).toBe(0);
  });

  it('con dos alineados no hay eclipse', () => {
    const w = worldWithOrbit([1.0, 1.03, 3, 4.5]);
    step(w, IDLE);
    expect(w.eclipses).toBe(0);
  });

  it('también detecta la alineación al cruzar el ángulo cero', () => {
    const w = worldWithOrbit([Math.PI * 2 - 0.03, 0.0, 0.03 - Math.PI * 2 * 3]);
    step(w, IDLE);
    expect(w.eclipses).toBe(1);
  });

  it('respeta la recarga y el rayo se apaga', () => {
    const w = worldWithOrbit([1.0, 1.03, 1.06]);
    step(w, IDLE);
    step(w, IDLE);
    expect(w.eclipses).toBe(1);
    for (let k = 0; k < Math.ceil(DEFAULT_CONFIG.beamDuration * 60) + 1; k++) step(w, IDLE);
    expect(w.beamTime).toBe(0);
    for (let k = 0; k < Math.ceil(DEFAULT_CONFIG.eclipseCooldown * 60); k++) step(w, IDLE);
    expect(w.eclipses).toBe(2);
  });
});
