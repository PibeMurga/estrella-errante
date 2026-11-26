// Acerca `current` a `target` con una curva suave (exponencial): rápido al principio, cada vez más lento.
// `rate` es cuántas veces por segundo se recorre ~63 % de la distancia que falta.
export function smoothToward(current: number, target: number, rate: number, dt: number): number {
  if (!(dt > 0) || !Number.isFinite(target)) return current;
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
