import { spawnDebris } from './tidal';
import { DEAD, FREE, KIND_ASTEROID, MAX_IMPACTS, type World } from './world';

// Asteroides sueltos contra planetas sueltos: ya no se atraviesan. El asteroide se deshace contra el terreno (unas
// esquirlas chicas y una pequeña explosión con su cráter) y el planeta no se inmuta. Sólo cerca de la estrella, donde
// se ve: más lejos no hace falta y ahorra tiempo de cuadro.
const VIEW_X = 190, VIEW_Y = 130;
let near: Int32Array = new Int32Array(0);

export function stepRockImpacts(w: World): void {
  const s = w.star, P = w.planets;
  if (near.length < P.length * 2) near = new Int32Array(P.length * 2);   // sólo crece al armar el mapa
  let n = 0;
  for (let k = 0; k < P.length * 2; k++) {
    const p = k < P.length ? P[k]! : w.twin[P[k - P.length]!]!;
    if (p < 0 || w.state[p] !== FREE) continue;
    if (Math.abs(w.x[p] - s.x) > VIEW_X || Math.abs(w.y[p] - s.y) > VIEW_Y) continue;
    near[n++] = p;
  }
  if (n === 0) return;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== FREE || w.kind[i] !== KIND_ASTEROID || w.radius[i] <= 0.3) continue;   // las esquirlas no
    const x = w.x[i], y = w.y[i];
    if (Math.abs(x - s.x) > VIEW_X || Math.abs(y - s.y) > VIEW_Y) continue;
    for (let k = 0; k < n; k++) {
      const p = near[k]!, dx = x - w.x[p], dy = y - w.y[p], r = w.radius[p] + w.radius[i];
      if (dx * dx + dy * dy >= r * r) continue;
      if (dx * (w.vx[i] - w.vx[p]) + dy * (w.vy[i] - w.vy[p]) >= 0) continue;   // sólo si se acerca (los escombros que salen, no)
      const d = Math.hypot(dx, dy) || 1;
      w.state[i] = DEAD;
      spawnDebris(w, w.x[p] + (dx / d) * w.radius[p], w.y[p] + (dy / d) * w.radius[p], w.vx[p], w.vy[p], w.radius[i] * 1.5, dx / d, dy / d, 2, 0.1, 0.25);
      const slot = (w.impactCount % MAX_IMPACTS) * 4;
      w.impacts[slot] = p; w.impacts[slot + 1] = Math.atan2(dy, dx); w.impacts[slot + 2] = 0.25 + 0.4 * Math.min(1, w.radius[i]); w.impactCount++;
      break;
    }
  }
}
