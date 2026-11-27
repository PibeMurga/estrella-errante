import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { spawnComet } from '../../src/sim/comets';
import { ABSORBING, addBody, BOLT, createWorld, FREE, GATHERING, KIND_ASTEROID, KIND_ROCKY, ORBITING, PROJECTILE, type World } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9, blackHole: false };
const count = (w: World, st: number): number => { let n = 0; for (let i = 0; i < w.count; i++) if (w.state[i] === st) n++; return n; };
function orbitWorld(n = 20, config = cfg): World {
  const w = createWorld(config, 5, 60);
  w.star.mass = 50;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; addBody(w, { x: Math.cos(a) * 9, y: Math.sin(a) * 9, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID }); }
  const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
  for (let k = 0; k < 120; k++) step(w, idle);
  return w;
}
const hold = (aimX = 100, aimY = 0): Intent => ({ targetX: 0, targetY: 0, hasTarget: false, hold: true, aimX, aimY, hasAim: true });
const free = (aimX = 100, aimY = 0): Intent => ({ targetX: 0, targetY: 0, hasTarget: false, hold: false, aimX, aimY, hasAim: true });
const run = (w: World, secs: number, it: Intent): void => { for (let k = 0; k < Math.round(secs * 60); k++) step(w, it); };

describe('lanzamiento cargado', () => {
  it('un toque lanza un asteroide que vuelve', () => {
    const w = orbitWorld();
    const n0 = w.orbitingCount;
    step(w, hold()); step(w, free());
    expect(w.shots).toBe(1);
    expect(count(w, PROJECTILE)).toBe(1);
    expect(w.orbitingCount).toBe(n0 - 1);
    expect(count(w, BOLT)).toBe(0);
  });
  it('mantener junta asteroides; al soltar sale el bólido y perdés su masa', () => {
    const w = orbitWorld();
    const n0 = w.orbitingCount;
    run(w, 1, hold());
    const g = w.gathered;
    expect(g).toBe(1 + Math.floor((1 - cfg.tapTime) * cfg.boltGatherRate));
    expect(count(w, GATHERING)).toBe(g);
    expect(w.orbitingCount).toBe(n0 - g);
    const m0 = w.star.mass;
    step(w, free());
    expect(count(w, BOLT)).toBe(g);
    expect(w.bolts).toBe(1);
    expect(w.lastBoltSize).toBe(g);
    expect(w.star.mass).toBeLessThan(m0);
    expect(w.gathered).toBe(0);
  });
  it('el bólido tiene un límite', () => {
    const w = orbitWorld();
    run(w, 6, hold());
    expect(w.gathered).toBe(cfg.boltMax);
  });
  it('lo que se junta se compacta adelante de la estrella, hacia donde apuntás', () => {
    const w = orbitWorld();
    run(w, 3.5, hold(100, 0));   // tiempo para que lleguen hasta los últimos que se sumaron
    for (let i = 0; i < w.count; i++) if (w.state[i] === GATHERING) {
      expect(w.x[i] - w.star.x).toBeGreaterThan(0);
      expect(Math.abs(w.y[i] - w.star.y)).toBeLessThan(4);
    }
  });
  it('el bólido sale hacia la mira y al terminar el vuelo queda suelto, lento y sin recapturarse enseguida', () => {
    const w = orbitWorld();
    run(w, 1, hold(0, 100));
    step(w, free(0, 100));
    for (let i = 0; i < w.count; i++) if (w.state[i] === BOLT) expect(w.vy[i]).toBeGreaterThan(cfg.boltSpeed * 0.8);
    run(w, cfg.boltLife + 0.05, free(0, 100));
    expect(count(w, BOLT)).toBe(0);
    let lost = 0;
    for (let i = 0; i < w.count; i++) if (w.state[i] === FREE && w.noCatch[i]! > 0) { lost++; expect(Math.hypot(w.vx[i], w.vy[i])).toBeLessThan(cfg.boltSpeed * 0.3); }
    expect(lost).toBeGreaterThan(0);
  });
  it('nunca se lanza un planeta', () => {
    const w = orbitWorld(3);
    const p = addBody(w, { x: 12, y: 0, vx: 0, vy: 0, radius: 2, kind: KIND_ROCKY });
    w.state[p] = ORBITING; w.orbitR[p] = 12; w.orbitTarget[p] = 12; w.orbitingCount++;
    run(w, 3, hold());
    expect(w.state[p]).toBe(ORBITING);
    step(w, free());
    expect(w.state[p]).toBe(ORBITING);
  });
  it('sin asteroides o con la honda recargando no carga nada ni queda colgado', () => {
    const w = orbitWorld(0);
    run(w, 1, hold()); step(w, free());
    expect(w.charge).toBe(0); expect(w.bolts).toBe(0); expect(w.shots).toBe(0);
    const v = orbitWorld();
    v.slingCd = 5;
    run(v, 1, hold()); step(v, free());
    expect(v.charge).toBe(0); expect(v.bolts).toBe(0);
  });
  it('lo que se está juntando no lo pierde un choque ni lo roba nadie (no está en órbita)', () => {
    const w = orbitWorld();
    run(w, 1, hold());
    for (let i = 0; i < w.count; i++) if (w.state[i] === GATHERING) expect(w.state[i]).not.toBe(ORBITING);
    expect(w.orbitingCount + w.gathered).toBe(20);
  });
  it('contra el agujero negro: lo alimenta y lo frena', () => {
    const w = orbitWorld(20, { ...cfg, blackHole: true });
    w.bh.x = w.bh.prevX = 40; w.bh.y = w.bh.prevY = 0; w.bh.speed = 0;
    const m0 = w.bh.mass;
    run(w, 1, hold(100, 0));
    step(w, free(100, 0));
    run(w, 1, free(100, 0));
    expect(w.boltHitsBh).toBeGreaterThan(0);
    expect(w.bh.mass).toBeGreaterThan(m0);
    expect(w.bhSlow).toBeGreaterThan(0);
  });
});

describe('correcciones de la revisión (lanzamiento)', () => {
  it('un choque mientras cargás no te apaga: el montón vuelve a la órbita donde estaba', () => {
    const w = orbitWorld(8);
    run(w, 3, hold());
    expect(w.orbitingCount).toBe(0);
    let g = -1;
    for (let i = 0; i < w.count; i++) if (w.state[i] === GATHERING) g = i;
    const p = addBody(w, { x: w.star.x + 5, y: w.star.y, vx: 0, vy: 0, radius: 9, kind: KIND_ROCKY });
    expect(p).toBeGreaterThanOrEqual(0);
    step(w, hold());
    expect(w.over).toBe(0);
    expect(w.hits).toBe(1);
    expect(w.gathered).toBe(0);
    expect(w.charge).toBeLessThan(cfg.tapTime);   // si seguís apretando, la carga arranca de nuevo desde cero
    if (w.state[g] === ORBITING) expect(Math.abs(w.orbitR[g] - Math.hypot(w.x[g] - w.star.x, w.y[g] - w.star.y))).toBeLessThan(1.5);
  });
  it('un cometa que te toca mientras cargás roba igual', () => {
    const w = orbitWorld(8);
    run(w, 3, hold());
    spawnComet(w, w.star.x + 1, w.star.y);
    step(w, hold());
    expect(w.cometSteals).toBe(1);
  });
  it('lo que se está juntando cuenta para el tope de la órbita', () => {
    const w = orbitWorld(10, { ...cfg, orbitCapacity: 10 });
    run(w, 1, hold());
    expect(w.gathered).toBeGreaterThan(0);
    const a = addBody(w, { x: w.star.x - 8, y: w.star.y, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    step(w, hold());
    expect(w.state[a]).toBe(ABSORBING);
  });
});
