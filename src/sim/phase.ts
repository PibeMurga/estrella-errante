import type { World } from './world';

// La meta de la pantalla: superar en masa al agujero negro rival, colapsar, cazarlo y fusionarse.
// Masa del rival en la misma escala que la tuya (la de las barras).
export function rivalMass(w: World): number {
  return w.config.rivalMassScale * w.bh.mass;
}

// Radio de tu agujero negro: la misma fórmula que el rival, con tu masa pasada a su escala.
export function playerHoleRadius(w: World): number {
  return w.config.bhStartRadius * Math.cbrt(Math.max(w.star.mass, 1e-6) / w.config.rivalMassScale);
}
