import { describe, expect, it } from 'vitest';
import { DT } from '../../src/sim/config';
import { FixedStepper } from '../../src/sim/loop';

describe('FixedStepper', () => {
  it('da un paso por cada 1/60 s', () => {
    const s = new FixedStepper();
    expect(s.advance(DT)).toBe(1);
    expect(s.advance(DT * 2)).toBe(2);
  });

  it('acumula tiempos chicos', () => {
    const s = new FixedStepper();
    expect(s.advance(0.005)).toBe(0);
    expect(s.advance(0.005)).toBe(0);
    expect(s.advance(0.005)).toBe(0);
    expect(s.advance(0.005)).toBe(1);
  });

  it('alpha queda entre 0 y 1', () => {
    const s = new FixedStepper();
    s.advance(DT * 1.5);
    expect(s.alpha).toBeGreaterThan(0.45);
    expect(s.alpha).toBeLessThan(0.55);
  });

  it('después de un pico enorme da como máximo 5 pasos y no arrastra atraso', () => {
    const s = new FixedStepper();
    expect(s.advance(10)).toBe(5);
    expect(s.advance(DT)).toBe(1);
  });

  it('ignora tiempos inválidos', () => {
    const s = new FixedStepper();
    expect(s.advance(Number.NaN)).toBe(0);
    expect(s.advance(-1)).toBe(0);
    expect(s.advance(0)).toBe(0);
  });
});
