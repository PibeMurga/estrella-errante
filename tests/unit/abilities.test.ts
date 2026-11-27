import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { abilityLevel, planetsInOrbit } from '../../src/sim/abilities';
import { type Intent, step } from '../../src/sim/step';
import { addBody, captureRadiusFor, createWorld, FREE, GATHERING, KIND_ASTEROID, KIND_ROCKY, ORBITING, type World } from '../../src/sim/world';

const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
// Mundo con 20 planetas lejanos (la pantalla) y N de ellos en tu órbita.
function system(held: number): World {
  const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 20, blackHole: false, cometFirst: 1e9 }, 4, 80);
  w.star.mass = 200;
  for (let k = 0; k < held; k++) { const p = w.planets[k]!; w.state[p] = ORBITING; w.orbitR[p] = 30; w.orbitTarget[p] = 30; w.orbitAngle[p] = k; w.orbitingCount++; }
  for (let k = 0; k < 6; k++) { const a = addBody(w, { x: 8, y: k, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[a] = ORBITING; w.orbitR[a] = 9; w.orbitTarget[a] = 9; w.orbitAngle[a] = k; w.orbitingCount++; }
  step(w, idle);
  return w;
}

describe('habilidades por cantidad de planetas', () => {
  it('el nivel sale del porcentaje de planetas de la pantalla en tu órbita', () => {
    expect(abilityLevel(system(2))).toBe(0);    // 10 %
    expect(abilityLevel(system(3))).toBe(1);    // 15 %
    expect(abilityLevel(system(6))).toBe(2);    // 30 %
    expect(abilityLevel(system(9))).toBe(3);    // 45 %
    expect(planetsInOrbit(system(6))).toBe(6);
  });
  it('gravedad ampliada: el radio de captura crece', () => {
    const w = system(3);
    expect(w.star.captureRadius).toBeCloseTo(captureRadiusFor(w.config, w.star.mass) * w.config.abilityGravityMul, 6);
  });
  it('escudo de órbita: un golpe que daña suelta un planeta exterior en lugar de asteroides', () => {
    const w = system(6);
    const countAst = (): number => { let n = 0; for (let i = 0; i < w.count; i++) if (w.state[i] === ORBITING && w.kind[i] === KIND_ASTEROID) n++; return n; };
    const ast0 = countAst();   // los planetas traen sus cinturones: se cuenta justo antes del golpe
    const big = addBody(w, { x: w.star.x + 15, y: 0, vx: 0, vy: 0, radius: 15, kind: KIND_ROCKY });
    w.radius[big] = 13;   // daña (E de masa 200 ≈ 11) pero no es grave
    step(w, idle);
    expect(w.hits).toBe(1);
    expect(countAst()).toBeGreaterThanOrEqual(ast0);   // no se perdió ningún asteroide
    expect(planetsInOrbit(w)).toBe(5);
  });
  it('bólido mayor: el tope sube; al perder la habilidad, lo ya juntado sale igual', () => {
    const w = system(9);
    for (let k = 0; k < 30; k++) { const a = addBody(w, { x: 8, y: k * 0.1, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[a] = ORBITING; w.orbitR[a] = 9; w.orbitTarget[a] = 9; w.orbitAngle[a] = k * 0.2; w.orbitingCount++; }
    const hold: Intent = { targetX: 0, targetY: 0, hasTarget: false, hold: true, aimX: 100, aimY: 0, hasAim: true };
    for (let k = 0; k < 60 * 5; k++) step(w, hold);
    expect(w.gathered).toBe(w.config.boltMax + w.config.abilityBoltBonus);
    for (let k = 0; k < 5; k++) { const p = w.planets[k]!; w.state[p] = FREE; w.orbitingCount--; }
    step(w, hold);
    const g = w.gathered;
    expect(g).toBe(w.config.boltMax + w.config.abilityBoltBonus);
    step(w, { ...hold, hold: false });
    expect(w.lastBoltSize).toBe(g);
    let left = 0; for (let i = 0; i < w.count; i++) if (w.state[i] === GATHERING) left++;
    expect(left).toBe(0);
  });
  it('las habilidades se pierden al bajar del umbral', () => {
    const w = system(3);
    expect(w.ability).toBe(1);
    const p = w.planets[0]!; w.state[p] = FREE; w.orbitingCount--;
    step(w, idle);
    expect(w.ability).toBe(0);
    expect(w.abilityDowns).toBe(1);
  });
});
