import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, starSize, FREE, KIND_ASTEROID, KIND_GAS, ORBITING, OVER_DIMMED, OVER_NONE, OVER_SHATTERED, type World } from '../../src/sim/world';

const NO_INPUT: Intent = { targetX: 0, targetY: 0, hasTarget: false };

function worldWithOrbit(worlds: number): World {
  const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false }, 5, 40);
  for (let k = 0; k < worlds; k++) {
    const a = (k / worlds) * Math.PI * 2;
    const i = addBody(w, { x: Math.cos(a) * 6, y: Math.sin(a) * 6, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    w.state[i] = ORBITING; w.orbitR[i] = 6; w.orbitTarget[i] = 6; w.orbitAngle[i] = a;
    w.orbitingCount++;
    w.star.mass += w.mass[i];
  }
  return w;
}

describe('planetas que dañan', () => {
  it('chocar con un planeta más grande hace perder mundos y rebotar', () => {
    const w = worldWithOrbit(5);
    addBody(w, { x: 4.4, y: 0, vx: 0, vy: 0, radius: 2.6, kind: KIND_GAS });
    step(w, NO_INPUT);
    const left = w.orbitingCount;
    expect(left).toBeLessThanOrEqual(2);   // siendo chica, pierde más
    expect(w.star.vx).toBeLessThan(0);
    expect(w.invuln).toBeGreaterThan(0);
    expect(w.hits).toBe(1);
    let free = 0;
    for (let i = 0; i < w.count; i++) if (w.kind[i] === KIND_ASTEROID && w.state[i] === FREE) free++;
    expect(free).toBe(5 - left);
  });

  it('los mundos perdidos no se vuelven a capturar enseguida', () => {
    const w = worldWithOrbit(5);
    addBody(w, { x: 4.4, y: 0, vx: 0, vy: 0, radius: 2.6, kind: KIND_GAS });
    step(w, NO_INPUT);
    const left = w.orbitingCount;
    for (let k = 0; k < 9; k++) step(w, NO_INPUT);
    expect(w.orbitingCount).toBe(left);
  });

  it('mientras dura la invulnerabilidad no vuelve a dañar', () => {
    const w = worldWithOrbit(5);
    const p = addBody(w, { x: 4.4, y: 0, vx: 0, vy: 0, radius: 2.6, kind: KIND_GAS });
    step(w, NO_INPUT);
    const left = w.orbitingCount;
    w.x[p] = w.star.x + 4.2; w.y[p] = w.star.y;
    step(w, NO_INPUT);
    expect(w.orbitingCount).toBe(left);
    expect(w.hits).toBe(1);
  });

  it('sin mundos que la protejan, la estrella se apaga y termina la partida', () => {
    const w = worldWithOrbit(0);
    addBody(w, { x: 4.0, y: 0, vx: 0, vy: 0, radius: 2.6, kind: KIND_GAS });
    step(w, NO_INPUT);
    expect(w.over).toBe(OVER_DIMMED);
  });

  it('un planeta más chico que la estrella no daña', () => {
    const w = worldWithOrbit(5);
    addBody(w, { x: 6, y: 0, vx: 0, vy: 0, radius: 3, kind: KIND_GAS });
    step(w, NO_INPUT);
    expect(w.orbitingCount).toBe(5);
    expect(w.over).toBe(OVER_NONE);
  });
});

describe('cuanto más grande el planeta, más duele', () => {
  function big(n: number): World {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 }, 5, n + 10);
    w.star.mass = 100;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const i = addBody(w, { x: Math.cos(a) * 24, y: Math.sin(a) * 24, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
      w.state[i] = ORBITING; w.orbitR[i] = 24; w.orbitTarget[i] = 24; w.orbitAngle[i] = a; w.orbitingCount++;
    }
    return w;
  }
  it('chocar con uno 1,4 veces tu tamaño te saca bastante órbita y masa; con uno apenas más grande, menos', () => {
    const E = starSize(100);
    const fuerte = big(100), leve = big(100);
    const m0 = fuerte.star.mass;
    addBody(fuerte, { x: E + 1, y: 0, vx: 0, vy: 0, radius: E * 1.4, kind: KIND_GAS });
    addBody(leve, { x: E + 1, y: 0, vx: 0, vy: 0, radius: E * 1.05, kind: KIND_GAS });
    step(fuerte, NO_INPUT); step(leve, NO_INPUT);
    expect(100 - fuerte.orbitingCount).toBeGreaterThanOrEqual(30);
    expect(100 - leve.orbitingCount).toBeGreaterThanOrEqual(12);
    expect(100 - fuerte.orbitingCount).toBeGreaterThan(100 - leve.orbitingCount);
    expect(fuerte.star.mass).toBeLessThan(m0 * 0.92);
  });
});

describe('choque desproporcionado', () => {
  it('contra algo de más del doble de tu tamaño, tu mundo se hace pedazos', () => {
    const w = worldWithOrbit(5);
    addBody(w, { x: 11, y: 0, vx: 0, vy: 0, radius: 9.5, kind: KIND_GAS });
    step(w, NO_INPUT);
    expect(w.over).toBe(OVER_SHATTERED);
  });
});
