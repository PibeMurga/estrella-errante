import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { planetsInOrbit } from '../../src/sim/abilities';
import { breakPlanet } from '../../src/sim/tidal';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, DEAD, FREE, KIND_ROCKY, ORBITING } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 };
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };

describe('planeta partido en dos pedazos', () => {
  it('cada pedazo es un cuerpo que sigue por su cuenta; el planeta sigue contando como uno', () => {
    const w = createWorld(cfg, 3, 200);
    const p = addBody(w, { x: 120, y: 0, vx: 0, vy: 2, radius: 4, kind: KIND_ROCKY });
    const j = w.twin[p]!;
    expect(j).toBeGreaterThan(p);
    expect(w.state[j]).toBe(DEAD);
    const planets = w.planets.length;
    breakPlanet(w, p, 1, 0, false);
    expect(w.planets.length).toBe(planets);
    expect(w.state[j]).toBe(FREE);
    expect(w.halfSide[p]).toBe(1); expect(w.halfSide[j]).toBe(-1);
    expect(w.mass[p] + w.mass[j]).toBeCloseTo((4 * 0.85) ** 3, 3);
    // Se alejan por el eje del corte, en sentidos opuestos, y conservan el momento.
    expect(w.vx[p]).toBeGreaterThan(0); expect(w.vx[j]).toBeLessThan(0);
    expect(w.mass[p] * w.vx[p] + w.mass[j] * w.vx[j]).toBeCloseTo(0, 3);
    const d0 = Math.hypot(w.x[p] - w.x[j], w.y[p] - w.y[j]);
    for (let k = 0; k < 600; k++) step(w, idle);
    expect(Math.hypot(w.x[p] - w.x[j], w.y[p] - w.y[j])).toBeGreaterThan(d0 + 2);   // se separan despacio
  });

  it('para las habilidades, alcanza con tener uno de los dos pedazos', () => {
    const w = createWorld(cfg, 3, 200);
    const p = addBody(w, { x: 120, y: 0, vx: 0, vy: 0, radius: 4, kind: KIND_ROCKY });
    breakPlanet(w, p, 1, 0, false);
    const j = w.twin[p]!;
    w.state[j] = ORBITING;
    expect(planetsInOrbit(w)).toBe(1);
    w.state[p] = ORBITING;
    expect(planetsInOrbit(w)).toBe(1);
  });
});

describe('tus planetas en órbita', () => {
  it('no se enciman: si dos se tocan, se separan a lo largo de la órbita', () => {
    const w = createWorld(cfg, 3, 200);
    w.star.mass = 150;
    const mk = (a: number): number => {
      const p = addBody(w, { x: Math.cos(a) * 30, y: Math.sin(a) * 30, vx: 0, vy: 0, radius: 3, kind: KIND_ROCKY });
      w.state[p] = ORBITING; w.orbitR[p] = 30; w.orbitTarget[p] = 30; w.orbitAngle[p] = a; w.orbitW[p] = 0; w.orbitingCount++;
      return p;
    };
    const a = mk(0), b = mk(0.05);
    for (let k = 0; k < 600; k++) step(w, idle);
    expect(Math.hypot(w.x[a] - w.x[b], w.y[a] - w.y[b])).toBeGreaterThanOrEqual((w.radius[a] + w.radius[b]) * 0.98);
  });
});

describe('las dos mitades de un planeta partido', () => {
  it('no chocan entre sí: se separan despacio, sin golpes ni marcas', () => {
    const w = createWorld(cfg, 3, 200);
    const p = addBody(w, { x: 300, y: 200, vx: 0, vy: 0, radius: 6, kind: KIND_ROCKY });
    breakPlanet(w, p, 1, 0, false);
    const imp0 = w.impactCount, hits0 = w.contactHits;
    for (let k = 0; k < 180; k++) step(w, idle);
    expect(w.contactHits).toBe(hits0);
    expect(w.impactCount).toBe(imp0);
  });
});
