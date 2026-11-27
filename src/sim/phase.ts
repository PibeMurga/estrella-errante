import { DT } from './config';
import { STAGE_HYPER } from './stages';
import { CARRIED, FREE, OVER_NONE, OVER_WON, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, PHASE_PLAY, PROJECTILE, RETURNING, type World } from './world';

// La meta de la pantalla: superar en masa al agujero negro rival, colapsar, cazarlo y fusionarse.
// Masa del rival en la misma escala que la tuya (la de las barras).
export function rivalMass(w: World): number {
  return w.config.rivalMassScale * w.bh.mass;
}

// Radio de tu agujero negro: la misma fórmula que el rival, con tu masa pasada a su escala.
export function playerHoleRadius(w: World): number {
  return w.config.bhStartRadius * Math.cbrt(Math.max(w.star.mass, 1e-6) / w.config.rivalMassScale);
}

// Se puede colapsar siendo hipergigante y con más masa que el rival. Lo decide el jugador.
export function canCollapse(w: World): boolean {
  return w.phase === PHASE_PLAY && w.over === OVER_NONE && w.bh.active && w.stage >= STAGE_HYPER && w.star.mass > rivalMass(w);
}

// Empieza la supernova: la estrella se detiene, los cometas se apagan y sueltan lo que llevaban, y lo lanzado queda libre.
export function startCollapse(w: World): void {
  w.phase = PHASE_COLLAPSE; w.phaseTime = 0;
  w.star.vx = 0; w.star.vy = 0;
  const cm = w.comets;
  for (let k = 0; k < cm.mode.length; k++) {
    const c = cm.carry[k]!;
    if (c >= 0 && w.state[c] === CARRIED) { w.state[c] = FREE; w.vx[c] = 0; w.vy[c] = 0; w.noCatch[c] = 0; }
    cm.carry[k] = -1; cm.mode[k] = 0;
  }
  for (let i = 0; i < w.count; i++) if (w.state[i] === PROJECTILE || w.state[i] === RETURNING) w.state[i] = FREE;
}

// Nace tu agujero negro y empieza la caza. Si el rival quedó demasiado lejos, se lo acerca fuera de cámara.
export function startHunt(w: World): void {
  w.phase = PHASE_HUNT; w.phaseTime = 0;
  const s = w.star, bh = w.bh, max = w.config.huntStartMaxDist;
  const dx = bh.x - s.x, dy = bh.y - s.y, d = Math.hypot(dx, dy);
  if (d > max) { bh.x = bh.prevX = s.x + (dx / d) * max; bh.y = bh.prevY = s.y + (dy / d) * max; }
}

// Lo alcanzaste: los dos agujeros giran uno alrededor del otro, cada vez más cerca y más rápido.
export function startMerge(w: World): void {
  w.phase = PHASE_MERGE; w.phaseTime = 0;
  const s = w.star, bh = w.bh;
  w.mergeR = Math.max(1, Math.hypot(bh.x - s.x, bh.y - s.y));
  w.mergeA = Math.atan2(bh.y - s.y, bh.x - s.x);
  s.vx = 0; s.vy = 0;
}

export function stepMerge(w: World): void {
  const s = w.star, bh = w.bh;
  const p = Math.min(1, w.phaseTime / w.config.mergeTime);
  w.mergeA += DT * (0.8 + 9 * p * p);
  const r = w.mergeR * (1 - p) ** 1.5;
  bh.x = s.x + Math.cos(w.mergeA) * r; bh.y = s.y + Math.sin(w.mergeA) * r;
  bh.vx = 0; bh.vy = 0;
  if (w.phaseTime >= w.config.mergeTime) {
    s.mass += rivalMass(w);
    bh.active = false;
    w.over = OVER_WON;
  }
}
