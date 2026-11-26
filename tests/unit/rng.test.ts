import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('createRng', () => {
  it('repite la misma secuencia con la misma semilla', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('da otra secuencia con otra semilla', () => {
    const a = createRng(1);
    const b = createRng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
    expect(same).toBeLessThan(5);
  });

  it('devuelve valores en [0, 1) y range respeta los límites', () => {
    const r = createRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v >= 0 && v < 1).toBe(true);
      const w = r.range(-3, 5);
      expect(w >= -3 && w < 5).toBe(true);
    }
  });
});
