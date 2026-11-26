import { DEAD, FREE, KIND_ASTEROID, type World } from './world';

// Ruptura por marea: el planeta `i` se parte en el eje (ax, ay), que apunta al agujero negro.
// Suelta escombros en dos chorros, uno hacia el agujero y otro hacia afuera (la corriente de marea),
// y queda más chico, partido en dos mitades que se separan de a poco (eso lo dibuja el render).
// También lo usa el choque entre planetas (tidal = false: no cuenta como marea).
export function breakPlanet(w: World, i: number, ax: number, ay: number, tidal = true): void {
  const c = w.config, r = w.rng;
  w.broken[i] = 1e-6;
  w.breakAx[i] = ax; w.breakAy[i] = ay;
  if (tidal) w.tidalBreaks++;
  const R = w.radius[i];
  const px = -ay, py = ax;   // perpendicular al eje
  let left = c.tidalDebris;
  for (let k = 0; k < w.count && left > 0; k++) {
    if (w.state[k] !== DEAD || w.kind[k] !== KIND_ASTEROID) continue;
    const side = left % 2 === 0 ? 1 : -1;   // mitad de los escombros para cada lado
    const along = R * r.range(0.7, 1.1), across = R * r.range(-0.6, 0.6);
    w.x[k] = w.prevX[k] = w.x[i] + ax * along * side + px * across;
    w.y[k] = w.prevY[k] = w.y[i] + ay * along * side + py * across;
    const sp = r.range(3, 9), drift = r.range(-1.2, 1.2);
    w.vx[k] = w.vx[i] + ax * sp * side + px * drift;
    w.vy[k] = w.vy[i] + ay * sp * side + py * drift;
    w.radius[k] = r.range(0.35, 0.9);
    w.mass[k] = w.radius[k] ** 3;
    w.parent[k] = -1;
    w.noCatch[k] = 0.4;
    w.state[k] = FREE;
    left--;
  }
  w.radius[i] = R * 0.85;
  w.mass[i] = w.radius[i] ** 3;
}
