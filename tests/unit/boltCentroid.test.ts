import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { boltCentroid } from '../../src/render/fx/bolt';
import { addBody, BOLT, createWorld, GATHERING, KIND_ASTEROID } from '../../src/sim/world';

describe('nube del bólido', () => {
  it('el montón y el bólido en vuelo tienen cada uno su centro (no uno a mitad de camino)', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false }, 1, 10);
    const a = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[a] = GATHERING;
    const b = addBody(w, { x: 100, y: 0, vx: 50, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[b] = BOLT;
    const out = { x: 0, y: 0, vx: 0, vy: 0 };
    expect(boltCentroid(w, GATHERING, 1, out)).toBe(1);
    expect(out.x).toBe(0);
    expect(boltCentroid(w, BOLT, 1, out)).toBe(1);
    expect(out.x).toBe(100); expect(out.vx).toBe(50);
  });
});
