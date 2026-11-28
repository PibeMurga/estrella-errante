import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { damageBody } from '../../src/sim/integrity';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, KIND_ASTEROID, KIND_ROCKY, ORBITING, starSize } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 };
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };

describe('resistencia de tu cuerpo', () => {
  it('arranca llena, un golpe la baja rápido y se recarga despacio', () => {
    const w = createWorld(cfg, 3, 40);
    expect(w.integrity).toBe(1);
    damageBody(w, 0.4);
    expect(w.integrity).toBeCloseTo(0.6, 5);
    for (let k = 0; k < 60; k++) step(w, idle);
    expect(w.integrity).toBeGreaterThan(0.6);
    expect(w.integrity).toBeLessThan(0.7);   // lento: unos pocos por ciento por segundo
  });
  it('si llega a cero, tu cuerpo se fractura: pierde masa y órbita, y la barra vuelve desde abajo', () => {
    const w = createWorld(cfg, 3, 60);
    w.star.mass = 80;
    for (let k = 0; k < 20; k++) {
      const i = addBody(w, { x: 9, y: k, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
      w.state[i] = ORBITING; w.orbitR[i] = 9; w.orbitTarget[i] = 9; w.orbitAngle[i] = k; w.orbitingCount++;
    }
    damageBody(w, 0.7); damageBody(w, 0.7);
    expect(w.fractures).toBe(1);
    expect(w.star.mass).toBeLessThan(80 * 0.75);
    expect(w.orbitingCount).toBeLessThan(15);
    expect(w.integrity).toBeGreaterThan(0.2);
  });
  it('partir un planeta más chico al chocarlo también te cuesta un poco de resistencia', () => {
    const w = createWorld(cfg, 3, 40);
    w.star.mass = 60;
    const E = starSize(w.star.mass), r = E * 0.8;   // más chico que vos, pero no tanto como para entrar solo
    const p = addBody(w, { x: E + r + 0.5, y: 0, vx: -12, vy: 0, radius: r, kind: KIND_ROCKY });
    w.planets = Int32Array.of(p);
    for (let k = 0; k < 30 && w.smallHits === 0; k++) step(w, idle);
    expect(w.smallHits).toBe(1);
    expect(w.integrity).toBeLessThan(0.97);
    expect(w.integrity).toBeGreaterThan(0.6);   // un poco, no un golpe grave
  });
});
