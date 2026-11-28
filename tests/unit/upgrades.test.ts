import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { chooseUpgrade, U_BOLT, UPGRADE_MAX, upg } from '../../src/sim/upgrades';
import { createWorld } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9, upgrades: true };
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };

describe('mejoras: elegir una entre tres al subir de etapa', () => {
  it('al llegar a un hito de masa se ofrecen tres distintas y la partida espera', () => {
    const w = createWorld(cfg, 4, 20);
    w.star.mass = 14.5;
    step(w, idle);
    expect(w.choosing).toBe(true);
    const o = Array.from(w.offer);
    expect(new Set(o).size).toBe(3);
    expect(o.every((x) => x >= 0)).toBe(true);
    const t = w.tick;
    step(w, idle); step(w, idle);
    expect(w.tick).toBe(t);   // en pausa
    const id = w.offer[1]!;
    chooseUpgrade(w, 1);
    expect(w.choosing).toBe(false);
    expect(upg(w, id)).toBe(1);
    step(w, idle);
    expect(w.tick).toBe(t + 1);
  });
  it('cada mejora se toma hasta tres veces; después no se ofrece más', () => {
    const w = createWorld(cfg, 4, 20);
    w.upg[U_BOLT] = UPGRADE_MAX;
    for (let n = 0; n < 30; n++) {
      w.star.mass += 40; step(w, idle);
      if (w.choosing) { expect(Array.from(w.offer)).not.toContain(U_BOLT); chooseUpgrade(w, 0); }
    }
  });
});
