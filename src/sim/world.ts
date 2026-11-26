import type { SimConfig } from './config';
import { createRng } from './rng';

export const FREE = 0;
export const ORBITING = 1;
export const KIND_ASTEROID = 0;
export const KIND_ROCKY = 1;
export const KIND_ICE = 2;
export const KIND_GAS = 3;

export interface Star {
  x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number;
  mass: number; captureRadius: number;
}

export interface World {
  readonly config: SimConfig;
  readonly capacity: number;
  tick: number;
  count: number;
  readonly star: Star;
  readonly x: Float64Array; readonly y: Float64Array;
  readonly prevX: Float64Array; readonly prevY: Float64Array;
  readonly vx: Float64Array; readonly vy: Float64Array;
  readonly radius: Float64Array; readonly mass: Float64Array;
  readonly orbitR: Float64Array; readonly orbitTarget: Float64Array; readonly orbitAngle: Float64Array;
  readonly state: Uint8Array; readonly kind: Uint8Array;
  orbitingCount: number;
  readonly captured: Int32Array;   // índices capturados en el último paso
  capturedCount: number;
}

export interface BodySpec { x: number; y: number; vx: number; vy: number; radius: number; kind: number }

export function captureRadiusFor(config: SimConfig, mass: number): number {
  return config.starBaseCaptureRadius + config.captureRadiusPerSqrtMass * Math.sqrt(mass);
}

export function addBody(w: World, b: BodySpec): number {
  if (w.count >= w.capacity) return -1;
  const i = w.count++;
  w.x[i] = b.x; w.y[i] = b.y; w.prevX[i] = b.x; w.prevY[i] = b.y;
  w.vx[i] = b.vx; w.vy[i] = b.vy;
  w.radius[i] = b.radius; w.mass[i] = b.radius * b.radius * b.radius;
  w.orbitR[i] = 0; w.orbitTarget[i] = 0; w.orbitAngle[i] = 0;
  w.state[i] = FREE; w.kind[i] = b.kind;
  return i;
}

export function createWorld(config: SimConfig, seed: number, extraCapacity = 0): World {
  const capacity = config.asteroidCount + config.planetCount + extraCapacity;
  const f = (): Float64Array => new Float64Array(capacity);
  const w: World = {
    config, capacity, tick: 0, count: 0,
    star: {
      x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0,
      mass: config.starStartMass, captureRadius: captureRadiusFor(config, config.starStartMass),
    },
    x: f(), y: f(), prevX: f(), prevY: f(), vx: f(), vy: f(), radius: f(), mass: f(),
    orbitR: f(), orbitTarget: f(), orbitAngle: f(),
    state: new Uint8Array(capacity), kind: new Uint8Array(capacity),
    orbitingCount: 0, captured: new Int32Array(capacity), capturedCount: 0,
  };
  const rng = createRng(seed);
  const spawn = (kind: number, rMin: number, rMax: number, sMin: number, sMax: number): void => {
    let px = 0;
    let py = 0;
    do {
      px = rng.range(-config.arenaHalfWidth, config.arenaHalfWidth);
      py = rng.range(-config.arenaHalfHeight, config.arenaHalfHeight);
    } while (Math.hypot(px, py) < config.spawnClearRadius);
    const ang = rng.range(0, Math.PI * 2);
    const speed = rng.range(sMin, sMax);
    addBody(w, { x: px, y: py, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, radius: rng.range(rMin, rMax), kind });
  };
  for (let i = 0; i < config.asteroidCount; i++) spawn(KIND_ASTEROID, 0.35, 1.1, 1, 4);
  for (let i = 0; i < config.planetCount; i++) spawn(KIND_ROCKY + Math.floor(rng.next() * 3), 2.5, 7, 0.3, 1);
  return w;
}

// Huella FNV-1a del estado. Sirve sólo para pruebas y depuración (crea objetos).
export function hashWorld(w: World): number {
  let h = 0x811c9dc5;
  const buf = new Float64Array(1);
  const bytes = new Uint8Array(buf.buffer);
  const mix = (v: number): void => {
    buf[0] = v;
    for (let k = 0; k < 8; k++) { h ^= bytes[k]; h = Math.imul(h, 0x01000193) >>> 0; }
  };
  mix(w.star.x); mix(w.star.y); mix(w.star.mass);
  for (let i = 0; i < w.count; i++) { mix(w.x[i]); mix(w.y[i]); mix(w.state[i]); }
  return h >>> 0;
}
