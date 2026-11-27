import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { createWorld, PHASE_COLLAPSE, PHASE_PLAY } from '../../src/sim/world';

// Pedido de Lucas (27/11): la última transformación es automática. Sin apretar nada.
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };

describe('colapso automático', () => {
  it('siendo hipergigante y más pesado que el rival, colapsás solo', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9 }, 3, 50);
    w.star.mass = 1000; w.bh.mass = 2;
    w.bh.x = w.bh.prevX = 200; w.bh.y = w.bh.prevY = 0;
    step(w, idle);
    expect(w.phase).toBe(PHASE_COLLAPSE);
  });
  it('sin superar al rival no colapsa, aunque seas hipergigante', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9 }, 3, 50);
    w.star.mass = 300; w.bh.mass = 10;   // rival 550
    w.bh.x = w.bh.prevX = 200; w.bh.y = w.bh.prevY = 0;
    step(w, idle);
    expect(w.phase).toBe(PHASE_PLAY);
  });
});
