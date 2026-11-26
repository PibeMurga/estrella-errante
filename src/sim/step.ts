import { DT } from './config';
import { captureRadiusFor, FREE, ORBITING, type World } from './world';

export interface Intent { targetX: number; targetY: number; hasTarget: boolean }

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function step(w: World, intent: Intent): void {
  const c = w.config;
  const s = w.star;
  const hw = c.arenaHalfWidth;
  const hh = c.arenaHalfHeight;
  w.capturedCount = 0;

  s.prevX = s.x;
  s.prevY = s.y;
  w.prevX.set(w.x);
  w.prevY.set(w.y);

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

  const captureR = s.captureRadius;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] === FREE) {
      let x = w.x[i] + w.vx[i] * DT;
      let y = w.y[i] + w.vy[i] * DT;
      if (x > hw) x -= 2 * hw; else if (x < -hw) x += 2 * hw;
      if (y > hh) y -= 2 * hh; else if (y < -hh) y += 2 * hh;
      w.x[i] = x;
      w.y[i] = y;
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < captureR && w.radius[i] <= c.maxCaptureSize && w.orbitingCount < c.orbitCapacity) {
        w.state[i] = ORBITING;
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

  s.captureRadius = captureRadiusFor(c, s.mass);
  w.tick++;
}
