import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { createDangerMarksLayer } from '../../src/render/fx/dangerMarks';
import type { FrameContext } from '../../src/render/layer';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { hitPlanet, planetTier, TIER_CAPTURE } from '../../src/sim/planetCapture';
import { type Intent, orbitBandWidth, step } from '../../src/sim/step';
import { ABSORBING, addBody, BOLT, createWorld, DEAD, FREE, KIND_ASTEROID, KIND_ROCKY, ORBITING, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, starSize, type World } from '../../src/sim/world';

// Ajustes después de la revisión y de las partidas de Lucas (26/11/2026).
const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 };
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const run = (w: World, s: number, it: Intent = idle): void => { for (let k = 0; k < Math.round(s * 60); k++) step(w, it); };
function guarded(mass: number, n = 6, config = cfg): World {
  const w = createWorld(config, 9, 120);
  w.star.mass = mass;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; addBody(w, { x: Math.cos(a) * 8, y: Math.sin(a) * 8, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); }
  for (let k = 0; k < 40; k++) { const d = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[d] = DEAD; }   // reserva de escombros
  step(w, idle);
  return w;
}

describe('ajustes de la Entrega 3', () => {
  it('un pedazo partido que entra a tu órbita se sigue enfriando', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.4, kind: KIND_ROCKY });
    w.broken[p] = 0.5;
    step(w, idle);
    expect(w.state[p]).toBe(ORBITING);
    const b0 = w.broken[p]!;
    run(w, 2);
    expect(w.broken[p]!).toBeGreaterThan(b0 + 1.9);
  });
  it('los planetas no cuentan para el tope de la órbita: con la órbita llena, un planeta chico entra igual', () => {
    const w = guarded(100, 6, { ...cfg, orbitCapacity: 6 });
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.4, kind: KIND_ROCKY });
    step(w, idle);
    expect(w.state[p]).toBe(ORBITING);
    expect(w.state[p]).not.toBe(ABSORBING);
  });
  it('un planeta se captura desde afuera de su franja y se lo ve acercarse, no alejarse', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 60, y: 0, vx: -6, vy: 0, radius: E * 0.4, kind: KIND_ROCKY });
    let captured = -1;
    for (let k = 0; k < 600 && captured < 0; k++) { step(w, idle); if (w.state[p] === ORBITING) captured = w.orbitR[p]!; }
    expect(captured).toBeGreaterThan(0);
    run(w, 4);
    expect(w.orbitR[p]!).toBeLessThanOrEqual(captured + 0.01);
  });
  it('un bólido entero alcanza para partir un planeta mediano grande', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 0.98, kind: KIND_ROCKY });
    let broke = false;
    for (let k = 0; k < cfg.boltMax; k++) broke = hitPlanet(w, p, cfg.boltPlanetDmg) || broke;
    expect(broke).toBe(true);
  });
  it('al partir un planeta salen fragmentos rocosos más grandes que un asteroide, que se pueden capturar', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_ROCKY });
    hitPlanet(w, p, 1000);
    let frags = 0;
    for (let i = 0; i < w.count; i++) if (w.state[i] === FREE && w.kind[i] === KIND_ASTEROID && w.radius[i]! > 1.1 && w.radius[i]! <= cfg.maxCaptureSize) frags++;
    expect(frags).toBe(cfg.breakFragments);
    expect(w.broken[p]!).toBeGreaterThan(0);
  });
  it('un asteroide capturado suma bodyMassGain de su masa', () => {
    const w = guarded(100, 0);
    const a = addBody(w, { x: 9, y: 0, vx: 0, vy: 0, radius: 1, kind: KIND_ASTEROID });
    const m0 = w.star.mass;
    step(w, idle);
    expect(w.state[a]).toBe(ORBITING);
    expect(w.star.mass - m0).toBeCloseTo(cfg.bodyMassGain, 6);
  });
  it('la franja de la órbita se ensancha con la estrella', () => {
    expect(orbitBandWidth(cfg, 1500)).toBeGreaterThan(orbitBandWidth(cfg, 20) + 10);
  });
  it('el tope de la órbita es más grande', () => {
    expect(DEFAULT_CONFIG.orbitCapacity).toBeGreaterThanOrEqual(400);
  });
});

describe('final de la pantalla: no se puede forzar', () => {
  function hyper(dx: number): World {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9 }, 3, 50);
    w.star.mass = 1000; w.bh.mass = 2;
    w.bh.x = w.bh.prevX = dx; w.bh.y = w.bh.prevY = 0;
    step(w, idle);
    return w;
  }
  it('colapsar pegado al rival no gana al instante: huye durante la supernova y la caza arranca con distancia', () => {
    const w = hyper(45);
    step(w, { ...idle, collapse: true });
    expect(w.phase).toBe(PHASE_COLLAPSE);
    run(w, w.config.collapseTime + 0.1);
    expect(w.phase).toBe(PHASE_HUNT);
    expect(Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y)).toBeGreaterThanOrEqual(w.config.huntStartMinDist - 1);
    run(w, 1);
    expect(w.phase).not.toBe(PHASE_MERGE);
  });
  it('el rival huye más rápido', () => {
    expect(DEFAULT_CONFIG.huntFleeSpeed).toBeGreaterThanOrEqual(18);
  });
});

describe('marcas de peligro', () => {
  it('se apagan fuera de la partida normal (colapso, caza, fusión)', () => {
    const w = createWorld(cfg, 9, 20);
    w.star.mass = 100;
    const E = starSize(100);
    addBody(w, { x: 25, y: 0, vx: 0, vy: 0, radius: E * 1.3, kind: KIND_ROCKY });
    const layer = createDangerMarksLayer(w);
    const ctx = { world: w, alpha: 1, time: 0, dt: 1, frame: 0, starX: 0, starY: 0, camera: new PerspectiveCamera() } as unknown as FrameContext;
    layer.update(ctx);
    expect(layer.shown).toBe(1);
    w.phase = PHASE_COLLAPSE;
    layer.update(ctx);
    expect(layer.shown).toBe(0);
  });
});

describe('la caza se puede ganar persiguiendo', () => {
  it('apuntando directo al rival lo alcanzás antes del límite (no frenás al acercarte)', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9 }, 3, 50);
    w.star.mass = 330; w.bh.mass = 2;   // la masa con la que el bot perdía cazas
    w.bh.x = w.bh.prevX = 200; w.bh.y = w.bh.prevY = 0;
    step(w, idle);
    step(w, { ...idle, collapse: true });
    run(w, w.config.collapseTime + 0.1);
    const chase: Intent = { targetX: 0, targetY: 0, hasTarget: true };
    for (let k = 0; k < 60 * w.config.huntTimeLimit && w.phase === PHASE_HUNT; k++) { chase.targetX = w.bh.x; chase.targetY = w.bh.y; step(w, chase); }
    expect(w.phase).toBe(PHASE_MERGE);
  });
});
