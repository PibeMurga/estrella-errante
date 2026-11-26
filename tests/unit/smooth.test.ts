import { describe, expect, it } from 'vitest';
import { smoothToward } from '../../src/render/smooth';

describe('smoothToward', () => {
  it('se acerca al objetivo de a poco, sin saltar', () => {
    const a = smoothToward(4, 6, 1.5, 1 / 60);
    expect(a).toBeGreaterThan(4);
    expect(a).toBeLessThan(4.1);
  });

  it('con el tiempo llega al objetivo y nunca se pasa', () => {
    let v = 4;
    for (let i = 0; i < 60 * 10; i++) { v = smoothToward(v, 6, 1.5, 1 / 60); expect(v).toBeLessThanOrEqual(6); }
    expect(v).toBeCloseTo(6, 3);
  });

  it('con dt cero o inválido no cambia', () => {
    expect(smoothToward(4, 6, 1.5, 0)).toBe(4);
    expect(smoothToward(4, 6, 1.5, Number.NaN)).toBe(4);
  });

  it('con objetivo inválido no cambia', () => {
    expect(smoothToward(4, Number.NaN, 1.5, 0.1)).toBe(4);
  });
});
