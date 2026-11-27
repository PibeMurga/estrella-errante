import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { playerHoleRadius, rivalMass } from '../../src/sim/phase';
import { createWorld } from '../../src/sim/world';

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
