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

  if (intent.hasTarget && Number.isFinite(intent.targetX) && Number.isFinite(intent.targetY)) {
    const tx = clamp(intent.targetX, -hw, hw);
    const ty = clamp(intent.targetY, -hh, hh);
    const dx = tx - s.x;
    const dy = ty - s.y;
    const dist = Math.hypot(dx, dy);
    const maxStep = c.starMaxSpeed * DT;
    if (dist <= maxStep) { s.x = tx; s.y = ty; }
    else { s.x += (dx / dist) * maxStep; s.y += (dy / dist) * maxStep; }
  }

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
