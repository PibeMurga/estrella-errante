import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { hitPlanet, planetHp, planetTier, TIER_BREAK, TIER_CAPTURE, TIER_GRAVE, TIER_HURT } from '../../src/sim/planetCapture';
import { STAGES } from '../../src/sim/stages';
import { type Intent, step } from '../../src/sim/step';
import { addBody, addSatellite, BOLT, DEAD, massGain, createWorld, FREE, KIND_GAS, PROJECTILE, RETURNING, KIND_ASTEROID, KIND_MOON, KIND_ROCKY, ORBIT_PLANET, ORBITING, OVER_NONE, starSize, type World } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 };
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const run = (w: World, s: number): void => { for (let k = 0; k < Math.round(s * 60); k++) step(w, idle); };
function guarded(mass: number, n = 6): World {
  const w = createWorld(cfg, 9, 80);
  w.star.mass = mass;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; addBody(w, { x: Math.cos(a) * 8, y: Math.sin(a) * 8, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); }
  step(w, idle);
  return w;
}

describe('escalones de los planetas', () => {
  it('el escalón depende del tamaño del planeta comparado con el de la estrella', () => {
    const E = starSize(100);
    expect(planetTier(E * 0.5, 100)).toBe(TIER_CAPTURE);
    expect(planetTier(E * 0.51, 100)).toBe(TIER_BREAK);
    expect(planetTier(E, 100)).toBe(TIER_BREAK);
    expect(planetTier(E * 1.2, 100)).toBe(TIER_HURT);
    expect(planetTier(E * 1.5, 100)).toBe(TIER_HURT);
    expect(planetTier(E * 1.51, 100)).toBe(TIER_GRAVE);
  });
  it('un planeta chico entra solo a una órbita exterior, más afuera que los asteroides', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.4, kind: KIND_ROCKY });
    step(w, idle);
    expect(w.state[p]).toBe(ORBITING);
    expect(w.planetCaptures).toBe(1);
    run(w, 6);
    let maxAst = 0;
    for (let i = 0; i < w.count; i++) if (w.state[i] === ORBITING && w.kind[i] === KIND_ASTEROID) maxAst = Math.max(maxAst, w.orbitR[i]);
    expect(w.orbitR[p]).toBeGreaterThan(maxAst + cfg.planetOrbitGap * 0.5);
  });
  it('sus lunas lo siguen y se pueden robar', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.4, kind: KIND_ROCKY });
    const m = addSatellite(w, p, E * 0.4 * 2.5, 0, 0.6, KIND_MOON, 1);
    run(w, 3);
    expect(w.state[p]).toBe(ORBITING);
    expect(w.state[m] === ORBIT_PLANET || w.state[m] === ORBITING).toBe(true);
  });
  it('un planeta mediano no entra: hay que partirlo', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_ROCKY });
    run(w, 1);
    expect(w.state[p]).toBe(FREE);
  });
  it('un planeta un poco más grande te daña; uno mucho más grande es un golpe grave y perdés una etapa', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    addBody(w, { x: w.star.x + E, y: 0, vx: 0, vy: 0, radius: E * 1.3, kind: KIND_ROCKY });
    step(w, idle);
    expect(w.hits).toBe(1); expect(w.graveHits).toBe(0);
    const g = guarded(STAGES[3]!.mass + 10);
    const E2 = starSize(g.star.mass);
    addBody(g, { x: g.star.x + E2, y: 0, vx: 0, vy: 0, radius: E2 * 1.8, kind: KIND_ROCKY });
    const st0 = g.stage;
    step(g, idle);
    expect(g.graveHits).toBe(1);
    expect(g.stage).toBe(st0 - 1);
    expect(g.over).toBe(OVER_NONE);
  });
  it('un golpe grave en la primera etapa no baja la masa del mínimo', () => {
    const g = guarded(5);
    const E = starSize(g.star.mass);
    addBody(g, { x: g.star.x + E, y: 0, vx: 0, vy: 0, radius: E * 1.8, kind: KIND_ROCKY });
    step(g, idle);
    expect(g.stage).toBe(0);
    expect(g.star.mass).toBeGreaterThanOrEqual(cfg.starStartMass);
  });
});

describe('partir planetas a golpes', () => {
  it('un planeta mediano aguanta golpes según su tamaño y al partirse sigue siendo el mismo planeta, partido', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_ROCKY });
    const hp = Math.ceil(cfg.planetHpPerRadius * E * 0.8);
    for (let k = 0; k < hp - 1; k++) expect(hitPlanet(w, p, 1)).toBe(false);
    expect(hitPlanet(w, p, 1)).toBe(true);
    expect(w.planetBreaks).toBe(1);
    expect(w.broken[p]).toBeGreaterThan(0);
    // Es el mismo planeta, colapsado y partido: casi del mismo tamaño (no un pedacito).
    // (ahora en dos pedazos, cada uno un cuerpo: juntos, casi toda la esfera)
    expect(Math.cbrt(w.mass[p] + w.mass[w.twin[p]!])).toBeGreaterThan(E * 0.8 * 0.8);
    expect(hitPlanet(w, p, 1000)).toBe(false);   // ya partido: no se vuelve a partir
  });
  it('a los que dañan también se los puede partir, pero aguantan bastante más; a los graves, no', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 1.3, kind: KIND_ROCKY });
    expect(planetHp(w, p)).toBe(Math.ceil(cfg.planetHpPerRadius * cfg.hurtHpMul * E * 1.3));
    for (let k = 0; k < planetHp(w, p) - 1; k++) expect(hitPlanet(w, p, 1)).toBe(false);
    expect(hitPlanet(w, p, 1)).toBe(true);
    const g = addBody(w, { x: -40, y: 0, vx: 0, vy: 0, radius: E * 1.8, kind: KIND_ROCKY });
    for (let k = 0; k < 500; k++) hitPlanet(w, g, 1);
    expect(w.broken[g]).toBe(0);
  });
  it('un gaseoso partido conserva su tamaño, suelta escombros y no desaparece', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_GAS });
    for (let i = 0; i < 20; i++) { const d = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[d] = 3; }   // reserva de escombros
    hitPlanet(w, p, 1000);
    expect(w.state[p]).toBe(FREE);
    expect(w.radius[p]).toBeCloseTo(E * 0.8, 6);        // conserva su tamaño y su aspecto (pedido de Lucas)
    expect(w.broken[p]).toBeGreaterThan(0);             // queda marcado como partido: entra a tu órbita
  });
  it('un asteroide lanzado choca como una piedra pesada: se deshace o queda suelto, casi sin rebote', () => {
    const go = (shatter: number) => {
      const w = createWorld({ ...cfg, rockShatterChance: shatter }, 9, 80);
      w.star.mass = 100; step(w, idle);
      const E = starSize(w.star.mass);
      const p = addBody(w, { x: 60, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_ROCKY });
      const a = addBody(w, { x: 60 - E * 0.8 - 0.4, y: 0, vx: 40, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
      w.state[a] = PROJECTILE; w.life[a] = 1;
      const m0 = w.star.mass;
      step(w, idle);
      return { w, a, m0 };
    };
    const b = go(0);
    expect(b.w.state[b.a]).toBe(FREE);
    expect(Math.hypot(b.w.vx[b.a], b.w.vy[b.a])).toBeLessThan(40 * 0.25);   // pesado: casi sin rebote
    expect(b.w.star.mass).toBeLessThan(b.m0);                                // la honda lo pierde
    const s = go(1);
    expect(s.w.state[s.a]).toBe(DEAD);                                       // se deshizo en esquirlas
  });
  it('la honda y el bólido dañan al planeta', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_ROCKY });
    const a = addBody(w, { x: 40 - E * 0.8, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[a] = PROJECTILE; w.life[a] = 1;
    const b = addBody(w, { x: 40, y: E * 0.8, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[b] = BOLT; w.life[b] = 1;
    step(w, idle);
    expect(w.planetDmg[p]).toBe(1 + cfg.boltPlanetDmg);   // honda 1, bólido boltPlanetDmg por cuerpo
  });
});

describe('cuánto suma un planeta', () => {
  it('un planeta capturado suma su masa por planetMassGain (y lo mismo resta si se pierde)', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.4, kind: KIND_ROCKY });
    const m0 = w.star.mass;
    step(w, idle);
    expect(w.state[p]).toBe(ORBITING);
    let others = 0;   // lo que entró en el mismo paso, además del planeta
    for (let c = 0; c < w.capturedCount; c++) { const i = w.captured[c]!; if (i !== p) others += massGain(w, i); }
    expect(w.star.mass - m0 - others).toBeCloseTo(w.mass[p] * cfg.planetMassGain, 6);
  });
});

describe('el planeta que partís es tuyo', () => {
  it('partido, entra a tu órbita aunque sea grande, y conserva su tamaño', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    for (let i = 0; i < 30; i++) { const d = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[d] = 3; }
    const p = addBody(w, { x: 30, y: 0, vx: 0, vy: 0, radius: E * 0.9, kind: KIND_ROCKY });
    hitPlanet(w, p, 1000);
    const r = w.radius[p];
    run(w, 1);
    expect(w.state[p]).not.toBe(ORBITING);   // recién partido: primero deriva, no entra al instante
    run(w, cfg.splitNoCatch + 4);
    expect(w.state[p]).toBe(ORBITING);
    expect(w.radius[p]).toBe(r);
  });
});
