import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, DT, type SimConfig } from '../../src/sim/config';
import { type Intent, orbitBandWidth, step } from '../../src/sim/step';
import {
  addBody, addSatellite, captureRadiusFor, starSize, createWorld, FREE, hashWorld, KIND_ASTEROID, KIND_GAS, KIND_MOON, ORBIT_PLANET, ORBITING, DEAD, ABSORBING } from '../../src/sim/world';

const NO_INPUT: Intent = { targetX: 0, targetY: 0, hasTarget: false };

function emptyWorld(extra = 10, overrides: Partial<SimConfig> = {}) {
  return createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, ...overrides }, 1, extra);
}

function rock(x: number, y: number, radius = 0.5, vx = 0, vy = 0) {
  return { x, y, vx, vy, radius, kind: KIND_ASTEROID };
}

describe('estrella', () => {
  it('arranca de a poco: tiene inercia', () => {
    const w = emptyWorld();
    step(w, { targetX: 100, targetY: 0, hasTarget: true });
    expect(w.star.x).toBeGreaterThan(0);
    expect(w.star.x).toBeLessThan(DEFAULT_CONFIG.starMaxSpeed * DT * 0.25);
    expect(w.star.y).toBe(0);
  });

  it('nunca supera la velocidad máxima', () => {
    const w = emptyWorld();
    for (let i = 0; i < 600; i++) {
      step(w, { targetX: 150, targetY: 0, hasTarget: true });
      expect(Math.hypot(w.star.vx, w.star.vy)).toBeLessThanOrEqual(DEFAULT_CONFIG.starMaxSpeed + 1e-9);
    }
  });

  it('llega al objetivo frenando, sin pasarse de largo', () => {
    const w = emptyWorld();
    let maxX = 0;
    for (let i = 0; i < 60 * 12; i++) { step(w, { targetX: 40, targetY: 0, hasTarget: true }); maxX = Math.max(maxX, w.star.x); }
    expect(w.star.x).toBeCloseTo(40, 1);
    expect(Math.hypot(w.star.vx, w.star.vy)).toBeLessThan(0.5);
    expect(maxX).toBeLessThan(40.5);
  });

  it('la masa le cuesta, pero siendo grande se mueve parecido en pantalla (más rápido en absoluto)', () => {
    const light = emptyWorld();
    const heavy = emptyWorld();
    heavy.star.mass = 200;
    for (let i = 0; i < 60; i++) {
      step(light, { targetX: 150, targetY: 0, hasTarget: true });
      step(heavy, { targetX: 150, targetY: 0, hasTarget: true });
    }
    expect(heavy.star.x).toBeGreaterThan(light.star.x * 0.6);
    expect(heavy.star.x).toBeLessThan(light.star.x * 2.5);
  });

  it('al soltar sigue de largo y frena de a poco', () => {
    const w = emptyWorld(10, { blackHole: false });   // sin nada que la arrastre
    for (let i = 0; i < 120; i++) step(w, { targetX: 150, targetY: 0, hasTarget: true });
    const x0 = w.star.x;
    step(w, NO_INPUT);
    expect(w.star.x).toBeGreaterThan(x0);
    for (let i = 0; i < 60 * 40; i++) step(w, NO_INPUT);   // suelto: frena muy de a poco (te llevan las fuerzas de alrededor)
    expect(Math.hypot(w.star.vx, w.star.vy)).toBeLessThan(0.01);
  });

  it('ignora objetivos inválidos y no produce NaN', () => {
    const w = emptyWorld();
    step(w, { targetX: Number.NaN, targetY: 5, hasTarget: true });
    step(w, { targetX: Number.POSITIVE_INFINITY, targetY: 5, hasTarget: true });
    expect(w.star.x).toBe(0);
    expect(w.star.y).toBe(0);
  });

  it('sin objetivo queda quieta', () => {
    const w = emptyWorld();
    for (let i = 0; i < 10; i++) step(w, NO_INPUT);
    expect(w.star.x).toBe(0);
    expect(w.star.y).toBe(0);
  });

  it('guarda la posición anterior para interpolar', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(50, 80, 0.5, 60, 0));
    step(w, { targetX: 100, targetY: 0, hasTarget: true });
    expect(w.star.prevX).toBe(0);
    expect(w.prevX[i]).toBe(50);
    expect(w.x[i]).toBeCloseTo(51, 10);
  });
});

describe('cuerpos libres', () => {
  it('se mueven y reaparecen del otro lado al cruzar el borde', () => {
    const w = emptyWorld();
    const hw = DEFAULT_CONFIG.arenaHalfWidth;
    const i = addBody(w, rock(hw - 0.01, 80, 0.5, 60, 0));
    step(w, NO_INPUT);
    expect(w.x[i]).toBeCloseTo(-hw + 0.99, 10);
    expect(w.state[i]).toBe(FREE);
  });
});

describe('captura', () => {
  it('captura un asteroide chico dentro del radio', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(3, 0, 0.5));
    step(w, NO_INPUT);
    expect(w.state[i]).toBe(ORBITING);
    expect(w.orbitingCount).toBe(1);
    expect(w.capturedCount).toBe(1);
    expect(w.captured[0]).toBe(i);
    expect(w.star.mass).toBeCloseTo(DEFAULT_CONFIG.starStartMass + 0.125 * DEFAULT_CONFIG.bodyMassGain, 12);   // suma una parte de su masa
    expect(w.star.captureRadius).toBeCloseTo(captureRadiusFor(w.config, w.star.mass), 12);
  });

  it('no captura cuerpos más grandes que el límite: si la tocan, la golpean y se funden en ella', () => {
    const w = emptyWorld();
    const m0 = w.star.mass;
    const i = addBody(w, rock(3, 0, 3));
    step(w, NO_INPUT);
    expect(w.state[i]).toBe(DEAD);
    expect(w.orbitingCount).toBe(0);
    expect(w.rockHits).toBe(1);
    expect(w.star.mass).toBeGreaterThan(m0);
  });
  it('el golpe de una roca te baja un poquito la resistencia', () => {
    const w = emptyWorld();
    addBody(w, { ...rock(3, 0, 1.6), vx: -24, vy: 0 });
    step(w, NO_INPUT);
    expect(w.rockHits).toBe(1);
    expect(w.integrity).toBeLessThan(1);
    expect(w.integrity).toBeGreaterThan(0.8);
  });
  it('un asteroide veloz tampoco se suma: pasa de largo si no te toca', () => {
    const w = emptyWorld();
    const i = addBody(w, { ...rock(9, 0, 0.5), vx: 0, vy: 8 });
    step(w, NO_INPUT);
    expect(w.state[i]).toBe(FREE);
  });

  it('con la órbita llena, la estrella absorbe el resto: suma su masa, cae en espiral y desaparece', () => {
    const w = emptyWorld(10, { orbitCapacity: 2 });
    addBody(w, rock(2, 0));
    addBody(w, rock(0, 2));
    const last = addBody(w, rock(-2, 0));
    const m0 = w.star.mass;
    step(w, NO_INPUT);
    expect(w.orbitingCount).toBe(2);
    expect(w.state[last]).toBe(ABSORBING);   // no desaparece de golpe: se lo ve caer
    expect(w.star.mass).toBeCloseTo(m0 + (w.mass[0] + w.mass[1] + w.mass[last]) * DEFAULT_CONFIG.bodyMassGain, 9);
    expect(w.absorbed).toBe(1);
    for (let k = 0; k < 120; k++) step(w, NO_INPUT);
    expect(w.state[last]).toBe(DEAD);
    expect(w.absorbed).toBe(1);
  });

  it('el capturado termina orbitando a su radio de órbita y gira', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(3, 0, 0.5));
    step(w, NO_INPUT);
    const startAngle = w.orbitAngle[i];
    for (let k = 0; k < 600; k++) step(w, NO_INPUT);
    { const d = Math.hypot(w.x[i] - w.star.x, w.y[i] - w.star.y), lo = orbitFloor(w.star.mass); expect(d).toBeGreaterThanOrEqual(lo - 1e-6); expect(d).toBeLessThanOrEqual(lo + orbitBandWidth(w.config, w.star.mass) + 1e-6); }   // en su cinturón
    expect(w.orbitAngle[i]).toBeGreaterThan(startAngle + 1);
  });

  it('el capturado acompaña a la estrella cuando se mueve', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(3, 0, 0.5));
    for (let k = 0; k < 600; k++) step(w, NO_INPUT);
    for (let k = 0; k < 120; k++) step(w, { targetX: 60, targetY: 30, hasTarget: true });
    { const d = Math.hypot(w.x[i] - w.star.x, w.y[i] - w.star.y), lo = orbitFloor(w.star.mass); expect(d).toBeGreaterThanOrEqual(lo - 1e-6); expect(d).toBeLessThanOrEqual(lo + orbitBandWidth(w.config, w.star.mass) + 1e-6); }   // en su cinturón
  });

  it('las órbitas nunca quedan adentro de la estrella, aunque crezca mucho', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(3, 0, 0.5));
    step(w, NO_INPUT);
    w.star.mass = 250;   // supergigante (con 300 ya sería hipergigante y colapsaría sola)
    for (let k = 0; k < 600; k++) step(w, NO_INPUT);
    const d = Math.hypot(w.x[i] - w.star.x, w.y[i] - w.star.y);
    expect(d).toBeGreaterThanOrEqual(starSize(w.star.mass) * DEFAULT_CONFIG.orbitClearance - 1e-6);
  });

  it('al capturarlo se acerca a su órbita de a poco, sin saltar', () => {
    const w = emptyWorld();
    w.star.mass = 300; w.star.captureRadius = captureRadiusFor(w.config, 300);
    const i = addBody(w, rock(w.star.captureRadius - 0.5, 0, 0.5));
    step(w, NO_INPUT);
    expect(w.state[i]).toBe(ORBITING);
    let prev = w.orbitR[i]!, maxStep = 0;
    for (let k = 0; k < 300; k++) { step(w, NO_INPUT); maxStep = Math.max(maxStep, Math.abs(w.orbitR[i]! - prev)); prev = w.orbitR[i]!; }
    expect(maxStep).toBeLessThanOrEqual(DEFAULT_CONFIG.orbitInfallSpeed * DT + 1e-9);
  });
});

// Radio de la órbita más baja para una estrella de esa masa.
function orbitFloor(mass: number): number {
  return Math.max(DEFAULT_CONFIG.orbitMin, starSize(mass) * DEFAULT_CONFIG.orbitClearance);
}

describe('determinismo', () => {
  it('misma semilla y mismas órdenes dan la misma partida', () => {
    const run = (): { hash: number; orbiting: number } => {
      const w = createWorld(DEFAULT_CONFIG, 99);
      const intent: Intent = { targetX: 0, targetY: 0, hasTarget: true };
      for (let k = 0; k < 1200; k++) {
        intent.targetX = 100 * Math.sin(k * 0.01);
        intent.targetY = 50 * Math.cos(k * 0.013);
        step(w, intent);
      }
      return { hash: hashWorld(w), orbiting: w.orbitingCount };
    };
    const a = run();
    const b = run();
    expect(a.hash).toBe(b.hash);
    expect(a.orbiting).toBeGreaterThan(0);
  }, 20000);   // el mapa es grande: tarda unos segundos
});

describe('lunas y cinturones de planetas', () => {
  it('las lunas acompañan a su planeta y giran', () => {
    const w = emptyWorld(10);
    const p = addBody(w, { x: 100, y: 50, vx: 3, vy: -2, radius: 5, kind: KIND_GAS });
    const m = addSatellite(w, p, 12, 0, 0.8, KIND_MOON, 0.5);
    for (let k = 0; k < 120; k++) step(w, NO_INPUT);
    expect(Math.hypot(w.x[m] - w.x[p], w.y[m] - w.y[p])).toBeCloseTo(12, 9);
    expect(w.orbitAngle[m]).toBeCloseTo(1, 6);
    expect(w.state[m]).toBe(ORBIT_PLANET);
  });

  it('no puede robarle lunas a un planeta más grande que ella', () => {
    const w = emptyWorld(10);
    const p = addBody(w, { x: 12, y: 0, vx: 0, vy: 0, radius: 5, kind: KIND_GAS });
    const m = addSatellite(w, p, 9, Math.PI, 0.8, KIND_MOON, 0.2);
    step(w, NO_INPUT);
    expect(w.state[m]).toBe(ORBIT_PLANET);
    expect(w.parent[m]).toBe(p);
    expect(w.orbitingCount).toBe(0);
  });

  it('la estrella, si es mucho más grande, puede robarle una luna a un planeta', () => {
    const w = emptyWorld(10);
    w.star.mass = 100;
    expect(starSize(w.star.mass)).toBeGreaterThanOrEqual(5 * DEFAULT_CONFIG.stealSizeRatio);
    const p = addBody(w, { x: 12, y: 0, vx: 0, vy: 0, radius: 5, kind: KIND_GAS });
    const m = addSatellite(w, p, 9, Math.PI, 0.8, KIND_MOON, 0.2);
    step(w, NO_INPUT);
    expect(w.state[m]).toBe(ORBITING);
    expect(w.parent[m]).toBe(-1);
    expect(w.orbitingCount).toBeGreaterThanOrEqual(1);   // (el planeta, chico al lado de la estrella, también puede entrar)
  });
});

describe('cruce de borde (revisión final)', () => {
  it('al reaparecer del otro lado, la posición anterior se corre igual (sin interpolar por el medio)', () => {
    const w = emptyWorld();
    const hw = DEFAULT_CONFIG.arenaHalfWidth;
    const i = addBody(w, rock(hw - 0.01, 80, 0.5, 60, 0));
    step(w, NO_INPUT);
    expect(Math.abs(w.x[i] - w.prevX[i])).toBeLessThan(2);
  });

  it('las lunas de un planeta que cruza el borde tampoco saltan', () => {
    const w = emptyWorld(10);
    const hw = DEFAULT_CONFIG.arenaHalfWidth;
    const p = addBody(w, { x: hw - 0.01, y: 80, vx: 60, vy: 0, radius: 5, kind: KIND_GAS });
    const m = addSatellite(w, p, 12, 0, 0.8, KIND_MOON, 0.5);
    step(w, NO_INPUT);
    expect(Math.abs(w.x[p] - w.prevX[p])).toBeLessThan(2);
    expect(Math.abs(w.x[m] - w.prevX[m])).toBeLessThan(2);
  });
});
