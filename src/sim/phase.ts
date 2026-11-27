import { DT } from './config';
import { releaseLaunch } from './launch';
import { STAGE_HYPER } from './stages';
import { CARRIED, FREE, OVER_NONE, OVER_WON, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, PHASE_PLAY, type World } from './world';

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
  for (let k = 0; k < cm.mode.length; k++) { cm.carry[k] = 0; cm.mode[k] = 0; }
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== CARRIED) continue;
    w.state[i] = FREE; w.parent[i] = -1; w.vx[i] = 0; w.vy[i] = 0; w.noCatch[i] = 0;
  }
  releaseLaunch(w);   // lo que se juntaba vuelve a la órbita y lo que vuela queda suelto
}

// Nace tu agujero negro y empieza la caza. Si el rival quedó demasiado lejos, se lo acerca fuera de cámara.
export function startHunt(w: World): void {
  w.phase = PHASE_HUNT; w.phaseTime = 0;
  const s = w.star, bh = w.bh, max = w.config.huntStartMaxDist;
  const dx = bh.x - s.x, dy = bh.y - s.y, d = Math.hypot(dx, dy);
  const min = w.config.huntStartMinDist;
  const ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
  if (d > max) { bh.x = bh.prevX = s.x + ux * max; bh.y = bh.prevY = s.y + uy * max; }
  else if (d < min) { bh.x = bh.prevX = s.x + ux * min; bh.y = bh.prevY = s.y + uy * min; }   // nunca pegado: hay que cazarlo
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
    if (s.mass > w.maxMass) w.maxMass = s.mass;
    bh.active = false;
    w.over = OVER_WON;
  }
}
