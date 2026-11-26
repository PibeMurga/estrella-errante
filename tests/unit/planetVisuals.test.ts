import { describe, expect, it } from 'vitest';
import { hasRings, planetVisualFor, VISUALS } from '../../src/render/bodies/planets';
import { KIND_ASTEROID, KIND_GAS, KIND_ICE, KIND_MOON, KIND_ROCKY } from '../../src/sim/world';

const N = 20000;
const share = (kind: number, name: string): number => {
  let n = 0;
  for (let i = 0; i < N; i++) if (VISUALS[planetVisualFor(kind, i)]!.name === name) n++;
  return n / N;
};

describe('tipos de planeta con rareza', () => {
  it('es determinista: el mismo cuerpo tiene siempre el mismo tipo', () => {
    for (let i = 0; i < 200; i++) expect(planetVisualFor(KIND_ROCKY, i)).toBe(planetVisualFor(KIND_ROCKY, i));
  });

  it('cada clase de la simulación recibe sólo tipos que le corresponden', () => {
    for (const kind of [KIND_ROCKY, KIND_ICE, KIND_GAS, KIND_MOON]) {
      for (let i = 0; i < 500; i++) expect(VISUALS[planetVisualFor(kind, i)]!.kinds).toContain(kind);
    }
  });

  it('las lunas son siempre lunas rocosas', () => {
    for (let i = 0; i < 500; i++) expect(VISUALS[planetVisualFor(KIND_MOON, i)]!.name).toBe('luna');
  });

  it('los comunes salen mucho más que los raros', () => {
    expect(share(KIND_ROCKY, 'rocoso')).toBeGreaterThan(0.25);
    expect(share(KIND_ROCKY, 'mineral')).toBeLessThan(0.04);
    expect(share(KIND_ROCKY, 'mineral')).toBeGreaterThan(0.005);
    expect(share(KIND_ROCKY, 'archipiélago')).toBeLessThan(0.05);
    expect(share(KIND_GAS, 'gaseoso')).toBeGreaterThan(0.4);
    expect(share(KIND_GAS, 'nubes ácidas')).toBeLessThan(0.06);
  });

  it('sólo algunos gaseosos con bandas tienen anillos, y nunca otra clase', () => {
    let gas = 0, ringed = 0;
    for (let i = 0; i < N; i++) {
      if (hasRings(KIND_ROCKY, i) || hasRings(KIND_ASTEROID, i)) throw new Error('anillo en un cuerpo que no es gaseoso');
      if (VISUALS[planetVisualFor(KIND_GAS, i)]!.shade !== 3) { expect(hasRings(KIND_GAS, i)).toBe(false); continue; }
      gas++;
      if (hasRings(KIND_GAS, i)) ringed++;
    }
    expect(ringed / gas).toBeGreaterThan(0.15);
    expect(ringed / gas).toBeLessThan(0.3);
  });
});
