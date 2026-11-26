import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, FREE, KIND_ASTEROID, KIND_GAS, ORBITING, OVER_DIMMED, OVER_NONE, type World } from '../../src/sim/world';

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
    addBody(w, { x: 9, y: 0, vx: 0, vy: 0, radius: 6, kind: KIND_GAS });
    step(w, NO_INPUT);
    expect(w.orbitingCount).toBe(2);
    expect(w.star.vx).toBeLessThan(0);
    expect(w.invuln).toBeGreaterThan(0);
    expect(w.hits).toBe(1);
    let free = 0;
    for (let i = 0; i < w.count; i++) if (w.kind[i] === KIND_ASTEROID && w.state[i] === FREE) free++;
    expect(free).toBe(3);
  });

  it('los mundos perdidos no se vuelven a capturar enseguida', () => {
    const w = worldWithOrbit(5);
    addBody(w, { x: 9, y: 0, vx: 0, vy: 0, radius: 6, kind: KIND_GAS });
    for (let k = 0; k < 10; k++) step(w, NO_INPUT);
    expect(w.orbitingCount).toBe(2);
  });

  it('mientras dura la invulnerabilidad no vuelve a dañar', () => {
    const w = worldWithOrbit(5);
    const p = addBody(w, { x: 9, y: 0, vx: 0, vy: 0, radius: 6, kind: KIND_GAS });
    step(w, NO_INPUT);
    w.x[p] = w.star.x + 8; w.y[p] = w.star.y;
    step(w, NO_INPUT);
    expect(w.orbitingCount).toBe(2);
    expect(w.hits).toBe(1);
  });

  it('sin mundos que la protejan, la estrella se apaga y termina la partida', () => {
    const w = worldWithOrbit(0);
    addBody(w, { x: 9, y: 0, vx: 0, vy: 0, radius: 6, kind: KIND_GAS });
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
