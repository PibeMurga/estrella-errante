import { DT } from './config';
import { boltReach, returnGathered } from './launch';
import { isPlanetKind } from './planetCapture';
import { BOLT, CARRIED, DEAD, FREE, KIND_ASTEROID, MAX_COMETS, massGain, ORBITING, PROJECTILE, RETURNING, starSize, type World } from './world';

export const COMET_OFF = 0;
export const COMET_HUNT = 1;
export const COMET_FLEE = 2;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

// Activa un cometa de la reserva en (x, y). Devuelve su índice, o -1 si la reserva está llena.
export function spawnComet(w: World, x: number, y: number): number {
  const cm = w.comets;
  for (let k = 0; k < MAX_COMETS; k++) {
    if (cm.mode[k] !== COMET_OFF) continue;
    cm.mode[k] = COMET_HUNT;
    cm.x[k] = cm.prevX[k] = x; cm.y[k] = cm.prevY[k] = y;
    const dx = w.star.x - x, dy = w.star.y - y, d = Math.hypot(dx, dy) || 1;
    cm.vx[k] = (dx / d) * w.config.cometSpeed; cm.vy[k] = (dy / d) * w.config.cometSpeed;
    cm.hp[k] = w.config.cometHp;
    cm.timer[k] = 0;
    cm.carry[k] = 0;
    return k;
  }
  return -1;
}

// Aparece lejos, en un punto al azar del borde de la zona que rodea a la estrella (siempre fuera de cámara).
function spawnOnEdge(w: World): void {
  const hw = w.config.arenaHalfWidth, hh = w.config.arenaHalfHeight, r = w.rng;
  const side = Math.floor(r.next() * 4);
  const t = r.range(-1, 1);
  const x = side === 0 ? -hw : side === 1 ? hw : t * hw;
  const y = side === 2 ? -hh : side === 3 ? hh : t * hh;
  spawnComet(w, w.star.x + x * 0.98, w.star.y + y * 0.98);
}

// Revive asteroides de la reserva (cuerpos DEAD de tipo asteroide) alrededor de (x, y).
function scatterDebris(w: World, x: number, y: number, n: number): void {
  let left = n;
  for (let i = 0; i < w.count && left > 0; i++) {
    if (w.state[i] !== DEAD || w.kind[i] !== KIND_ASTEROID) continue;
    const a = w.rng.range(0, Math.PI * 2), sp = w.rng.range(3, 9);
    w.x[i] = w.prevX[i] = x + Math.cos(a) * 1.5;
    w.y[i] = w.prevY[i] = y + Math.sin(a) * 1.5;
    w.vx[i] = Math.cos(a) * sp; w.vy[i] = Math.sin(a) * sp;
    w.radius[i] = w.rng.range(0.35, 0.8);
    w.mass[i] = w.radius[i] ** 3;
    w.parent[i] = -1;
    w.noCatch[i] = 0.4;
    w.state[i] = FREE;
    left--;
  }
}

function damage(w: World, k: number, amount: number): void {
  const cm = w.comets;
  cm.hp[k] = cm.hp[k]! - amount;
  if (cm.hp[k]! > 0) return;
  cm.mode[k] = COMET_OFF;
  w.cometKills++;
  // Suelta todo lo que robó: queda flotando para recuperarlo.
  if (cm.carry[k]! > 0) {
    for (let i = 0; i < w.count; i++) {
      if (w.state[i] !== CARRIED || w.parent[i] !== k) continue;
      w.state[i] = FREE; w.parent[i] = -1;
      w.vx[i] = cm.vx[k]! * 0.4; w.vy[i] = cm.vy[k]! * 0.4;
      w.noCatch[i] = 0.3;
    }
    cm.carry[k] = 0;
  }
  scatterDebris(w, cm.x[k]!, cm.y[k]!, w.config.cometDebris);
}

// El cometa k se lleva el cuerpo i de tu órbita.
function steal(w: World, k: number, i: number): void {
  w.state[i] = CARRIED;
  w.parent[i] = k;
  w.orbitingCount--;
  w.star.mass = Math.max(w.config.starStartMass, w.star.mass - massGain(w, i));
}

// Cometas cazadores: aparecen por los bordes, persiguen a la estrella, le roban cuerpos y huyen.
export function stepComets(w: World): void {
  const c = w.config, s = w.star, cm = w.comets;
  w.cometClock -= DT;
  if (w.cometClock <= 0) { spawnOnEdge(w); w.cometClock += c.cometEvery; }

  const size = starSize(s.mass);
  for (let k = 0; k < MAX_COMETS; k++) {
    if (cm.mode[k] === COMET_OFF) continue;
    let x = cm.x[k]!, y = cm.y[k]!;
    const dx = s.x - x, dy = s.y - y;
    const d = Math.hypot(dx, dy);

    // Rumbo: hacia la estrella al cazar, en contra al huir, con giro limitado.
    const hunting = cm.mode[k] === COMET_HUNT;
    const want = hunting ? Math.atan2(dy, dx) : Math.atan2(-dy, -dx);
    const heading = Math.atan2(cm.vy[k]!, cm.vx[k]!);
    let turn = want - heading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const h = heading + clamp(turn, -c.cometTurn * DT, c.cometTurn * DT);
    const sp = hunting ? c.cometSpeed : c.cometFleeSpeed;
    cm.vx[k] = Math.cos(h) * sp; cm.vy[k] = Math.sin(h) * sp;
    x += cm.vx[k]! * DT;
    y += cm.vy[k]! * DT;
    // Sin bordes: la vuelta se calcula alrededor de la estrella.
    const hw = c.arenaHalfWidth, hh = c.arenaHalfHeight;
    if (x - s.x > hw) { x -= 2 * hw; cm.prevX[k] = cm.prevX[k]! - 2 * hw; } else if (x - s.x < -hw) { x += 2 * hw; cm.prevX[k] = cm.prevX[k]! + 2 * hw; }
    if (y - s.y > hh) { y -= 2 * hh; cm.prevY[k] = cm.prevY[k]! - 2 * hh; } else if (y - s.y < -hh) { y += 2 * hh; cm.prevY[k] = cm.prevY[k]! + 2 * hh; }
    cm.x[k] = x; cm.y[k] = y;

    if (!hunting) {
      cm.timer[k] = cm.timer[k]! - DT;
      if (cm.timer[k]! <= 0) cm.mode[k] = COMET_HUNT;
    } else if (d < size + c.cometRadius) {
      // Toca la estrella: le roba de 3 a 5 cuerpos de la órbita (los más cercanos) y,
      // a veces, al azar, también el planeta más chico de tu sistema. Después huye.
      returnGathered(w);   // te toca: se desarma el montón y puede robar igual
      if (cm.carry[k] === 0 && w.orbitingCount > 0) {
        const want = c.cometStealMin + Math.floor(w.rng.next() * (c.cometStealMax - c.cometStealMin + 1));
        let got = 0;
        while (got < want) {
          let best = -1, bestD = Infinity;
          for (let i = 0; i < w.count; i++) {
            if (w.state[i] !== ORBITING || isPlanetKind(w.kind[i]!)) continue;
            const e = (w.x[i] - x) ** 2 + (w.y[i] - y) ** 2;
            if (e < bestD) { bestD = e; best = i; }
          }
          if (best < 0) break;
          steal(w, k, best); got++;
        }
        if (w.rng.next() < c.cometPlanetChance) {
          let small = -1;
          for (let q = 0; q < w.planets.length; q++) { const p = w.planets[q]!; if (w.state[p] === ORBITING && (small < 0 || w.radius[p] < w.radius[small])) small = p; }
          if (small >= 0) { steal(w, k, small); got++; }
        }
        cm.carry[k] = got;
        if (got > 0) { w.lastStealCount = got; w.cometSteals++; }
      }
      cm.mode[k] = COMET_FLEE;
      cm.timer[k] = c.cometFleeTime;
    }

    // Lo robado va arrastrado en fila detrás del cometa.
    if (cm.carry[k]! > 0) {
      const v = Math.hypot(cm.vx[k]!, cm.vy[k]!) || 1;
      const dx = cm.vx[k]! / v, dy = cm.vy[k]! / v;
      const hw = c.arenaHalfWidth, hh = c.arenaHalfHeight;
      let j = 0;
      for (let i = 0; i < w.count; i++) {
        if (w.state[i] !== CARRIED || w.parent[i] !== k) continue;
        const back = 4 + 1.6 * j, side = (j % 2 ? 1 : -1) * 0.6;
        w.x[i] = x - dx * back - dy * side;
        w.y[i] = y - dy * back + dx * side;
        // Si el cometa dio la vuelta, lo arrastrado acompaña el salto también en su posición anterior.
        if (w.x[i] - w.prevX[i] > hw) w.prevX[i] += 2 * hw; else if (w.prevX[i] - w.x[i] > hw) w.prevX[i] -= 2 * hw;
        if (w.y[i] - w.prevY[i] > hh) w.prevY[i] += 2 * hh; else if (w.prevY[i] - w.y[i] > hh) w.prevY[i] -= 2 * hh;
        j++;
      }
    }
  }

  // Golpes de honda (3 lo matan; el proyectil rebota y vuelve) y de bólido (1 lo mata y sigue de largo).
  let any = false;
  for (let k = 0; k < MAX_COMETS; k++) if (cm.mode[k] !== COMET_OFF) any = true;
  if (!any) return;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== PROJECTILE && w.state[i] !== BOLT) continue;
    for (let k = 0; k < MAX_COMETS; k++) {
      if (cm.mode[k] === COMET_OFF) continue;
      const r = c.cometRadius + w.radius[i] + (w.state[i] === BOLT ? boltReach(w) : 0);
      if ((w.x[i] - cm.x[k]!) ** 2 + (w.y[i] - cm.y[k]!) ** 2 < r * r) {
        if (w.state[i] === BOLT) { damage(w, k, c.cometHp); break; }
        w.state[i] = RETURNING;
        damage(w, k, 1);
        break;
      }
    }
  }
}
