import type { SimConfig } from './config';
import { createRng, type Rng } from './rng';

export const FREE = 0;
export const ORBITING = 1;       // orbita la estrella del jugador
export const ORBIT_PLANET = 2;   // orbita un planeta (luna o escombro de su cinturón)
export const DEAD = 3;           // tragado o destruido: no se mueve ni se dibuja
export const PROJECTILE = 4;     // lanzado con la honda
export const RETURNING = 5;      // vuelve a la órbita después del lanzamiento
export const CARRIED = 6;        // robado por un cometa, va arrastrado detrás
export const MAX_COMETS = 6;
export const OVER_NONE = 0;
export const OVER_SWALLOWED = 1; // la tragó el agujero negro
export const OVER_DIMMED = 2;    // se apagó: chocó sin mundos que la protejan
export const KIND_ASTEROID = 0;
export const KIND_ROCKY = 1;
export const KIND_ICE = 2;
export const KIND_GAS = 3;
export const KIND_MOON = 4;

export interface Star {
  x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number;
  mass: number; captureRadius: number;
}

export interface BlackHole {
  x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number; speed: number;
  radius: number; mass: number; active: boolean;
}

export interface Comets {
  readonly x: Float64Array; readonly y: Float64Array;
  readonly prevX: Float64Array; readonly prevY: Float64Array;
  readonly vx: Float64Array; readonly vy: Float64Array;
  readonly hp: Float32Array;
  readonly mode: Uint8Array;     // 0 apagado, 1 caza, 2 huye
  readonly timer: Float32Array;  // segundos de huida que quedan
  readonly carry: Int32Array;    // mundo robado, o -1
  readonly beamId: Int32Array;   // último rayo que lo dañó
}

export interface World {
  readonly config: SimConfig;
  readonly capacity: number;
  tick: number;
  count: number;
  readonly star: Star;
  readonly bh: BlackHole;
  readonly comets: Comets;
  cometClock: number;  // segundos hasta el próximo cometa
  cometSteals: number; // mundos robados por cometas (evento)
  cometKills: number;  // cometas destruidos (evento)
  readonly rng: Rng;   // azar de la partida (cometas, escombros)
  over: number;        // OVER_NONE mientras se juega
  invuln: number;      // segundos de invulnerabilidad que quedan
  hits: number;        // choques con planetas (evento para el dibujo y la interfaz)
  slingCd: number;     // segundos hasta poder volver a disparar
  shots: number;       // disparos de honda (evento)
  eclipses: number;    // eclipses producidos (evento)
  eclipseAngle: number;     // dirección del último rayo
  eclipseStrength: number;  // cuántos mundos lo formaron
  eclipseCd: number;
  beamTime: number;    // segundos que le quedan al rayo
  readonly x: Float64Array; readonly y: Float64Array;
  readonly prevX: Float64Array; readonly prevY: Float64Array;
  readonly vx: Float64Array; readonly vy: Float64Array;
  readonly radius: Float64Array; readonly mass: Float64Array;
  readonly orbitR: Float64Array; readonly orbitTarget: Float64Array; readonly orbitAngle: Float64Array;
  readonly orbitW: Float64Array;   // velocidad angular (rad/s) al orbitar un planeta
  readonly parent: Int32Array;     // planeta que orbita, o -1
  readonly state: Uint8Array; readonly kind: Uint8Array;
  readonly noCatch: Float32Array;  // segundos en que no se puede capturar (mundos recién perdidos)
  readonly life: Float32Array;     // segundos de vuelo que le quedan a un proyectil
  orbitingCount: number;
  stage: number;       // etapa actual de la estrella (ver stages.ts)
  stageUps: number;    // cuántas veces subió de etapa (el dibujo y la interfaz lo usan como evento)
  maxMass: number;     // la mayor masa alcanzada en la partida
  readonly captured: Int32Array;   // índices capturados en el último paso
  capturedCount: number;
}

export interface BodySpec { x: number; y: number; vx: number; vy: number; radius: number; kind: number }

const MAX_MOONS = 4;
const MAX_DEBRIS = 60;

// Tamaño (radio) de la estrella según su masa. Lo usan la simulación y el dibujo.
export function starSize(mass: number): number {
  return 4 + 0.5 * Math.sqrt(mass);
}

export function captureRadiusFor(config: SimConfig, mass: number): number {
  return config.starBaseCaptureRadius + config.captureRadiusPerSqrtMass * Math.sqrt(mass);
}

export function addBody(w: World, b: BodySpec): number {
  if (w.count >= w.capacity) return -1;
  const i = w.count++;
  w.x[i] = b.x; w.y[i] = b.y; w.prevX[i] = b.x; w.prevY[i] = b.y;
  w.vx[i] = b.vx; w.vy[i] = b.vy;
  w.radius[i] = b.radius; w.mass[i] = b.radius * b.radius * b.radius;
  w.orbitR[i] = 0; w.orbitTarget[i] = 0; w.orbitAngle[i] = 0; w.orbitW[i] = 0;
  w.parent[i] = -1;
  w.state[i] = FREE; w.kind[i] = b.kind; w.noCatch[i] = 0;
  return i;
}

// Agrega un cuerpo que orbita al planeta `p` a distancia `r`, con ángulo inicial y velocidad angular dados.
export function addSatellite(w: World, p: number, r: number, angle: number, radius: number, kind: number, angularSpeed: number): number {
  const x = w.x[p] + Math.cos(angle) * r;
  const y = w.y[p] + Math.sin(angle) * r;
  const i = addBody(w, { x, y, vx: 0, vy: 0, radius, kind });
  if (i < 0) return -1;
  w.parent[i] = p;
  w.state[i] = ORBIT_PLANET;
  w.orbitR[i] = r;
  w.orbitAngle[i] = angle;
  w.orbitW[i] = angularSpeed;
  return i;
}

// Campo de densidad suave (ruido de valor en grilla) más cúmulos: define dónde hay más asteroides.
function makeDensity(rng: Rng, hw: number, hh: number): (x: number, y: number) => number {
  const G = 14;
  const grid = new Float64Array((G + 1) * (G + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
  const fine = new Float64Array((G * 2 + 1) * (G * 2 + 1));
  for (let i = 0; i < fine.length; i++) fine[i] = rng.next();
  const sample = (g: Float64Array, n: number, u: number, v: number): number => {
    const fx = u * n, fy = v * n;
    const ix = Math.min(n - 1, Math.floor(fx)), iy = Math.min(n - 1, Math.floor(fy));
    const tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[iy * (n + 1) + ix]!, b = g[iy * (n + 1) + ix + 1]!;
    const c = g[(iy + 1) * (n + 1) + ix]!, d = g[(iy + 1) * (n + 1) + ix + 1]!;
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  const clusters: { x: number; y: number; r: number }[] = [];
  const nc = 6 + Math.floor(rng.next() * 6);
  for (let k = 0; k < nc; k++) clusters.push({ x: rng.range(-hw, hw), y: rng.range(-hh, hh), r: rng.range(18, 45) });
  return (x, y) => {
    const u = (x + hw) / (2 * hw), v = (y + hh) / (2 * hh);
    const n = sample(grid, G, u, v) * 0.7 + sample(fine, G * 2, u, v) * 0.3;
    let d = Math.max(0, (n - 0.42) / 0.58);
    d = d * d * 1.6;                                  // zonas vacías y campos densos
    for (const c of clusters) d += 2.2 * Math.exp(-((x - c.x) ** 2 + (y - c.y) ** 2) / (c.r * c.r));
    const fromStart = Math.hypot(x, y);
    if (fromStart < 70) d = Math.max(d, 0.55);        // siempre hay con qué empezar cerca del inicio
    return Math.min(d, 3);
  };
}

export function createWorld(config: SimConfig, seed: number, extraCapacity = 0): World {
  const capacity = config.asteroidCount + config.planetCount * (1 + MAX_MOONS + MAX_DEBRIS) + config.debrisReserve + extraCapacity;
  const f = (): Float64Array => new Float64Array(capacity);
  const w: World = {
    config, capacity, tick: 0, count: 0,
    star: {
      x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0,
      mass: config.starStartMass, captureRadius: captureRadiusFor(config, config.starStartMass),
    },
    bh: { x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, speed: config.bhStartSpeed, radius: config.bhStartRadius, mass: 1, active: config.blackHole },
    comets: {
      x: new Float64Array(MAX_COMETS), y: new Float64Array(MAX_COMETS), prevX: new Float64Array(MAX_COMETS), prevY: new Float64Array(MAX_COMETS),
      vx: new Float64Array(MAX_COMETS), vy: new Float64Array(MAX_COMETS), hp: new Float32Array(MAX_COMETS), mode: new Uint8Array(MAX_COMETS),
      timer: new Float32Array(MAX_COMETS), carry: new Int32Array(MAX_COMETS).fill(-1), beamId: new Int32Array(MAX_COMETS),
    },
    cometClock: config.cometFirst, cometSteals: 0, cometKills: 0, rng: createRng(seed ^ 0x9e3779b9),
    over: OVER_NONE, invuln: 0, hits: 0, slingCd: 0, shots: 0,
    eclipses: 0, eclipseAngle: 0, eclipseStrength: 0, eclipseCd: 0, beamTime: 0,
    x: f(), y: f(), prevX: f(), prevY: f(), vx: f(), vy: f(), radius: f(), mass: f(),
    orbitR: f(), orbitTarget: f(), orbitAngle: f(), orbitW: f(),
    parent: new Int32Array(capacity).fill(-1),
    state: new Uint8Array(capacity), kind: new Uint8Array(capacity), noCatch: new Float32Array(capacity), life: new Float32Array(capacity),
    orbitingCount: 0, stage: 0, stageUps: 0, maxMass: config.starStartMass, captured: new Int32Array(capacity), capturedCount: 0,
  };
  const rng = createRng(seed);
  const hw = config.arenaHalfWidth, hh = config.arenaHalfHeight;
  const density = makeDensity(rng, hw, hh);

  // Asteroides sueltos: se aceptan según el campo de densidad.
  let placed = 0;
  for (let tries = 0; placed < config.asteroidCount && tries < config.asteroidCount * 60; tries++) {
    const px = rng.range(-hw, hw), py = rng.range(-hh, hh);
    if (Math.hypot(px, py) < config.spawnClearRadius) continue;
    if (rng.next() * 3 > density(px, py)) continue;
    const ang = rng.range(0, Math.PI * 2), speed = rng.range(1, 4);
    addBody(w, { x: px, y: py, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, radius: rng.range(0.35, 1.1), kind: KIND_ASTEROID });
    placed++;
  }

  // Planetas, algunos con lunas y otros con su propio cinturón de escombros.
  for (let k = 0; k < config.planetCount; k++) {
    let px = 0, py = 0;
    do { px = rng.range(-hw, hw); py = rng.range(-hh, hh); } while (Math.hypot(px, py) < config.spawnClearRadius * 3);
    const ang = rng.range(0, Math.PI * 2), speed = rng.range(0.3, 1);
    const r = rng.range(2.5, 7);
    const p = addBody(w, { x: px, y: py, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, radius: r, kind: KIND_ROCKY + Math.floor(rng.next() * 3) });
    if (p < 0) break;
    if (rng.next() < 0.45) {
      const moons = 1 + Math.floor(rng.next() * MAX_MOONS);
      let orbit = r * 1.9;
      for (let m = 0; m < moons; m++) {
        orbit += rng.range(1.6, 3.2);
        addSatellite(w, p, orbit, rng.range(0, Math.PI * 2), rng.range(0.5, 1.3), KIND_MOON, (rng.next() < 0.5 ? 1 : -1) * 2.2 / Math.pow(orbit / r, 1.5));
      }
    } else if (rng.next() < 0.45) {
      const n = 25 + Math.floor(rng.next() * (MAX_DEBRIS - 25));
      const inner = r * 2.1, outer = r * 3.4;
      for (let d = 0; d < n; d++) {
        const orbit = rng.range(inner, outer);
        addSatellite(w, p, orbit, rng.range(0, Math.PI * 2), rng.range(0.25, 0.7), KIND_ASTEROID, 1.6 / Math.pow(orbit / r, 1.5));
      }
    }
  }
  // Reserva de asteroides muertos: los cometas los reviven como escombros al morir.
  for (let k = 0; k < config.debrisReserve; k++) {
    const i = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    if (i < 0) break;
    w.state[i] = DEAD;
  }
  // El agujero negro aparece en un borde, del lado izquierdo o derecho (se sortea al final para no alterar el mapa).
  const side = rng.next() < 0.5 ? -1 : 1;
  w.bh.x = w.bh.prevX = side * hw * 0.95;
  w.bh.y = w.bh.prevY = rng.range(-hh * 0.5, hh * 0.5);
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
  mix(w.star.x); mix(w.star.y); mix(w.star.mass); mix(w.bh.x); mix(w.bh.y); mix(w.bh.mass);
  for (let i = 0; i < w.count; i++) { mix(w.x[i]); mix(w.y[i]); mix(w.state[i]); }
  return h >>> 0;
}
