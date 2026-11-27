import { DT } from './config';
import type { Intent } from './step';
import { BOLT, DEAD, massGain, FREE, GATHERING, KIND_ASTEROID, KIND_MOON, ORBITING, PROJECTILE, RETURNING, starSize, type World } from './world';

// Lanzamiento con un solo botón. Un toque lanza un asteroide que vuelve (la honda).
// Mantenido, junta asteroides de la órbita en un bólido adelante de la estrella; al soltar sale, y esos asteroides se pierden.
// Nunca se lanzan planetas: sólo asteroides y lunas chicas.

const launchable = (w: World, i: number): boolean => w.state[i] === ORBITING && (w.kind[i] === KIND_ASTEROID || w.kind[i] === KIND_MOON);

// Dirección de la honda: la mira propia; si no, el objetivo; si está encima de la estrella, el cometa más cercano;
// si no hay cometas, hacia donde se mueve. Devuelve NaN si no hay ninguna dirección razonable.
export function slingAngle(w: World, it: Intent): number {
  const s = w.star;
  if (it.hasAim && Number.isFinite(it.aimX) && Number.isFinite(it.aimY)) {
    const dx = it.aimX! - s.x, dy = it.aimY! - s.y;
    if (dx * dx + dy * dy > 1e-6) return Math.atan2(dy, dx);
  }
  if (it.hasTarget && Number.isFinite(it.targetX) && Number.isFinite(it.targetY)) {
    const dx = it.targetX - s.x, dy = it.targetY - s.y;
    if (dx * dx + dy * dy > 4) return Math.atan2(dy, dx);
  }
  const cm = w.comets;
  let best = -1, bestD = Infinity;
  for (let k = 0; k < cm.mode.length; k++) {
    if (cm.mode[k] === 0) continue;
    const e = (cm.x[k]! - s.x) ** 2 + (cm.y[k]! - s.y) ** 2;
    if (e < bestD) { bestD = e; best = k; }
  }
  if (best >= 0) return Math.atan2(cm.y[best]! - s.y, cm.x[best]! - s.x);
  if (s.vx * s.vx + s.vy * s.vy > 1) return Math.atan2(s.vy, s.vx);
  return Number.NaN;
}

// El cuerpo lanzable cuyo ángulo en la órbita está más cerca de `aim`, o -1.
function closestTo(w: World, aim: number): number {
  let best = -1, bestDiff = Infinity;
  for (let i = 0; i < w.count; i++) {
    if (!launchable(w, i)) continue;
    let d = Math.abs(w.orbitAngle[i] - aim) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return best;
}

// Disparar frena a la estrella: pierde parte de su velocidad y la recupera de a poco (ver el movimiento en step).
function brakeOnFire(w: World, k: number): void {
  w.star.vx *= 1 - k; w.star.vy *= 1 - k;
  w.fireSlow = w.config.fireRecover; w.fireSlowK = k;
}

// Honda: lanza el cuerpo más cercano a la mira; vuelve a la órbita después del vuelo.
export function sling(w: World, aim: number): void {
  const c = w.config, s = w.star;
  const best = closestTo(w, aim);
  if (best < 0) return;
  w.state[best] = PROJECTILE;
  w.vx[best] = Math.cos(aim) * c.slingSpeed + s.vx;
  w.vy[best] = Math.sin(aim) * c.slingSpeed + s.vy;
  w.life[best] = c.slingLife;
  w.orbitingCount--;
  w.slingCd = c.slingCooldown;
  w.shots++;
  brakeOnFire(w, c.slingBrake);
}

// Suma al bólido el cuerpo lanzable más cercano a la mira. false si no queda ninguno.
function gatherOne(w: World): boolean {
  const best = closestTo(w, w.boltAngle);
  if (best < 0) return false;
  w.state[best] = GATHERING;
  w.orbitingCount--;
  w.gathered++;
  return true;
}

function launchBolt(w: World): void {
  const c = w.config, s = w.star;
  if (w.gathered === 0) return;
  const ax = Math.cos(w.boltAngle), ay = Math.sin(w.boltAngle);
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== GATHERING) continue;
    w.state[i] = BOLT;
    w.vx[i] = ax * c.boltSpeed + s.vx; w.vy[i] = ay * c.boltSpeed + s.vy;
    w.life[i] = c.boltLife;
    s.mass = Math.max(c.starStartMass, s.mass - massGain(w, i));   // se pierde: un golpe fuerte te deja más liviano
  }
  w.lastBoltSize = w.gathered;
  w.gathered = 0;
  w.bolts++;
  w.slingCd = c.slingCooldown;
  brakeOnFire(w, c.boltBrake);
}

// Lee el botón: mientras se mantiene, carga; al soltarlo, toque o bólido.
export function stepLaunch(w: World, intent: Intent): void {
  const c = w.config;
  if (intent.hold === true) {
    if (w.charge === 0 && (w.slingCd > 0 || w.orbitingCount === 0)) return;   // no arranca a cargar
    w.charge += DT;
    const a = slingAngle(w, intent);
    if (Number.isFinite(a)) w.boltAngle = a;
    if (w.charge >= c.tapTime) {
      const max = c.boltMax + (w.ability >= 3 ? c.abilityBoltBonus : 0);   // bólido mayor
      const want = Math.min(max, 1 + Math.floor((w.charge - c.tapTime) * c.boltGatherRate));
      while (w.gathered < want && gatherOne(w)) { /* suma de a uno */ }
    }
    return;
  }
  if (w.charge <= 0) return;
  const tap = w.charge < c.tapTime;
  w.charge = 0;
  if (tap) { if (w.orbitingCount > 0) sling(w, w.boltAngle); return; }
  launchBolt(w);
}

// Lo que se junta se compacta adelante de la estrella; lo que vuela sigue derecho, le pega al agujero negro o se pierde.
export function stepBolts(w: World): void {
  const c = w.config, s = w.star, bh = w.bh;
  // El montón se arma pegado a la estrella, justo por fuera de su superficie y hacia donde apuntás:
  // así sale desde cerca y no queda del otro lado de un planeta que todavía no es tuyo.
  const gr = starSize(s.mass) * 1.15 + c.boltGatherDist;
  const px = s.x + Math.cos(w.boltAngle) * gr;
  const py = s.y + Math.sin(w.boltAngle) * gr;
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st === GATHERING) {
      // Cada uno tiene su lugarcito en el montón (según su índice), para que no queden encimados.
      const off = ((i * 0.618034) % 1) * Math.PI * 2, rr = 0.6 + ((i * 0.381966) % 1) * 1.2;
      const tx = px + Math.cos(off) * rr - w.x[i], ty = py + Math.sin(off) * rr - w.y[i];
      const d = Math.hypot(tx, ty), mv = Math.min(d, 40 * DT);
      if (d > 1e-6) { w.x[i] += (tx / d) * mv; w.y[i] += (ty / d) * mv; }
      w.vx[i] = s.vx; w.vy[i] = s.vy;
    } else if (st === BOLT) {
      w.x[i] += w.vx[i] * DT; w.y[i] += w.vy[i] * DT;
      if (bh.active) {
        const gx = bh.x - w.x[i], gy = bh.y - w.y[i];
        if (gx * gx + gy * gy < bh.radius * bh.radius * 1.44) {
          // Le pegó al agujero negro: lo alimenta y lo frena un poco. No lo empuja.
          w.state[i] = DEAD;
          bh.mass += w.mass[i] * c.boltBhFeed;
          if (w.bhSlow <= 0) w.boltHitsBh++;
          w.bhSlow = c.boltBhSlow;
          continue;
        }
      }
      w.life[i] = w.life[i]! - DT;
      if (w.life[i]! <= 0) {
        w.state[i] = FREE;
        w.vx[i] *= c.boltLoseSlow; w.vy[i] *= c.boltLoseSlow;
        w.noCatch[i] = c.boltNoCatch;
      }
    }
  }
}

// Se desarma el montón: lo que se juntaba vuelve a la órbita desde donde está (sin saltos). Lo usan un choque,
// un cometa que te toca y el colapso. Mientras se junta, el montón sigue siendo tuyo.
export function returnGathered(w: World): void {
  if (w.gathered === 0 && w.charge === 0) return;
  const s = w.star;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== GATHERING) continue;
    const dx = w.x[i] - s.x, dy = w.y[i] - s.y;
    w.state[i] = ORBITING;
    w.orbitR[i] = Math.hypot(dx, dy);
    w.orbitTarget[i] = w.orbitR[i];
    w.orbitAngle[i] = Math.atan2(dy, dx);
    w.orbitingCount++;
  }
  w.charge = 0; w.gathered = 0;
}

// Colapso: lo que se juntaba vuelve a la órbita y lo que vuela (bólido u honda) queda suelto.
export function releaseLaunch(w: World): void {
  returnGathered(w);
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st === BOLT || st === PROJECTILE || st === RETURNING) w.state[i] = FREE;
  }
}
