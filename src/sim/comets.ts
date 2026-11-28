import { DT } from './config';
import { boltReach, returnGathered } from './launch';
import { loseMass } from './integrity';
import { U_REPEL, upg } from './upgrades';
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
    // Cada uno distinto: los grandes son más lentos y giran peor; los chicos, ágiles y rápidos.
    const r = w.rng, sz = 0.6 + 1.0 * r.next();
    cm.size[k] = sz;
    cm.speedMul[k] = (1.35 - 0.35 * sz) * r.range(0.85, 1.15);
    cm.turnMul[k] = (1.3 - 0.5 * sz) * r.range(0.7, 1.1);
    cm.tint[k] = r.next(); cm.bright[k] = r.range(0.6, 1.4); cm.wander[k] = r.range(0, Math.PI * 2);
    cm.hp[k] = Math.max(1, Math.round(w.config.cometHp * sz));
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
  loseMass(w, massGain(w, i));   // te lo robaron: baja la resistencia
}

// Cometas cazadores: aparecen por los bordes, persiguen a la estrella, le roban cuerpos y huyen.
export function stepComets(w: World): void {
  const c = w.config, s = w.star, cm = w.comets;
  if (!w.ignited) return;   // los cometas llegan después de la ignición
  w.cometClock -= DT;
  if (w.cometClock <= 0) {
    // Más seguido a medida que crecés (una estrella grande atrae más cometas), y a veces llegan de a dos.
    spawnOnEdge(w);
    if (w.rng.next() < 0.3 + 0.03 * w.stage) spawnOnEdge(w);
    w.cometClock += c.cometEvery * (1 - 0.4 * Math.min(1, w.stage / 8)) * (1 + 0.35 * upg(w, U_REPEL));   // repelente
  }

  const size = starSize(s.mass);
  for (let k = 0; k < MAX_COMETS; k++) {
    if (cm.mode[k] === COMET_OFF) continue;
    let x = cm.x[k]!, y = cm.y[k]!;
    const dx = s.x - x, dy = s.y - y;
    const d = Math.hypot(dx, dy);

    // Rumbo: hacia la estrella al cazar, en contra al huir, con giro limitado.
    const hunting = cm.mode[k] === COMET_HUNT;
    // No va derecho como un misil: su rumbo hace un vaivén lento (más amplio de lejos) y corrige de a poco.
    const sway = (0.25 + 0.55 * Math.min(1, d / 120)) * Math.sin(w.tick / 60 * 0.5 + cm.wander[k]!);
    const want = (hunting ? Math.atan2(dy, dx) : Math.atan2(-dy, -dx)) + sway;
    const heading = Math.atan2(cm.vy[k]!, cm.vx[k]!);
    let turn = want - heading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const tr = c.cometTurn * cm.turnMul[k]!;
    const h = heading + clamp(turn, -tr * DT, tr * DT);
    const sp = (hunting ? c.cometSpeed : c.cometFleeSpeed) * cm.speedMul[k]!;
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
        // Uno grande se lleva más.
        // Además, con una órbita grande se lleva una parte (un 12 %): siempre se nota.
        const base = Math.max(c.cometStealMin + Math.floor(w.rng.next() * (c.cometStealMax - c.cometStealMin + 1)), Math.round(w.orbitingCount * 0.12));
        const want = Math.max(1, Math.round(base * cm.size[k]! * (1 - 0.25 * upg(w, U_REPEL))));
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
  // Un cometa que toca uno de tus planetas en órbita se destroza contra él.
  for (let q = 0; q < w.planets.length; q++) {
    const p = w.planets[q]!;
    if (w.state[p] !== ORBITING) continue;
    for (let k = 0; k < MAX_COMETS; k++) {
      if (cm.mode[k] === COMET_OFF) continue;
      const r = c.cometRadius + w.radius[p];
      if ((w.x[p] - cm.x[k]!) ** 2 + (w.y[p] - cm.y[k]!) ** 2 < r * r) damage(w, k, c.cometHp);
    }
  }
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
