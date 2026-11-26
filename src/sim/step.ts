import { DT } from './config';
import { stageFor } from './stages';
import { captureRadiusFor, DEAD, FREE, KIND_GAS, KIND_ROCKY, ORBIT_PLANET, ORBITING, OVER_DIMMED, OVER_NONE, OVER_SWALLOWED, starSize, type World } from './world';

export interface Intent { targetX: number; targetY: number; hasTarget: boolean }

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
  // Partida terminada: todo queda quieto (y sin interpolar) hasta que se reinicie.
  if (w.over !== OVER_NONE) return;
  if (w.invuln > 0) w.invuln = Math.max(0, w.invuln - DT);

  // El agujero negro persigue a la estrella, cada vez un poco más rápido.
  const range2 = c.bhRange * c.bhRange;
  const G = c.bhPull * bh.mass;
  if (bh.active) {
    bh.speed = Math.min(c.bhMaxSpeed, bh.speed + c.bhAccel * DT);
    const dx = s.x - bh.x, dy = s.y - bh.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-6) { bh.vx = (dx / d) * bh.speed; bh.vy = (dy / d) * bh.speed; }
    bh.x = clamp(bh.x + bh.vx * DT, -hw, hw);
    bh.y = clamp(bh.y + bh.vy * DT, -hh, hh);
    // Su gravedad también tira de la estrella.
    const gx = bh.x - s.x, gy = bh.y - s.y;
    const g2 = gx * gx + gy * gy;
    if (g2 < range2 && g2 > 1e-9) {
      const a = Math.min(c.bhMaxAccel, G / Math.max(g2, 1)) * DT / Math.sqrt(g2);
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
    const dx = clamp(intent.targetX, -hw, hw) - s.x;
    const dy = clamp(intent.targetY, -hh, hh) - s.y;
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
  if (s.x > hw) { s.x = hw; s.vx = 0; } else if (s.x < -hw) { s.x = -hw; s.vx = 0; }
  if (s.y > hh) { s.y = hh; s.vy = 0; } else if (s.y < -hh) { s.y = -hh; s.vy = 0; }
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
    if (st === DEAD) continue;
    if (st === FREE || st === ORBIT_PLANET) {
      let x: number;
      let y: number;
      if (st === FREE) {
        x = w.x[i] + w.vx[i] * DT;
        y = w.y[i] + w.vy[i] * DT;
        // Al reaparecer del otro lado se corre también la posición anterior, así el dibujo no interpola por el medio.
        if (x > hw) { x -= 2 * hw; w.prevX[i] -= 2 * hw; } else if (x < -hw) { x += 2 * hw; w.prevX[i] += 2 * hw; }
        if (y > hh) { y -= 2 * hh; w.prevY[i] -= 2 * hh; } else if (y < -hh) { y += 2 * hh; w.prevY[i] += 2 * hh; }
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
        x = w.x[i];
        y = w.y[i];
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
      if (canSteal && d < captureR && w.radius[i] <= c.maxCaptureSize && w.orbitingCount < c.orbitCapacity) {
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
  bh.radius = c.bhStartRadius * Math.cbrt(bh.mass);
  s.captureRadius = captureRadiusFor(c, s.mass);
  const st = stageFor(s.mass);
  if (st > w.stage) { w.stage = st; w.stageUps++; }
  w.tick++;
}
