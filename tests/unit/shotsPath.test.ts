import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, BOLT, createWorld, DEAD, FREE, KIND_ASTEROID, KIND_ROCKY, ORBITING, PROJECTILE, type World } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9, rockShatterChance: 0 };
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };

function withOwnPlanet(): { w: World; p: number } {
  const w = createWorld(cfg, 6, 120);
  w.star.mass = 150;
  step(w, idle);
  const p = addBody(w, { x: 30, y: 0, vx: 0, vy: 0, radius: 3, kind: KIND_ROCKY });
  w.state[p] = ORBITING; w.orbitR[p] = 30; w.orbitTarget[p] = 30; w.orbitAngle[p] = 0; w.orbitW[p] = 0; w.orbitingCount++;
  return { w, p };
}
const shoot = (w: World, x: number, state = PROJECTILE): number => {
  const a = addBody(w, { x, y: 0, vx: 50, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
  w.state[a] = state; w.life[a] = 2;
  return a;
};

describe('lo que hay en el camino del disparo', () => {
  it('tus propios planetas son obstáculo: el disparo choca contra ellos y los daña', () => {
    const { w, p } = withOwnPlanet();
    const a = shoot(w, 30 - 3.6);
    step(w, idle);
    expect(w.state[a]).not.toBe(PROJECTILE);
    expect(w.planetDmg[p]).toBeGreaterThan(0);
  });

  it('si lo golpeás lo suficiente, tu planeta se parte y los pedazos salen de tu órbita', () => {
    const { w, p } = withOwnPlanet();
    const n0 = w.orbitingCount;
    for (let k = 0; k < 40 && w.broken[p] === 0; k++) { shoot(w, w.x[p] - 3.6); step(w, idle); }
    expect(w.broken[p]).toBeGreaterThan(0);
    expect(w.state[p]).toBe(FREE);
    expect(w.orbitingCount).toBeLessThan(n0);
  });

  it('un bólido grande se abre paso: rompe los asteroides sueltos que encuentra y sigue', () => {
    const w = createWorld(cfg, 6, 120);
    step(w, idle);
    w.lastBoltSize = 12;
    const b = shoot(w, 40, BOLT);
    const rock = addBody(w, { x: 41.5, y: 0, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    step(w, idle); step(w, idle);
    expect(w.state[rock]).toBe(DEAD);
    expect(w.state[b]).toBe(BOLT);
  });

  it('uno chico, no: los asteroides sueltos siguen ahí', () => {
    const w = createWorld(cfg, 6, 120);
    step(w, idle);
    w.lastBoltSize = 3;
    shoot(w, 40, BOLT);
    const rock = addBody(w, { x: 41.5, y: 0, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    step(w, idle); step(w, idle);
    expect(w.state[rock]).toBe(FREE);
  });
});

describe('lo que tenés en órbita choca', () => {
  it('un asteroide suelto que cruza uno de tus planetas se hace pedazos', () => {
    const { w, p } = withOwnPlanet();
    const a = addBody(w, { x: w.x[p] - 3.4, y: w.y[p], vx: 2, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    w.noCatch[a] = 5;   // que no lo capture la estrella antes
    step(w, idle);
    expect(w.state[a]).toBe(DEAD);
  });
  it('si un planeta tuyo choca con uno suelto bastante más grande, el tuyo se rompe y sale de tu órbita (sin rebote)', () => {
    const { w, p } = withOwnPlanet();
    const f = addBody(w, { x: w.x[p] + 9.8, y: w.y[p], vx: -6, vy: 0, radius: 7, kind: KIND_ROCKY });
    w.noCatch[f] = 5;
    for (let k = 0; k < 10; k++) step(w, idle);
    expect(w.state[p]).not.toBe(ORBITING);
    expect(w.impactCount).toBeGreaterThan(0);
  });
});
