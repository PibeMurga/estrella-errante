import { DT } from './config';
import { DEAD, FREE, KIND_ASTEROID, KIND_ROCKY, starSize, type World } from './world';

// El espacio se repuebla: a medida que avanzás (y te comés lo que tenés cerca), fuera de cuadro aparecen planetas y
// cúmulos de asteroides nuevos. Los planetas nuevos acompañan tu tamaño: de un tercio de vos a algo más grande, y a veces
// uno mucho más grande. Así siempre hay con qué cruzarse.

// La reserva de planetas para revivir (muertos, creados al armar el mapa) la arma createWorld en world.ts.

export function stepSpawner(w: World): void {
  const c = w.config, s = w.star;
  if (!c.respawn) return;
  w.spawnClock -= DT;
  if (w.spawnClock > 0) return;
  w.spawnClock = 0.6;
  const R = Math.min(c.arenaHalfWidth, c.arenaHalfHeight) * 0.9, me = starSize(s.mass);
  // Aparecen justo fuera de cuadro (no lejísimos): así entran a la vista enseguida.
  const far0 = 150 + me * 9, far1 = Math.min(R, far0 + 160);
  // Asteroides: si escasean cerca, un cúmulo nuevo fuera de cuadro.
  let ast = 0;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== FREE || w.kind[i] !== KIND_ASTEROID || w.radius[i] <= 0.3) continue;
    if (Math.abs(w.x[i] - s.x) < R && Math.abs(w.y[i] - s.y) < R) ast++;
  }
  if (ast < c.respawnAsteroids) {
    const r = w.rng, a = r.range(0, Math.PI * 2), d = r.range(far0, far1);
    const cx = s.x + Math.cos(a) * d, cy = s.y + Math.sin(a) * d, va = r.range(0, Math.PI * 2), vs = r.range(0.5, 3);
    let left = 18;
    for (let i = 0; i < w.count && left > 0; i++) {
      if (w.state[i] !== DEAD || w.kind[i] !== KIND_ASTEROID) continue;
      const ra = r.range(0, Math.PI * 2), rd = 40 * Math.sqrt(r.next());
      w.x[i] = w.prevX[i] = cx + Math.cos(ra) * rd; w.y[i] = w.prevY[i] = cy + Math.sin(ra) * rd;
      w.vx[i] = Math.cos(va) * vs + r.range(-0.5, 0.5); w.vy[i] = Math.sin(va) * vs + r.range(-0.5, 0.5);
      w.radius[i] = 0.22 + 1.2 * Math.pow(r.next(), 3.2); w.mass[i] = w.radius[i] ** 3;
      w.parent[i] = -1; w.noCatch[i] = 0; w.state[i] = FREE;
      left--;
    }
  }
  // Planetas: si quedan pocos sueltos cerca, uno nuevo (de la reserva), con un tamaño que acompaña el tuyo.
  if (w.spawnNext >= w.spawnPool.length) return;
  // Se cuentan los planetas de tu zona (unas pocas pantallas a la redonda), no los de todo el mapa.
  let pl = 0;
  const near = 260 + me * 14;
  for (let q = 0; q < w.planets.length; q++) {
    const p = w.planets[q]!;
    if (w.state[p] !== FREE || w.parent[p] !== -1) continue;
    if (Math.abs(w.x[p] - s.x) < near && Math.abs(w.y[p] - s.y) < near) pl++;
  }
  if (pl >= c.respawnPlanets) return;
  const p = w.spawnPool[w.spawnNext++]!, r = w.rng;
  const big = r.next() < 0.12;
  const rad = Math.max(2, Math.min(34, me * (big ? r.range(1.6, 2.4) : r.range(0.3, 1.3))));
  // Entra a tu zona: viene más o menos hacia vos (sin apuntarte exacto), así se cruza con lo que ves.
  const a = r.range(0, Math.PI * 2), d = r.range(far0, far1), va = a + Math.PI + r.range(-0.6, 0.6), vs = r.range(2, 4.5);
  w.x[p] = w.prevX[p] = s.x + Math.cos(a) * d; w.y[p] = w.prevY[p] = s.y + Math.sin(a) * d;
  w.vx[p] = Math.cos(va) * vs; w.vy[p] = Math.sin(va) * vs;
  w.radius[p] = rad; w.mass[p] = rad * rad * rad;
  w.parent[p] = -1; w.noCatch[p] = 0; w.broken[p] = 0; w.halfSide[p] = 0; w.planetDmg[p] = 0; w.joinT[p] = 1e9;
  w.state[p] = FREE;
}
