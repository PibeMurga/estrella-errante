import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { starSize } from '../../src/sim/world';
import { addBody, addSatellite, BOLT, createWorld, DEAD, FREE, KIND_ASTEROID, KIND_MOON, KIND_ROCKY, ORBITING, PROJECTILE, type World } from '../../src/sim/world';

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

  it('si lo golpeás lo suficiente, tu planeta se parte pero sus pedazos siguen en tu órbita (no perdés nada)', () => {
    const { w, p } = withOwnPlanet();
    const n0 = w.orbitingCount, res0 = w.integrity;
    for (let k = 0; k < 40 && w.broken[p] === 0; k++) { shoot(w, w.x[p] - 3.6); step(w, idle); }
    expect(w.broken[p]).toBeGreaterThan(0);
    expect(w.state[p]).toBe(ORBITING);
    expect(w.state[w.twin[p]!]).toBe(ORBITING);
    expect(w.orbitingCount).toBe(n0 + 1);
    expect(w.integrity).toBeGreaterThanOrEqual(res0);
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

describe('las lunas de tus planetas', () => {
  it('de a poco pasan a ser tuyas', () => {
    const { w, p } = withOwnPlanet();
    const m = addSatellite(w, p, 6, 0, 0.6, KIND_MOON, 0.5);
    const m0 = w.star.mass;
    for (let k = 0; k < 60 * 40 && w.state[m] !== ORBITING; k++) step(w, idle);
    expect(w.state[m]).toBe(ORBITING);
    expect(w.parent[m]).toBe(-1);
    expect(w.star.mass).toBeGreaterThan(m0);
  });
});

describe('escudo de planetas', () => {
  it('mientras lo mantenés, tus planetas se juntan en un arco cerca tuyo, hacia donde apuntás', () => {
    const { w, p } = withOwnPlanet();
    const q = addBody(w, { x: -30, y: 0, vx: 0, vy: 0, radius: 3, kind: KIND_ROCKY });
    w.state[q] = ORBITING; w.orbitR[q] = 30; w.orbitTarget[q] = 30; w.orbitAngle[q] = Math.PI; w.orbitingCount++;
    const it: Intent = { targetX: 0, targetY: 0, hasTarget: false, shield: true, aimX: w.star.x, aimY: w.star.y + 100, hasAim: true };
    for (let k = 0; k < 120; k++) step(w, it);
    for (const b of [p, q]) {
      const a = Math.atan2(w.y[b] - w.star.y, w.x[b] - w.star.x);
      expect(Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)))).toBeLessThan(0.8);   // del lado de arriba
      expect(w.orbitR[b]).toBeLessThan(starSize(w.star.mass) * 1.25 + 6);   // pegados a vos
    }
  });
});
