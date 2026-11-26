import { DT } from './config';
import { CARRIED, DEAD, FREE, KIND_ASTEROID, MAX_COMETS, ORBITING, PROJECTILE, RETURNING, starSize, type World } from './world';

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
    cm.carry[k] = -1;
    cm.beamId[k] = w.eclipses;
    return k;
  }
  return -1;
}

// Aparece en un punto al azar de alguno de los cuatro bordes.
function spawnOnEdge(w: World): void {
  const hw = w.config.arenaHalfWidth, hh = w.config.arenaHalfHeight, r = w.rng;
  const side = Math.floor(r.next() * 4);
  const t = r.range(-1, 1);
  const x = side === 0 ? -hw : side === 1 ? hw : t * hw;
  const y = side === 2 ? -hh : side === 3 ? hh : t * hh;
  spawnComet(w, x, y);
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
  const c = cm.carry[k]!;
  if (c >= 0) {
    w.state[c] = FREE;
    w.vx[c] = cm.vx[k]! * 0.4; w.vy[c] = cm.vy[k]! * 0.4;
    w.noCatch[c] = 0.3;
    cm.carry[k] = -1;
  }
  scatterDebris(w, cm.x[k]!, cm.y[k]!, w.config.cometDebris);
}

// Cometas cazadores: aparecen por los bordes, persiguen a la estrella, le roban un mundo y huyen.
export function stepComets(w: World): void {
  const c = w.config, s = w.star, cm = w.comets;
  w.cometClock -= DT;
  if (w.cometClock <= 0) { spawnOnEdge(w); w.cometClock += c.cometEvery; }

  const size = starSize(s.mass);
  const beamOn = w.beamTime > 0;
  const bx = Math.cos(w.eclipseAngle), by = Math.sin(w.eclipseAngle);
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
    x = clamp(x + cm.vx[k]! * DT, -c.arenaHalfWidth, c.arenaHalfWidth);
    y = clamp(y + cm.vy[k]! * DT, -c.arenaHalfHeight, c.arenaHalfHeight);
    cm.x[k] = x; cm.y[k] = y;

    if (!hunting) {
      cm.timer[k] = cm.timer[k]! - DT;
      if (cm.timer[k]! <= 0) cm.mode[k] = COMET_HUNT;
    } else if (d < size + c.cometRadius) {
      // Toca la estrella: le roba el mundo en órbita más cercano (si no lleva uno) y huye.
      if (cm.carry[k]! < 0 && w.orbitingCount > 0) {
        let best = -1, bestD = Infinity;
        for (let i = 0; i < w.count; i++) {
          if (w.state[i] !== ORBITING) continue;
          const e = (w.x[i] - x) ** 2 + (w.y[i] - y) ** 2;
          if (e < bestD) { bestD = e; best = i; }
        }
        if (best >= 0) {
          w.state[best] = CARRIED;
          w.orbitingCount--;
          s.mass = Math.max(c.starStartMass, s.mass - w.mass[best]);
          cm.carry[k] = best;
          w.cometSteals++;
        }
      }
      cm.mode[k] = COMET_FLEE;
      cm.timer[k] = c.cometFleeTime;
    }

    // Lo robado va arrastrado detrás del cometa.
    const carried = cm.carry[k]!;
    if (carried >= 0) {
      const v = Math.hypot(cm.vx[k]!, cm.vy[k]!) || 1;
      w.x[carried] = x - (cm.vx[k]! / v) * 4;
      w.y[carried] = y - (cm.vy[k]! / v) * 4;
    }

    // Rayo del eclipse: 3 de daño, una sola vez por rayo.
    if (beamOn && cm.beamId[k] !== w.eclipses) {
      const rx = x - s.x, ry = y - s.y;
      const along = rx * bx + ry * by;
      const across = Math.abs(rx * by - ry * bx);
      if (along > 0 && along < c.beamLength && across < c.beamHalfWidth + c.cometRadius) {
        cm.beamId[k] = w.eclipses;
        damage(w, k, 3);
        continue;
      }
    }
  }

  // Golpes de honda: el proyectil rebota y vuelve a la estrella.
  let any = false;
  for (let k = 0; k < MAX_COMETS; k++) if (cm.mode[k] !== COMET_OFF) any = true;
  if (!any) return;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== PROJECTILE) continue;
    for (let k = 0; k < MAX_COMETS; k++) {
      if (cm.mode[k] === COMET_OFF) continue;
      const r = c.cometRadius + w.radius[i];
      if ((w.x[i] - cm.x[k]!) ** 2 + (w.y[i] - cm.y[k]!) ** 2 < r * r) {
        w.state[i] = RETURNING;
        damage(w, k, 1);
        break;
      }
    }
  }
}
