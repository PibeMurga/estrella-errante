import { describe, expect, it } from 'vitest';
import { formatSolar, solarMasses } from '../../src/ui/solarMass';

describe('masa en masas solares', () => {
  it('valores reales por etapa y siempre creciente', () => {
    expect(solarMasses(1)).toBeLessThan(0.5);          // enana roja
    expect(solarMasses(40)).toBeCloseTo(0.8, 5);       // enana amarilla
    expect(solarMasses(280)).toBeCloseTo(100, 5);      // hipergigante
    let prev = -1;
    for (let m = 0; m < 2000; m += 7) { const v = solarMasses(m); expect(v).toBeGreaterThan(prev); prev = v; }
  });
  it('se escribe con coma y su unidad', () => {
    expect(formatSolar(1)).toMatch(/^0,\d\d M☉$/);
    expect(formatSolar(280)).toBe('100 M☉');
  });
});
