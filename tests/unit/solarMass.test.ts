import { describe, expect, it } from 'vitest';
import { formatEarth, formatSolar, solarMasses } from '../../src/ui/solarMass';

describe('masa en masas solares', () => {
  it('valores reales por etapa y siempre creciente', () => {
    expect(solarMasses(30)).toBeCloseTo(0.08, 5);      // ignición: la enana roja más chica
    expect(solarMasses(70)).toBeCloseTo(0.8, 5);       // enana amarilla
    expect(solarMasses(310)).toBeCloseTo(100, 5);      // hipergigante
    let prev = -1;
    for (let m = 0; m < 2000; m += 7) { const v = solarMasses(m); expect(v).toBeGreaterThan(prev); prev = v; }
  });
  it('se escribe con coma y su unidad: masas de Júpiter siendo planeta, masas solares desde la ignición', () => {
    expect(formatSolar(1)).toMatch(/^0,\d M♃$/);
    expect(formatSolar(29)).toMatch(/ M♃$/);
    expect(formatSolar(30)).toMatch(/^0,08 M☉$/);
    expect(formatSolar(310)).toBe('100 M☉');
  });
  it('el visor muestra masas de la Tierra, abreviadas', () => {
    expect(formatEarth(1)).toMatch(/^\d+ TIERRAS$/);          // al empezar: unos cientos
    expect(formatEarth(30)).toMatch(/^27 k TIERRAS$/);       // ignición: 0,08 soles
    expect(formatEarth(310)).toMatch(/^33 M TIERRAS$/);      // hipergigante: 100 soles
  });
});
