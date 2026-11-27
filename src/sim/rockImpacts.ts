import { spawnDebris } from './tidal';
import { DEAD, FREE, KIND_ASTEROID, MAX_IMPACTS, ORBITING, type World } from './world';

// Asteroides sueltos contra planetas sueltos: ya no se atraviesan. Algunos rebotan, pesados; otros se deshacen contra el
// terreno (unas esquirlas chicas). Siempre queda una pequeña explosión con su cráter, y el planeta no se inmuta. Sólo cerca de la estrella, donde
// se ve: más lejos no hace falta y ahorra tiempo de cuadro.
const VIEW_X = 190, VIEW_Y = 130;
let near: Int32Array = new Int32Array(0);

export function stepRockImpacts(w: World): void {
  const s = w.star, P = w.planets;
  if (near.length < P.length * 2) near = new Int32Array(P.length * 2);   // sólo crece al armar el mapa
  let n = 0;
  for (let k = 0; k < P.length * 2; k++) {
    const p = k < P.length ? P[k]! : w.twin[P[k - P.length]!]!;
    if (p < 0 || (w.state[p] !== FREE && w.state[p] !== ORBITING)) continue;   // también tus planetas: hacen pedazos lo que se les cruza
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
      const own = w.state[p] === ORBITING, pvx = own ? s.vx : w.vx[p], pvy = own ? s.vy : w.vy[p];
      if (!own && dx * (w.vx[i] - pvx) + dy * (w.vy[i] - pvy) >= 0) continue;   // sólo si se acerca (los escombros que salen, no)
      const d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
      // Contra planetas ajenos, la mayoría se hunde sin ruido (es lo normal: rocas chicas contra un mundo); sólo algunos
      // dejan un golpe visible, y chico. Contra los tuyos se ve siempre.
      if (own || w.rng.next() < 0.35) {
        const slot = (w.impactCount % MAX_IMPACTS) * 4;
        w.impacts[slot] = p; w.impacts[slot + 1] = Math.atan2(dy, dx); w.impacts[slot + 2] = (own ? 1 : 0.55) * (0.25 + 0.4 * Math.min(1, w.radius[i])); w.impactCount++;
      }
      if (!own && w.rng.next() < w.config.rockBounceChance * 0.5) {
        // Rebota, como algo pesado: casi sin rebote en la normal, mucho roce en la tangente; queda apoyado afuera.
        const rvx = w.vx[i] - w.vx[p], rvy = w.vy[i] - w.vy[p];
        const vn = rvx * nx + rvy * ny, vt = rvx * -ny + rvy * nx;
        const outN = -vn * (0.15 + 0.25 * w.rng.next()), outT = vt * (0.35 + 0.35 * w.rng.next());
        w.vx[i] = w.vx[p] + nx * outN - ny * outT; w.vy[i] = w.vy[p] + ny * outN + nx * outT;
        const R = w.radius[p] + w.radius[i] + 0.05;
        w.x[i] = w.x[p] + nx * R; w.y[i] = w.y[p] + ny * R;
        break;
      }
      w.state[i] = DEAD;
      spawnDebris(w, w.x[p] + (dx / d) * w.radius[p], w.y[p] + (dy / d) * w.radius[p], pvx, pvy, w.radius[i] * 1.5, dx / d, dy / d, 2, 0.1, 0.25);
      break;
    }
  }
}
