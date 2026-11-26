import { stepComets } from './comets';
import { breakPlanet } from './tidal';
import { DT } from './config';
import { stageFor } from './stages';
import { CARRIED, captureRadiusFor, DEAD, FREE, KIND_GAS, KIND_ICE, KIND_ROCKY, ORBIT_PLANET, ORBITING, OVER_DIMMED, PROJECTILE, RETURNING, OVER_NONE, OVER_SWALLOWED, starSize, type World } from './world';

// target: hacia dónde ir. aim: hacia dónde apuntar la honda (stick derecho); sin aim se apunta al objetivo.
export interface Intent {
  targetX: number; targetY: number; hasTarget: boolean;
  fire?: boolean;
  aimX?: number; aimY?: number; hasAim?: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

// Choque con un planeta grande: sin mundos en órbita la estrella se apaga; si no, pierde algunos y rebota.
function hurt(w: World, p: number): void {
  const c = w.config, s = w.star;
  if (w.orbitingCount === 0) { w.over = OVER_DIMMED; return; }
  w.hits++;
  w.invuln = c.hurtInvuln;
  let nx = s.x - w.x[p], ny = s.y - w.y[p];
  const nd = Math.hypot(nx, ny) || 1;
  nx /= nd; ny /= nd;
  s.vx = nx * c.hurtBounce;
  s.vy = ny * c.hurtBounce;
  let lost = 0;
  for (let i = 0; i < w.count && lost < c.hurtWorldsLost; i++) {
    if (w.state[i] !== ORBITING) continue;
    const a = w.orbitAngle[i];
    w.state[i] = FREE;
    w.vx[i] = Math.cos(a) * c.lostSpeed + s.vx * 0.3;
    w.vy[i] = Math.sin(a) * c.lostSpeed + s.vy * 0.3;
    w.noCatch[i] = c.noCatchTime;
    w.orbitingCount--;
    s.mass = Math.max(c.starStartMass, s.mass - w.mass[i]);
    lost++;
  }
}

// Honda: lanza el mundo en órbita cuyo ángulo está más cerca de la dirección de la mira.
// Dirección de la honda: la mira propia; si no, el objetivo; si está encima de la estrella, el cometa más cercano;
// si no hay cometas, hacia donde se mueve. Devuelve NaN si no hay ninguna dirección razonable.
function slingAngle(w: World, it: Intent): number {
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

function sling(w: World, aim: number): void {
  const c = w.config, s = w.star;
  let best = -1, bestDiff = Infinity;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== ORBITING) continue;
    let d = Math.abs(w.orbitAngle[i] - aim) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  if (best < 0) return;
  w.state[best] = PROJECTILE;
  w.vx[best] = Math.cos(aim) * c.slingSpeed + s.vx;
  w.vy[best] = Math.sin(aim) * c.slingSpeed + s.vy;
  w.life[best] = c.slingLife;
  w.orbitingCount--;
  w.slingCd = c.slingCooldown;
  w.shots++;
}

// Vuelo de un mundo lanzado: avanza en línea recta y después vuelve a la estrella.
function flight(w: World, i: number, st: number): void {
  const c = w.config, s = w.star;
  const dx = s.x - w.x[i], dy = s.y - w.y[i];
  const d = Math.hypot(dx, dy);
  if (st === PROJECTILE) {
    w.life[i] = w.life[i]! - DT;
    if (w.life[i]! <= 0) {
      if (d > c.slingLoseDist) {
        // Quedó demasiado lejos: se pierde y la estrella pierde su masa.
        w.state[i] = FREE;
        w.noCatch[i] = c.noCatchTime;
        s.mass = Math.max(c.starStartMass, s.mass - w.mass[i]);
        return;
      }
      w.state[i] = RETURNING;
    }
  } else {
    if (d < c.orbitMax && w.orbitingCount >= c.orbitCapacity) {
      // Volvió con la órbita llena: la estrella lo absorbe (su masa ya estaba contada).
      w.state[i] = DEAD;
      w.absorbed++;
      return;
    }
    if (d < c.orbitMax) {
      w.state[i] = ORBITING;
      w.orbitR[i] = d;
      w.orbitTarget[i] = clamp(d * 0.9, c.orbitMin, c.orbitMax);
      w.orbitAngle[i] = Math.atan2(-dy, -dx);
      w.orbitingCount++;
      return;
    }
    const v = c.slingReturnSpeed + Math.hypot(s.vx, s.vy);
    if (d > 1e-6) { w.vx[i] = (dx / d) * v; w.vy[i] = (dy / d) * v; }
  }
  w.x[i] += w.vx[i] * DT;
  w.y[i] += w.vy[i] * DT;
}

// Eclipse: varios mundos en órbita alineados con la estrella disparan un rayo en esa dirección.
// Se reparten los ángulos en casillas de medio ancho de ventana y se busca el par de casillas vecinas con más mundos.
const ECL_BINS_MAX = 720;
const eclCount = new Uint16Array(ECL_BINS_MAX);
const eclCos = new Float64Array(ECL_BINS_MAX);
const eclSin = new Float64Array(ECL_BINS_MAX);
function eclipse(w: World): void {
  const c = w.config;
  const TAU = Math.PI * 2;
  const binW = (c.eclipseWindowDeg * Math.PI) / 360;
  const bins = Math.min(ECL_BINS_MAX, Math.max(2, Math.floor(TAU / binW)));
  eclCount.fill(0, 0, bins); eclCos.fill(0, 0, bins); eclSin.fill(0, 0, bins);
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== ORBITING) continue;
    const a = w.orbitAngle[i];
    let n = a % TAU; if (n < 0) n += TAU;
    const b = Math.min(bins - 1, Math.floor((n / TAU) * bins));
    eclCount[b]++; eclCos[b] += Math.cos(a); eclSin[b] += Math.sin(a);
  }
  let best = -1, bestN = 0;
  for (let b = 0; b < bins; b++) {
    const n = eclCount[b]! + eclCount[(b + 1) % bins]!;
    if (n > bestN) { bestN = n; best = b; }
  }
  const need = Math.max(c.eclipseMin, Math.ceil(((w.orbitingCount * c.eclipseWindowDeg) / 360) * c.eclipseDensity));
  if (bestN < need) return;
  const b2 = (best + 1) % bins;
  w.eclipseAngle = Math.atan2(eclSin[best]! + eclSin[b2]!, eclCos[best]! + eclCos[b2]!);
  w.eclipseStrength = bestN;
  w.eclipses++;
  w.eclipseCd = c.eclipseCooldown;
  w.beamTime = c.beamDuration;
}

export function step(w: World, intent: Intent): void {
  const c = w.config;
  const s = w.star;
  const hw = c.arenaHalfWidth;
  const hh = c.arenaHalfHeight;
  const bh = w.bh;
  w.capturedCount = 0;

  s.prevX = s.x;
  s.prevY = s.y;
  bh.prevX = bh.x;
  bh.prevY = bh.y;
  w.prevX.set(w.x);
  w.prevY.set(w.y);
  w.comets.prevX.set(w.comets.x);
  w.comets.prevY.set(w.comets.y);
  // Partida terminada: todo queda quieto (y sin interpolar) hasta que se reinicie.
  if (w.over !== OVER_NONE) return;
  if (w.invuln > 0) w.invuln = Math.max(0, w.invuln - DT);
  if (w.slingCd > 0) w.slingCd = Math.max(0, w.slingCd - DT);
  if (w.eclipseCd > 0) w.eclipseCd = Math.max(0, w.eclipseCd - DT);
  if (w.beamTime > 0) w.beamTime = Math.max(0, w.beamTime - DT);

  // El agujero negro persigue a la estrella, cada vez un poco más rápido.
  const range2 = c.bhRange * c.bhRange;
  // Crece con la raíz de su masa: comer lo hace más peligroso, pero no imposible de esquivar.
  const G = c.bhPull * Math.sqrt(bh.mass);
  if (bh.active) {
    bh.speed = Math.min(c.bhMaxSpeed, bh.speed + c.bhAccel * DT);
    const dx = s.x - bh.x, dy = s.y - bh.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-6) { bh.vx = (dx / d) * bh.speed; bh.vy = (dy / d) * bh.speed; }
    bh.x += bh.vx * DT;
    bh.y += bh.vy * DT;
    // Sin bordes: la vuelta del mapa se calcula alrededor de la estrella.
    if (bh.x - s.x > hw) { bh.x -= 2 * hw; bh.prevX -= 2 * hw; } else if (bh.x - s.x < -hw) { bh.x += 2 * hw; bh.prevX += 2 * hw; }
    if (bh.y - s.y > hh) { bh.y -= 2 * hh; bh.prevY -= 2 * hh; } else if (bh.y - s.y < -hh) { bh.y += 2 * hh; bh.prevY += 2 * hh; }
    // Su gravedad también tira de la estrella.
    const gx = bh.x - s.x, gy = bh.y - s.y;
    const g2 = gx * gx + gy * gy;
    if (g2 < range2 && g2 > 1e-9) {
      const a = c.bhStarPull * Math.min(c.bhMaxAccel, G / Math.max(g2, 1)) * DT / Math.sqrt(g2);
      s.vx += gx * a;
      s.vy += gy * a;
    }
  }

  // Movimiento con inercia: acelera hacia una velocidad deseada y frena para llegar sin pasarse.
  const acc = c.starAccel / (1 + c.starMassInertia * s.mass);
  let desX = 0;
  let desY = 0;
  let maxDv = acc * c.starBrake * DT;
  if (intent.hasTarget && Number.isFinite(intent.targetX) && Number.isFinite(intent.targetY)) {
    const dx = intent.targetX - s.x;
    const dy = intent.targetY - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1e-6) {
      const speed = Math.min(c.starMaxSpeed, Math.sqrt(2 * acc * 0.8 * dist), (c.starMaxSpeed * dist) / c.starSlowRadius);
      desX = (dx / dist) * speed;
      desY = (dy / dist) * speed;
    }
    maxDv = acc * DT;
  }
  let dvx = desX - s.vx;
  let dvy = desY - s.vy;
  const dv = Math.hypot(dvx, dvy);
  if (dv > maxDv) { dvx *= maxDv / dv; dvy *= maxDv / dv; }
  s.vx += dvx;
  s.vy += dvy;
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > c.starMaxSpeed) { s.vx *= c.starMaxSpeed / sp; s.vy *= c.starMaxSpeed / sp; }
  s.x += s.vx * DT;
  s.y += s.vy * DT;
  if (bh.active && Math.hypot(s.x - bh.x, s.y - bh.y) < bh.radius + starSize(s.mass) * 0.5) {
    w.over = OVER_SWALLOWED;
    w.tick++;
    return;
  }

  const captureR = s.captureRadius;
  const size = starSize(s.mass);
  let hit = -1;
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st === DEAD || st === CARRIED) continue;
    if (st === PROJECTILE || st === RETURNING) { flight(w, i, st); continue; }
    if (st === FREE || st === ORBIT_PLANET) {
      let x: number;
      let y: number;
      if (st === FREE) {
        x = w.x[i] + w.vx[i] * DT;
        y = w.y[i] + w.vy[i] * DT;
        // Sin bordes: lo que se aleja más de media arena de la estrella reaparece del lado opuesto de la estrella,
        // siempre fuera de cámara. La posición anterior se corre igual, así el dibujo no interpola por el medio.
        if (x - s.x > hw) { x -= 2 * hw; w.prevX[i] -= 2 * hw; } else if (x - s.x < -hw) { x += 2 * hw; w.prevX[i] += 2 * hw; }
        if (y - s.y > hh) { y -= 2 * hh; w.prevY[i] -= 2 * hh; } else if (y - s.y < -hh) { y += 2 * hh; w.prevY[i] += 2 * hh; }
        if (w.broken[i] > 0) w.broken[i] += DT;
        if (bh.active) {
          const gx = bh.x - x, gy = bh.y - y;
          const g2 = gx * gx + gy * gy;
          if (g2 < range2) {
            if (g2 < bh.radius * bh.radius * 1.44) {
              // Tragado: suma masa al agujero negro y deja de existir.
              w.state[i] = DEAD;
              bh.mass += w.mass[i] * c.bhMassGain;
              w.x[i] = x; w.y[i] = y;
              continue;
            }
            // Marea: un planeta rocoso o helado que se acerca demasiado se parte.
            if (w.broken[i] === 0 && (w.kind[i] === KIND_ROCKY || w.kind[i] === KIND_ICE)) {
              const roche = bh.radius * c.rocheFactor + w.radius[i];
              if (g2 < roche * roche) {
                const gd = Math.sqrt(g2) || 1;
                w.x[i] = x; w.y[i] = y;
                breakPlanet(w, i, gx / gd, gy / gd);
              }
            }
            const a = Math.min(c.bhMaxAccel, G / Math.max(g2, 1)) * DT / Math.sqrt(g2);
            w.vx[i] += gx * a;
            w.vy[i] += gy * a;
          }
        }
      } else if (w.state[w.parent[i]!] === DEAD) {
        // Su planeta fue tragado: la luna sigue suelta con la velocidad que tenía al girar.
        const p = w.parent[i]!;
        const ang = w.orbitAngle[i];
        const v = w.orbitW[i] * w.orbitR[i];
        w.vx[i] = w.vx[p] - Math.sin(ang) * v;
        w.vy[i] = w.vy[p] + Math.cos(ang) * v;
        w.state[i] = FREE;
        w.parent[i] = -1;
        continue;   // recién soltada: en este paso no se mueve ni se captura
      } else {
        // Luna o escombro: gira alrededor de su planeta (que ya se movió en este paso, porque se creó antes).
        const p = w.parent[i]!;
        const ang = w.orbitAngle[i] + w.orbitW[i] * DT;
        w.orbitAngle[i] = ang;
        x = w.x[p] + Math.cos(ang) * w.orbitR[i];
        y = w.y[p] + Math.sin(ang) * w.orbitR[i];
        // Si el planeta reapareció del otro lado, el satélite acompaña el salto también en su posición anterior.
        if (x - w.prevX[i] > hw) w.prevX[i] += 2 * hw; else if (w.prevX[i] - x > hw) w.prevX[i] -= 2 * hw;
        if (y - w.prevY[i] > hh) w.prevY[i] += 2 * hh; else if (w.prevY[i] - y > hh) w.prevY[i] -= 2 * hh;
      }
      w.x[i] = x;
      w.y[i] = y;
      const d = Math.hypot(x - s.x, y - s.y);
      // Un planeta más grande que la estrella la daña al tocarla.
      const k = w.kind[i]!;
      if (st === FREE && k >= KIND_ROCKY && k <= KIND_GAS && w.radius[i] > size && d < size + w.radius[i] && hit < 0 && w.invuln <= 0) hit = i;
      if (w.noCatch[i]! > 0) { w.noCatch[i] = w.noCatch[i]! - DT; continue; }
      // Para robarle algo a un planeta, la estrella tiene que ser claramente más grande que él.
      const canSteal = st === FREE || starSize(s.mass) >= w.radius[w.parent[i]!] * c.stealSizeRatio;
      if (canSteal && d < captureR && w.radius[i] <= c.maxCaptureSize && w.orbitingCount >= c.orbitCapacity) {
        // Órbita llena: la estrella lo absorbe (suma su masa y el cuerpo queda libre para la reserva de escombros).
        w.state[i] = DEAD;
        w.parent[i] = -1;
        s.mass += w.mass[i];
        w.absorbed++;
        continue;
      }
      if (canSteal && d < captureR && w.radius[i] <= c.maxCaptureSize) {
        w.state[i] = ORBITING;
        w.parent[i] = -1;
        w.orbitR[i] = d;
        w.orbitTarget[i] = clamp(d * 0.9, c.orbitMin, c.orbitMax);
        w.orbitAngle[i] = Math.atan2(y - s.y, x - s.x);
        w.orbitingCount++;
        s.mass += w.mass[i];
        w.captured[w.capturedCount++] = i;
      }
    } else {
      const r = w.orbitR[i] + (w.orbitTarget[i] - w.orbitR[i]) * c.orbitEase;
      w.orbitR[i] = r;
      const a = w.orbitAngle[i] + c.orbitSpeedK * Math.pow(c.orbitMin / Math.max(r, 1e-6), 1.5) * DT;
      w.orbitAngle[i] = a;
      w.x[i] = s.x + Math.cos(a) * r;
      w.y[i] = s.y + Math.sin(a) * r;
    }
  }

  if (hit >= 0) hurt(w, hit);
  if (w.over !== OVER_NONE) { w.tick++; return; }   // se apagó en este paso: no pasa nada más
  if (w.eclipseCd <= 0 && w.orbitingCount >= c.eclipseMin) eclipse(w);
  stepComets(w);
  if (intent.fire && w.slingCd <= 0 && w.orbitingCount > 0) {
    const a = slingAngle(w, intent);
    if (Number.isFinite(a)) sling(w, a);
  }
  bh.radius = c.bhStartRadius * Math.cbrt(bh.mass);
  s.captureRadius = captureRadiusFor(c, s.mass);
  if (s.mass > w.maxMass) w.maxMass = s.mass;
  const st = stageFor(s.mass);
  if (st > w.stage) { w.stage = st; w.stageUps++; }
  w.tick++;
}
