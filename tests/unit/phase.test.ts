import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { canCollapse, playerHoleRadius, rivalMass } from '../../src/sim/phase';
import { STAGE_HYPER } from '../../src/sim/stages';
import { type Intent, step } from '../../src/sim/step';
import { addBody, CARRIED, createWorld, DEAD, FREE, hashWorld, KIND_ASTEROID, ORBITING, OVER_ESCAPED, OVER_NONE, OVER_WON, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, PHASE_PLAY, PROJECTILE, type World } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9 };

describe('la carrera de masa', () => {
  it('la masa del rival es la del agujero negro por la escala', () => {
    const w = createWorld(cfg, 3, 50);
    w.bh.mass = 4;
    expect(rivalMass(w)).toBe(4 * cfg.rivalMassScale);
  });
  it('tu agujero negro crece con tu masa y, con la misma masa en la carrera, mide como el rival', () => {
    const w = createWorld(cfg, 3, 50);
    w.star.mass = 300;
    const r1 = playerHoleRadius(w);
    w.star.mass = 600;
    expect(playerHoleRadius(w)).toBeGreaterThan(r1);
    w.bh.mass = 600 / cfg.rivalMassScale;
    expect(playerHoleRadius(w)).toBeCloseTo(cfg.bhStartRadius * Math.cbrt(w.bh.mass), 9);
  });
});

const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const press: Intent = { targetX: 0, targetY: 0, hasTarget: false, collapse: true };
const run = (w: World, secs: number, it: Intent = idle): void => { for (let k = 0; k < Math.round(secs * 60); k++) step(w, it); };
function hyperWorld(): World {
  const w = createWorld(cfg, 3, 50);
  w.star.mass = 1000; w.bh.mass = 2;
  w.bh.x = w.bh.prevX = 200; w.bh.y = w.bh.prevY = 0;
  step(w, idle);   // actualiza la etapa
  return w;
}
function huntWorld(): World {
  const w = hyperWorld();
  step(w, press);
  run(w, cfg.collapseTime + 0.05);
  return w;
}

describe('fases de la partida', () => {
  it('se puede colapsar siendo hipergigante y más pesado que el rival', () => {
    const w = hyperWorld();
    expect(w.stage).toBe(STAGE_HYPER);
    expect(canCollapse(w)).toBe(true);
    w.bh.mass = 1000 / cfg.rivalMassScale;   // empate: no alcanza
    expect(canCollapse(w)).toBe(false);
    const chica = createWorld(cfg, 3, 50);
    chica.star.mass = 200; chica.bh.mass = 1; step(chica, idle);
    expect(canCollapse(chica)).toBe(false);   // más pesada, pero no hipergigante
  });
  it('apretar antes de tiempo no hace nada ni queda guardado', () => {
    const w = createWorld(cfg, 3, 50);
    w.star.mass = 200; w.bh.mass = 1; step(w, press);
    expect(w.phase).toBe(PHASE_PLAY);
    w.star.mass = 1000; run(w, 0.5);
    expect(w.phase).toBe(PHASE_PLAY);
  });
  it('al apretar colapsa: la cinemática dura collapseTime, la estrella queda quieta y apretar de nuevo no la reinicia', () => {
    const w = hyperWorld();
    step(w, press);
    expect(w.phase).toBe(PHASE_COLLAPSE);
    const x0 = w.star.x, y0 = w.star.y;
    run(w, 2, press);
    expect(w.phaseTime).toBeGreaterThan(1.9);
    run(w, cfg.collapseTime - 2 - 0.1);
    expect(w.phase).toBe(PHASE_COLLAPSE);
    expect(w.star.x).toBe(x0); expect(w.star.y).toBe(y0);
    run(w, 0.2);
    expect(w.phase).toBe(PHASE_HUNT);
  });
  it('durante el colapso la órbita sigue girando, y los cometas y proyectiles sueltan todo', () => {
    const w = hyperWorld();
    const a = addBody(w, { x: 8, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    step(w, idle);
    expect(w.state[a]).toBe(ORBITING);
    const p = addBody(w, { x: 30, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[p] = PROJECTILE; w.life[p] = 2;
    const c = addBody(w, { x: 60, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[c] = CARRIED; w.comets.mode[0] = 1; w.comets.carry[0] = c;
    step(w, press);
    expect(w.state[p]).toBe(FREE);
    expect(w.state[c]).toBe(FREE);
    expect(w.comets.mode[0]).toBe(0);
    const ang = w.orbitAngle[a];
    run(w, 1);
    expect(w.state[a]).toBe(ORBITING);
    expect(w.orbitAngle[a]).not.toBe(ang);
  });
  it('en la caza el rival huye y tragás lo que tocás', () => {
    const w = huntWorld();
    expect(w.phase).toBe(PHASE_HUNT);
    const d0 = Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y);
    run(w, 1);
    expect(Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y)).toBeGreaterThan(d0);
    const m0 = w.star.mass;
    const b = addBody(w, { x: w.star.x + 1, y: w.star.y, vx: 0, vy: 0, radius: 0.8, kind: KIND_ASTEROID });
    step(w, idle);
    expect(w.state[b]).toBe(DEAD);
    expect(w.star.mass).toBeGreaterThan(m0);
  });
  it('al empezar la caza el rival nunca queda más lejos que huntStartMaxDist', () => {
    const w = hyperWorld();
    w.bh.x = w.bh.prevX = 500;
    step(w, press);
    run(w, cfg.collapseTime + 0.05);
    expect(Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y)).toBeLessThanOrEqual(cfg.huntStartMaxDist + 1);
  });
  it('al alcanzarlo hay fusión y ganás', () => {
    const w = huntWorld();
    w.bh.x = w.bh.prevX = w.star.x + playerHoleRadius(w) * 0.5; w.bh.y = w.bh.prevY = w.star.y;
    step(w, idle);
    expect(w.phase).toBe(PHASE_MERGE);
    run(w, cfg.mergeTime - 0.1);
    expect(w.over).toBe(OVER_NONE);
    run(w, 0.2);
    expect(w.over).toBe(OVER_WON);
    expect(w.bh.active).toBe(false);
  });
  it('si no lo alcanzás a tiempo, se escapa', () => {
    const w = huntWorld();
    run(w, cfg.huntTimeLimit + 0.1);
    expect(w.over).toBe(OVER_ESCAPED);
  });
  it('todo el recorrido es determinista', () => {
    const play = (): number => {
      const w = hyperWorld();
      step(w, press);
      const chase: Intent = { targetX: 0, targetY: 0, hasTarget: true };
      for (let k = 0; k < 60 * 20; k++) { chase.targetX = w.bh.x; chase.targetY = w.bh.y; step(w, chase); }
      return hashWorld(w) ^ (w.phase * 7919) ^ (w.over * 104729);
    };
    expect(play()).toBe(play());
  });
});

describe('correcciones de la revisión', () => {
  it('en la caza el rival no rebota de un borde al otro del mapa', () => {
    const w = huntWorld();
    let rx = w.bh.x - w.star.x, ry = w.bh.y - w.star.y, maxD = 0;
    for (let k = 0; k < 60 * 50; k++) {
      step(w, idle);
      if (w.over !== OVER_NONE) break;
      const nx = w.bh.x - w.star.x, ny = w.bh.y - w.star.y;
      expect(Math.hypot(nx - rx, ny - ry)).toBeLessThan(1);   // sin saltos de un borde al otro
      rx = nx; ry = ny;
      maxD = Math.max(maxD, Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y));
    }
    expect(maxD).toBeLessThan(Math.min(cfg.arenaHalfWidth, cfg.arenaHalfHeight));
  });
  it('al colapsar se apaga el rayo del eclipse', () => {
    const w = hyperWorld();
    w.beamTime = 0.5;
    step(w, press);
    expect(w.beamTime).toBe(0);
  });
  it('al ganar, la masa máxima incluye al rival', () => {
    const w = huntWorld();
    w.bh.x = w.bh.prevX = w.star.x + 1; w.bh.y = w.bh.prevY = w.star.y;
    run(w, cfg.mergeTime + 0.2);
    expect(w.over).toBe(OVER_WON);
    expect(w.maxMass).toBe(w.star.mass);
  });
});
