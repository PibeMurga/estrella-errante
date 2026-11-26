import { DT } from './config';
import { breakPlanet } from './tidal';
import { DEAD, FREE, KIND_GAS, KIND_ICE, KIND_ROCKY, type World } from './world';

// Encuentros entre planetas libres. Dos planetas no se atraviesan: el más chico bordea al más grande por fuera,
// en arco, y sigue con la misma dirección y velocidad que traía (sólo se corre su posición, nunca su velocidad).
// Excepción rara: dos rocosos o helados casi iguales pueden chocar de verdad. El más grande queda partido,
// el más chico se deshace en escombros, y lo que queda sigue con la cantidad de movimiento de los dos.

const MAX_PLANETS = 2048;
const list = new Int32Array(MAX_PLANETS);   // se reutiliza en cada paso: no se crean objetos en el bucle

// Sorteo fijo por par: el mismo par siempre decide igual si puede chocar (determinista y sin consumir el rng).
export function crashPairRoll(i: number, j: number): number {
  const a = Math.min(i, j), b = Math.max(i, j);
  let h = Math.imul(a, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

const solid = (k: number): boolean => k === KIND_ROCKY || k === KIND_ICE;

export function canCrash(w: World, i: number, j: number): boolean {
  const c = w.config;
  if (!solid(w.kind[i]!) || !solid(w.kind[j]!)) return false;
  if (w.broken[i]! > 0 || w.broken[j]! > 0) return false;
  const ri = w.radius[i]!, rj = w.radius[j]!;
  if (Math.max(ri, rj) / Math.min(ri, rj) > c.crashSizeRatio) return false;
  return crashPairRoll(i, j) < c.crashChance;
}

function crash(w: World, big: number, small: number, nx: number, ny: number): void {
  const mb = w.mass[big]!, ms = w.mass[small]!, m = mb + ms;
  const vx = (w.vx[big]! * mb + w.vx[small]! * ms) / m, vy = (w.vy[big]! * mb + w.vy[small]! * ms) / m;
  w.crashX = (w.x[big]! * mb + w.x[small]! * ms) / m;
  w.crashY = (w.y[big]! * mb + w.y[small]! * ms) / m;
  w.crashR = w.radius[big]! + w.radius[small]!;
  w.planetCrashes++;
  // El chico se deshace: suelta sus escombros y desaparece. El grande queda partido en el eje del impacto.
  w.vx[small] = vx; w.vy[small] = vy;
  breakPlanet(w, small, nx, ny, false);
  w.state[small] = DEAD;
  w.vx[big] = vx; w.vy[big] = vy;
  breakPlanet(w, big, nx, ny, false);
}

export function stepEncounters(w: World): void {
  const c = w.config;
  const hw = c.arenaHalfWidth, hh = c.arenaHalfHeight;
  let n = 0;
  for (let i = 0; i < w.count && n < MAX_PLANETS; i++) {
    const k = w.kind[i]!;
    if (k >= KIND_ROCKY && k <= KIND_GAS && w.state[i] === FREE && w.parent[i] === -1) list[n++] = i;
  }
  for (let a = 0; a < n; a++) {
    const i = list[a]!;
    if (w.state[i] !== FREE) continue;
    for (let b = a + 1; b < n; b++) {
      const j = list[b]!;
      if (w.state[j] !== FREE) continue;
      const ri = w.radius[i]!, rj = w.radius[j]!;
      // El grande es el de mayor radio (a igual radio, el de menor índice).
      const big = ri >= rj ? i : j, small = big === i ? j : i;
      let dx = w.x[small]! - w.x[big]!, dy = w.y[small]! - w.y[big]!;
      if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;   // del otro lado de la costura: lejos de verdad
      const sum = ri + rj;
      const D = sum * c.encounterGap, range = D * 3;
      const d2 = dx * dx + dy * dy;
      if (d2 >= range * range) continue;
      const d = Math.sqrt(d2);
      if (canCrash(w, i, j)) {
        if (d < sum * 0.97) { const inv = d > 1e-6 ? 1 / d : 0; crash(w, big, small, d > 1e-6 ? dx * inv : 1, dy * inv); break; }
        continue;
      }
      // Bordea: si el chico viene hacia el grande y lo pasaría a menos de D, se lo corre de costado, de a poco,
      // repartiendo el corrimiento en lo que falta para el punto de máximo acercamiento. La velocidad no se toca,
      // así que pasado el encuentro sigue en la misma dirección, sobre una línea paralela.
      const vx = w.vx[small]! - w.vx[big]!, vy = w.vy[small]! - w.vy[big]!;
      const v2 = vx * vx + vy * vy;
      const closing = dx * vx + dy * vy;
      if (v2 > 1e-6 && closing < 0) {
        const v = Math.sqrt(v2), px = -vy / v, py = vx / v;
        const lat = dx * px + dy * py;
        const miss = Math.abs(lat);
        if (miss < D) {
          const tca = -closing / v2;                      // segundos hasta el máximo acercamiento
          const f = Math.min(1, (1.6 * DT) / Math.max(tca, DT));
          const side = lat >= 0 ? 1 : -1;
          const push = (D - miss) * f * side;
          w.x[small] = w.x[small]! + px * push;
          w.y[small] = w.y[small]! + py * push;
          dx += px * push; dy += py * push;
        }
      }
      // Piso duro: nunca más cerca que D (por ejemplo, si quedaron casi quietos uno contra otro).
      const e2 = dx * dx + dy * dy;
      if (e2 < D * D) {
        const e = Math.sqrt(e2);
        const ux = e > 1e-6 ? dx / e : 1, uy = e > 1e-6 ? dy / e : 0;
        w.x[small] = w.x[big]! + ux * D;
        w.y[small] = w.y[big]! + uy * D;
      }
    }
  }
}
