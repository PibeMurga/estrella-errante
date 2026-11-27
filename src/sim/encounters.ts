import { DT } from './config';
import { hitPlanet, joinsOrbit, planetTier, TIER_BREAK } from './planetCapture';
import { ownPlanet, ownPlanets } from './ownPlanets';
import { breakPlanet, spawnDebris } from './tidal';
import { DEAD, FREE, ORBITING, KIND_GAS, KIND_ICE, KIND_ROCKY, massGain, MAX_IMPACTS, noteBreak, starSize, type World } from './world';

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
  if (w.twin[small]! >= 0) w.state[w.twin[small]!] = DEAD;   // sus dos pedazos
  w.vx[big] = vx; w.vy[big] = vy;
  breakPlanet(w, big, nx, ny, false);
}

// Dos planetas que se tocan chocan como lo que son: masas enormes. Sin rebote: pierden la velocidad con que se acercaban
// (se reparten la cantidad de movimiento) y quedan apoyados, sin encimarse. El golpe queda marcado en los dos. Si el
// chico es rocoso o helado y llegó con fuerza, se parte; si el grande es un gaseoso, el chico se hunde en sus nubes.
function heavyContact(w: World, big: number, small: number, nx: number, ny: number, overlap: number): void {
  const mb = w.mass[big]!, ms = w.mass[small]!, m = mb + ms;
  const rvx = w.vx[small]! - w.vx[big]!, rvy = w.vy[small]! - w.vy[big]!;
  const vn = rvx * nx + rvy * ny;
  // Se separan sin velocidad: cada uno se corre según la masa del otro.
  w.x[small] = w.x[small]! + nx * overlap * (mb / m); w.y[small] = w.y[small]! + ny * overlap * (mb / m);
  w.x[big] = w.x[big]! - nx * overlap * (ms / m); w.y[big] = w.y[big]! - ny * overlap * (ms / m);
  if (vn >= 0) return;   // ya se separan
  // Choque plástico en la normal: se reparte la cantidad de movimiento; en la tangente, roce.
  const jn = -vn, tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
  const f = 0.3;   // roce: pierde parte del deslizamiento
  w.vx[small] = w.vx[small]! + (nx * jn - tx * vt * f) * (mb / m); w.vy[small] = w.vy[small]! + (ny * jn - ty * vt * f) * (mb / m);
  w.vx[big] = w.vx[big]! - (nx * jn - tx * vt * f) * (ms / m); w.vy[big] = w.vy[big]! - (ny * jn - ty * vt * f) * (ms / m);
  if (jn < 0.4) return;   // apenas se rozaron
  // El golpe: cráter en los dos (o una mancha oscura en las nubes del gaseoso).
  const strength = Math.min(1.6, 0.4 + jn / 4);
  mark(w, big, Math.atan2(ny, nx), strength);
  mark(w, small, Math.atan2(-ny, -nx), strength);
  w.contactHits++;
  if (w.kind[big] === KIND_GAS && solid(w.kind[small]!) && w.radius[small]! < w.radius[big]! * 0.6) {
    // Se hunde en el gigante gaseoso: desaparece en sus nubes.
    w.state[small] = DEAD;
    return;
  }
  if (solid(w.kind[small]!) && w.broken[small]! === 0 && jn > 2.5) breakPlanet(w, small, nx, ny, false);
}

// Se deshace contra la estrella: explosión, polvo y picadillo que tu gravedad puede atrapar; la estrella se queda con
// parte de su masa. Sus lunas quedan sueltas.
function disintegrate(w: World, i: number, dx: number, dy: number): void {
  const d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d, r = w.radius[i]!;
  noteBreak(w, i, -ny, nx);
  mark(w, i, Math.atan2(-ny, -nx), 1.4);
  spawnDebris(w, w.x[i]!, w.y[i]!, w.star.vx + nx * 2, w.star.vy + ny * 2, r, -ny, nx, Math.min(16, Math.round(4 + r * 2.5)), 0.3, Math.min(w.config.maxCaptureSize, 0.5 + r * 0.25));
  w.star.mass += massGain(w, i) * 0.5;
  w.state[i] = DEAD;
  for (let j = 0; j < w.count; j++) if (w.parent[j] === i && w.state[j] !== DEAD) { w.parent[j] = -1; w.state[j] = FREE; }
  w.disintegrated++;
}

function mark(w: World, p: number, ang: number, size: number): void {
  const slot = (w.impactCount % MAX_IMPACTS) * 4;
  w.impacts[slot] = p; w.impacts[slot + 1] = ang; w.impacts[slot + 2] = size; w.impactCount++;
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
      const dx = w.x[small]! - w.x[big]!, dy = w.y[small]! - w.y[big]!;
      if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;   // del otro lado de la costura: lejos de verdad
      const sum = ri + rj;
      const D = sum * c.encounterGap, range = D * 4;
      const d2 = dx * dx + dy * dy;
      if (d2 >= range * range) continue;
      const d = Math.sqrt(d2);
      if (canCrash(w, i, j)) {
        if (d < sum * 0.97) { const inv = d > 1e-6 ? 1 / d : 0; crash(w, big, small, d > 1e-6 ? dx * inv : 1, dy * inv); break; }
        continue;
      }
      if (d < sum) heavyContact(w, big, small, d > 1e-6 ? dx / d : 1, d > 1e-6 ? dy / d : 0, sum - d);
    }
  }
}

// Tus planetas en órbita también chocan: un planeta suelto que se les cruza recibe el golpe (pesado, sin rebote) y se
// daña; el tuyo sigue en su órbita (lo sostiene tu estrella). Queda la marca en los dos.
let FREE_NEAR = new Int32Array(64);
export function stepOwnPlanetRams(w: World): void {
  const P = w.planets, s = w.star;
  const nOwn = ownPlanets(w);
  if (nOwn === 0) return;
  // Sólo los sueltos que están cerca de tu sistema.
  const reach = Math.max(60, s.captureRadius * 4);
  let nf = 0;
  if (FREE_NEAR.length < P.length * 2) FREE_NEAR = new Int32Array(P.length * 2);
  for (let b = 0; b < P.length * 2; b++) {
    const f = b < P.length ? P[b]! : w.twin[P[b - P.length]!]!;
    if (f < 0 || w.state[f] !== FREE || w.parent[f] !== -1) continue;
    if (Math.abs(w.x[f]! - s.x) > reach || Math.abs(w.y[f]! - s.y) > reach) continue;
    FREE_NEAR[nf++] = f;
  }
  for (let a = 0; a < nOwn; a++) {
    const o = ownPlanet(a);
    for (let b = 0; b < nf; b++) {
      const f = FREE_NEAR[b]!;
      if (w.state[f] !== FREE) continue;
      const dx = w.x[f]! - w.x[o]!, dy = w.y[f]! - w.y[o]!, D = w.radius[f]! + w.radius[o]!, d2 = dx * dx + dy * dy;
      if (d2 >= D * D) continue;
      const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
      // Se alinea, no rebota: lo chico o partido entra a tu órbita; lo que se puede partir se parte y sus pedazos entran.
      const t = planetTier(w.radius[f]!, s.mass);
      if (joinsOrbit(w, f) || t === TIER_BREAK) {
        if (t === TIER_BREAK && w.broken[f]! === 0) {
          mark(w, f, Math.atan2(-ny, -nx), 1.2);
          hitPlanet(w, f, 1e6);
          const tw = w.twin[f]!;
          if (tw >= 0) w.noCatch[tw] = 0;
        }
        w.noCatch[f] = 0;
        w.vx[f] = s.vx; w.vy[f] = s.vy;   // queda con tu movimiento: la captura lo toma enseguida, sin rebote
        continue;
      }
      w.x[f] = w.x[o]! + nx * D; w.y[f] = w.y[o]! + ny * D;
      const vn = (w.vx[f]! - s.vx) * nx + (w.vy[f]! - s.vy) * ny;
      if (vn >= 0) continue;
      w.vx[f] = w.vx[f]! - nx * vn; w.vy[f] = w.vy[f]! - ny * vn;
      if (-vn > 0.6) {
        mark(w, f, Math.atan2(-ny, -nx), Math.min(1.4, 0.5 - vn / 5));
        mark(w, o, Math.atan2(ny, nx), Math.min(1.2, 0.4 - vn / 6));
        hitPlanet(w, f, Math.max(1, Math.round(-vn / 3)));
      }
    }
  }
}

// Un planeta que la estrella no puede capturar, pero que es más chico que ella, no la atraviesa: choca pesado y se
// desliza apoyado. Los más grandes que la estrella la dañan (eso lo resuelve el paso).
export function stepStarFlybys(w: World): void {
  const c = w.config, s = w.star;
  const size = starSize(s.mass);
  const hw = c.arenaHalfWidth, hh = c.arenaHalfHeight;
  for (let i = 0; i < w.count; i++) {
    const k = w.kind[i]!;
    if (k < KIND_ROCKY || k > KIND_GAS || w.state[i] !== FREE || w.parent[i] !== -1) continue;
    const r = w.radius[i]!;
    if (r <= c.maxCaptureSize || r > size) continue;
    const dx = w.x[i]! - s.x, dy = w.y[i]! - s.y;
    if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;
    // Un pedazo de planeta partido (o uno chico que todavía no podés atrapar) que toca tu estrella se desintegra: explota,
    // se vuelve polvo y picadillo, y la estrella absorbe parte de su masa. Nada la atraviesa.
    if ((w.broken[i]! > 0 && w.kind[i] !== KIND_GAS) || (r <= size * 0.5 && w.noCatch[i]! > 0)) {
      const touch = size + r * 0.6;
      if (dx * dx + dy * dy < touch * touch) disintegrate(w, i, dx, dy);
      continue;
    }
    if (r <= size * 0.5 || w.broken[i]! > 0) continue;   // los chicos y los partidos gaseosos entran solos
    // Choca pesado contra la estrella: sin rebote ni arco; pierde la velocidad con que se acercaba y se desliza apoyado.
    const D = size + r, d2 = dx * dx + dy * dy;
    if (d2 >= D * D) continue;
    const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
    w.x[i] = s.x + nx * D; w.y[i] = s.y + ny * D;
    const rvx = w.vx[i]! - s.vx, rvy = w.vy[i]! - s.vy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      // Impacto seco, como un choque de autos: los dos pierden la velocidad con que se acercaban (se la reparten según su
      // masa; la estrella pesa más), el planeta se marca con una explosión y un cráter, y el golpe lo daña.
      // Masas comparables: la estrella pesa como una esfera de su tamaño.
      const ms = size * size * size, mp = w.mass[i]!, m = ms + mp;
      const vt = rvx * -ny + rvy * nx;
      // Choque plástico en la normal: los dos terminan con la misma velocidad normal (la del centro de masa).
      const dvS = vn * (mp / m), dvP = -vn * (ms / m);   // cambios de velocidad normal de cada uno
      s.vx += nx * dvS; s.vy += ny * dvS;
      w.vx[i] = w.vx[i]! + nx * dvP - (-ny) * vt * 0.4; w.vy[i] = w.vy[i]! + ny * dvP - nx * vt * 0.4;
      if (-vn > 0.5) {
        // El impacto contra una estrella es demasiado para un planeta más chico que ella: se parte en el acto.
        mark(w, i, Math.atan2(-ny, -nx), Math.min(1.6, 0.8 - vn / 4));
        hitPlanet(w, i, 1e6);
      }
    }
  }
}

// El cuerpo `i` bordea un obstáculo en (ox, oy) que se mueve a (ovx, ovy), sin acercarse a menos de D.
// Si viene hacia él y lo pasaría demasiado cerca, se lo corre de costado de a poco, repartiendo el corrimiento
// en lo que falta para el punto de máximo acercamiento. La velocidad no se toca: pasado el encuentro sigue igual.
function bypass(w: World, i: number, ox: number, oy: number, ovx: number, ovy: number, dx: number, dy: number, D: number): void {
  const vx = w.vx[i]! - ovx, vy = w.vy[i]! - ovy;
  const v2 = vx * vx + vy * vy;
  const closing = dx * vx + dy * vy;
  if (v2 > 1e-6 && closing < 0) {
    const v = Math.sqrt(v2), px = -vy / v, py = vx / v;
    const lat = dx * px + dy * py;
    const miss = Math.abs(lat);
    if (miss < D) {
      const tca = -closing / v2;
      const f = Math.min(1, (1.1 * DT) / Math.max(tca, DT));   // suave: el desvío se reparte en todo el acercamiento
      const push = (D - miss) * f * (lat >= 0 ? 1 : -1);
      w.x[i] = w.x[i]! + px * push;
      w.y[i] = w.y[i]! + py * push;
      dx += px * push; dy += py * push;
    }
  }
  // Piso duro: nunca más cerca que D.
  const e2 = dx * dx + dy * dy;
  if (e2 < D * D) {
    const e = Math.sqrt(e2);
    w.x[i] = ox + (e > 1e-6 ? dx / e : 1) * D;
    w.y[i] = oy + (e > 1e-6 ? dy / e : 0) * D;
  }
}
