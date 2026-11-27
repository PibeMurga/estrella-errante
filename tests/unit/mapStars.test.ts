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
    w.star.mass = 400; w.star.x = w.x[st] - 2; w.star.y = w.y[st];
    const m0 = w.star.mass;
    step(w, idle);
    expect(w.state[st]).toBe(DEAD);
    expect(w.starsEaten).toBe(1);
    expect(w.star.mass).toBeGreaterThan(m0);
  });
});
