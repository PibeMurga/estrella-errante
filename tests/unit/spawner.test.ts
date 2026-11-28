import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { createWorld, DEAD, FREE, KIND_ASTEROID, starSize } from '../../src/sim/world';

const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };

describe('el espacio se repuebla', () => {
  it('si te quedás sin planetas ni asteroides cerca, aparecen nuevos fuera de cuadro, con tamaños según el tuyo', () => {
    const w = createWorld({ ...GAME_CONFIG, blackHole: false, upgrades: false, mapStars: 0 }, 5);
    w.star.mass = 200;
    for (let i = 0; i < w.count; i++) if (w.state[i] === FREE) w.state[i] = DEAD;   // vaciar todo
    for (let k = 0; k < 60 * 8; k++) step(w, idle);
    let pl = 0, ast = 0, maxR = 0;
    for (let i = 0; i < w.count; i++) {
      if (w.state[i] !== FREE) continue;
      if (w.kind[i] === KIND_ASTEROID) ast++;
      else if (w.kind[i] >= 1 && w.kind[i] <= 3) { pl++; maxR = Math.max(maxR, w.radius[i]); }
    }
    expect(pl).toBeGreaterThan(5);
    expect(ast).toBeGreaterThan(100);
    expect(maxR).toBeGreaterThan(starSize(w.star.mass) * 0.6);   // hay alguno de tu escala
  });
});
