import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { createWorld, DEAD, KIND_STAR, ORBIT_PLANET } from '../../src/sim/world';

const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };

describe('estrellas del mapa', () => {
  it('hay estrellas de distintos tamaños, lejos del inicio, y algunas tienen planetas', () => {
    const w = createWorld(GAME_CONFIG, 7);
    expect(w.mapStars.length).toBe(GAME_CONFIG.mapStars);
    let withPlanets = 0;
    for (const st of w.mapStars) {
      expect(w.kind[st]).toBe(KIND_STAR);
      expect(Math.hypot(w.x[st], w.y[st])).toBeGreaterThan(170);
      for (let i = 0; i < w.count; i++) if (w.state[i] === ORBIT_PLANET && w.parent[i] === st) { withPlanets++; break; }
    }
    expect(withPlanets).toBeGreaterThan(0);
  });

  it('te tira con su gravedad; si sos una estrella más grande, la absorbés', () => {
    const w = createWorld({ ...GAME_CONFIG, planetStart: false, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 }, 7);
    const st = w.mapStars[0]!;
    w.star.x = w.x[st] - w.radius[st] * 5; w.star.y = w.y[st]; w.star.vx = w.star.vy = 0;
    w.vx[st] = w.vy[st] = 0;
    step(w, idle);
    expect(w.star.vx).toBeGreaterThan(0);   // hacia la estrella
    w.star.mass = 3000; w.star.x = w.x[st] - 2; w.star.y = w.y[st];
    const m0 = w.star.mass;
    step(w, idle);
    expect(w.state[st]).toBe(DEAD);
    expect(w.starsEaten).toBe(1);
    expect(w.star.mass).toBeGreaterThan(m0);
  });
});

describe('acople a la órbita de una estrella', () => {
  it('cerca de una estrella más grande quedás girando a su alrededor (sin caer ni irte)', () => {
    const w = createWorld({ ...GAME_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 }, 7);
    const st = w.mapStars[0]!;
    w.radius[st] = 12; w.vx[st] = w.vy[st] = 0;
    w.star.x = w.x[st] - 30; w.star.y = w.y[st]; w.star.vx = 0; w.star.vy = 0;
    w.invuln = 99;
    let a0 = Math.atan2(w.star.y - w.y[st], w.star.x - w.x[st]), turned = 0, minD = Infinity, maxD = 0;
    for (let k = 0; k < 60 * 8; k++) {
      step(w, idle);
      w.vx[st] = w.vy[st] = 0;
      const a = Math.atan2(w.star.y - w.y[st], w.star.x - w.x[st]);
      turned += Math.atan2(Math.sin(a - a0), Math.cos(a - a0)); a0 = a;
      const d = Math.hypot(w.star.x - w.x[st], w.star.y - w.y[st]);
      if (k > 120) { minD = Math.min(minD, d); maxD = Math.max(maxD, d); }
    }
    expect(Math.abs(turned)).toBeGreaterThan(Math.PI);   // dio media vuelta o más
    expect(minD).toBeGreaterThan(12);                     // no cayó adentro
    expect(maxD).toBeLessThan(12 * 7 + 10);               // no se fue
  });
});
