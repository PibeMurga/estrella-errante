import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { playerHoleRadius } from '../../src/sim/phase';
import { type Intent, step } from '../../src/sim/step';
import { addBody, addSatellite, createWorld, DEAD, KIND_ASTEROID, KIND_MOON, KIND_ROCKY, ORBITING, PHASE_HUNT, starSize, type World } from '../../src/sim/world';

// Pedido de Lucas (27/11): que nada se sienta duro. Tu agujero negro aspira; un planeta que se suma se imanta.
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const run = (w: World, s: number): void => { for (let k = 0; k < Math.round(s * 60); k++) step(w, idle); };

function hunting(): World {
  const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9, huntTimeLimit: 1e9 }, 3, 60);
  w.star.mass = 600; w.bh.mass = 2;
  w.bh.x = w.bh.prevX = 250; w.bh.y = w.bh.prevY = 0;
  step(w, idle);
  run(w, w.config.collapseTime + 0.1);
  expect(w.phase).toBe(PHASE_HUNT);
  return w;
}

describe('tu agujero negro aspira', () => {
  it('lo que pasa cerca de costado no sigue de largo: cae en espiral y se lo traga', () => {
    const w = hunting();
    const R = playerHoleRadius(w);
    const a = addBody(w, { x: w.star.x - R * 4, y: w.star.y, vx: 0, vy: 25, radius: 0.8, kind: KIND_ASTEROID });
    let closest = Infinity;
    for (let k = 0; k < 60 * 4 && w.state[a] !== DEAD; k++) { step(w, idle); closest = Math.min(closest, Math.hypot(w.x[a] - w.star.x, w.y[a] - w.star.y)); }
    expect(w.state[a]).toBe(DEAD);
  });
  it('lo atrae desde lejos (varias veces su radio)', () => {
    const w = hunting();
    const R = playerHoleRadius(w);
    const a = addBody(w, { x: w.star.x - R * 6, y: w.star.y, vx: 0, vy: 0, radius: 0.8, kind: KIND_ASTEROID });
    const d0 = R * 6;
    run(w, 0.5);
    expect(Math.hypot(w.x[a] - w.star.x, w.y[a] - w.star.y)).toBeLessThan(d0 - 1);
  });
  it('arranca las lunas de su planeta y también se las traga', () => {
    const w = hunting();
    const R = playerHoleRadius(w);
    const p = addBody(w, { x: w.star.x - R * 5, y: w.star.y, vx: 0, vy: 0, radius: 3, kind: KIND_ROCKY });
    const m = addSatellite(w, p, 6, 0, 0.6, KIND_MOON, 1);
    run(w, 5);
    expect(w.state[p]).toBe(DEAD);
    expect(w.state[m]).toBe(DEAD);
  });
});

describe('un planeta que se suma se imanta', () => {
  it('al atraparlo conserva su giro y se acomoda de a poco a la órbita', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 }, 9, 40);
    w.star.mass = 100;
    const E = starSize(100);
    // Viene de costado: al cruzar el borde de su franja tiene un giro propio alrededor de la estrella.
    const p = addBody(w, { x: 60, y: -20, vx: -8, vy: 6, radius: E * 0.4, kind: KIND_ROCKY });   // se acerca de costado
    let a0 = NaN, w0 = NaN;
    for (let k = 0; k < 600 && w.state[p] !== ORBITING; k++) step(w, idle);
    expect(w.state[p]).toBe(ORBITING);
    const relW = ((w.x[p] - w.star.x) * (w.vy[p] - w.star.vy) - (w.y[p] - w.star.y) * (w.vx[p] - w.star.vx)) / (w.orbitR[p] ** 2);
    a0 = w.orbitAngle[p];
    step(w, idle);
    w0 = (w.orbitAngle[p] - a0) * 60;
    expect(Math.abs(w0 - relW)).toBeLessThan(Math.abs(relW) * 0.25 + 0.02);   // sin salto: sigue girando como venía
    run(w, w.config.planetJoinTime + 0.5);
    const a1 = w.orbitAngle[p]; step(w, idle);
    const wOrbit = w.config.orbitSpeedK * Math.pow(w.config.orbitMin / w.orbitR[p], 1.5);
    expect((w.orbitAngle[p] - a1) * 60).toBeCloseTo(wOrbit, 3);       // ya acoplado a la órbita
  });
});

describe('tu sistema cae a tu agujero negro', () => {
  it('lo que tenías en órbita se aspira de a poco al centro, sin sumar la masa dos veces', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9, huntTimeLimit: 1e9 }, 3, 60);
    w.star.mass = 600; w.bh.mass = 2;
    w.bh.x = w.bh.prevX = 250; w.bh.y = w.bh.prevY = 0;
    const ids: number[] = [];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ids.push(addBody(w, { x: Math.cos(a) * 30, y: Math.sin(a) * 30, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID })); }
    w.bh.mass = 100;                 // primero captura (con el rival más pesado no colapsa todavía)
    run(w, 1);
    expect(ids.every((i) => w.state[i] === ORBITING)).toBe(true);
    w.bh.mass = 2;                   // ahora lo supera: colapsa solo
    run(w, w.config.collapseTime + 0.2);
    expect(w.phase).toBe(PHASE_HUNT);
    const m0 = w.star.mass;
    const alive = (): number => ids.filter((i) => w.state[i] === ORBITING).length;
    const r0 = w.orbitR[ids[0]!]!;
    run(w, 2);
    expect(alive()).toBeGreaterThan(6);                 // de a poco: no desaparecen todos juntos
    expect(w.orbitR[ids[0]!]!).toBeLessThan(r0);       // van cayendo
    run(w, 40);
    expect(alive()).toBe(0);                            // al final se los tragó a todos
    expect(w.star.mass).toBeCloseTo(m0, 6);             // ya estaban contados en tu masa
  });
});
