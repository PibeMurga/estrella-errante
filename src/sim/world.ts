import type { SimConfig } from './config';
import { capCentroid, capVolume, cutOffset, halfSeed } from './halves';
import { createRng, type Rng } from './rng';

export const FREE = 0;
export const ORBITING = 1;       // orbita la estrella del jugador
export const ORBIT_PLANET = 2;   // orbita un planeta (luna o escombro de su cinturón)
export const DEAD = 3;           // tragado o destruido: no se mueve ni se dibuja
export const PROJECTILE = 4;     // lanzado con la honda
export const RETURNING = 5;      // vuelve a la órbita después del lanzamiento
export const CARRIED = 6;        // robado por un cometa, va arrastrado detrás
export const ABSORBING = 7;      // la estrella lo absorbe: cae en espiral hasta su superficie y después desaparece
export const GATHERING = 8;      // se está juntando en el bólido mientras se mantiene el botón
export const BOLT = 9;           // parte de un bólido lanzado: dejó la órbita y se pierde
export const MAX_COMETS = 6;
export const OVER_NONE = 0;
export const OVER_SWALLOWED = 1; // la tragó el agujero negro
export const OVER_DIMMED = 2;    // se apagó: chocó sin mundos que la protejan
export const OVER_ESCAPED = 3;   // en la caza, el rival se escapó (se acabó el tiempo)
export const OVER_WON = 4;       // te fusionaste con el rival: ganaste la pantalla
export const PHASE_PLAY = 0;     // crecer
export const PHASE_COLLAPSE = 1; // cinemática: supernova y nacimiento de tu agujero negro
export const PHASE_HUNT = 2;     // sos el agujero negro y cazás al rival
export const PHASE_MERGE = 3;
export const PHASE_IGNITION = 4; // cinemática: se enciende la fusión y nace tu estrella    // cinemática: la fusión
export const KIND_ASTEROID = 0;
export const KIND_ROCKY = 1;
export const KIND_ICE = 2;
export const KIND_GAS = 3;
export const KIND_MOON = 4;
export const MAX_IMPACTS = 16;

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
  readonly carry: Int32Array;    // cuántos cuerpos lleva robados (cada uno tiene parent = índice del cometa)
  // Cada cometa es distinto: tamaño, velocidad, manera de girar, color y brillo, y el vaivén de su rumbo.
  readonly size: Float32Array; readonly speedMul: Float32Array; readonly turnMul: Float32Array;
  readonly tint: Float32Array; readonly bright: Float32Array; readonly wander: Float32Array;
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
  phase: number;       // PHASE_*: en qué parte de la pantalla estás
  phaseTime: number;   // segundos desde que empezó la fase
  mergeR: number; mergeA: number;   // espiral de la fusión: distancia y ángulo del rival
  invuln: number;      // segundos de invulnerabilidad que quedan
  hits: number;        // choques con planetas (evento para el dibujo y la interfaz)
  slingCd: number;     // segundos hasta poder volver a disparar
  breakFxCount: number; breakFxX: number; breakFxY: number; breakFxR: number; breakFxKind: number; breakFxAx: number; breakFxAy: number;   // última ruptura de un planeta (para la explosión)
  ignited: boolean;    // ya se encendió tu estrella (o la partida arrancó como estrella)
  ignitions: number;   // igniciones (evento)
  rockHits: number;
  contactHits: number;
  disintegrated: number;   // planetas o pedazos que se desintegraron contra la estrella (evento)  // choques pesados entre planetas (evento)    // asteroides veloces o grandes que golpearon la estrella (evento)
  diskGrazes: number;  // veces que la estrella entró al disco del agujero negro (evento)
  inDisk: number;
  tide: number;        // 0..1: qué tan hondo está la estrella en la zona de marea del agujero negro      // 0 = fuera; 0..1 = qué tan hondo está la estrella en el disco ahora
  diskStripAcc: number;   // acumulador de cuerpos que el disco te arranca
  fireSlow: number;    // segundos que le quedan a la estrella para recuperar la marcha después de disparar
  fireSlowK: number;
  fireSlowT: number;   // duración total de esa marcha reducida   // cuánto la frenó ese disparo (fracción de la velocidad)
  shots: number;       // disparos de honda (evento)
  charge: number;        // segundos que se viene manteniendo el botón de lanzar (0 = suelto)
  gathered: number;      // cuerpos juntados en el bólido que se está cargando
  boltAngle: number;     // hacia dónde sale el bólido
  bolts: number;         // bólidos lanzados (evento)
  lastBoltSize: number;  // cuántos cuerpos tenía el último
  boltHitsBh: number;    // bólidos que le pegaron al agujero negro (evento)
  bhSlow: number;        // segundos que el agujero negro sigue frenado por un bólido
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
  readonly broken: Float32Array;   // segundos desde que el planeta se partió por marea (0 = entero)
  readonly breakAx: Float32Array; readonly breakAy: Float32Array;   // eje de la ruptura (hacia el agujero negro)
  readonly twin: Int32Array;       // el otro pedazo de un planeta rocoso o helado (se reserva muerto al crearlo); -1 = no tiene
  readonly halfSide: Int8Array;    // 0 = entero (o partido sin reserva); 1 = pedazo de arriba del corte; -1 = pedazo de abajo
  readonly impacts: Float32Array;  // últimos golpes contra planetas: [planeta, ángulo, tamaño, 0] por golpe (anillo de MAX_IMPACTS)
  impactCount: number;             // golpes contra planetas desde el inicio (el render dibuja los nuevos)
  tidalBreaks: number;             // planetas partidos por marea (evento)
  planetCrashes: number;           // choques entre planetas (evento)
  crashX: number; crashY: number; crashR: number;   // dónde fue el último choque y de qué tamaño (para la explosión)
  orbitingCount: number;
  stage: number;       // etapa actual de la estrella (ver stages.ts)
  stageUps: number;    // cuántas veces subió de etapa (el dibujo y la interfaz lo usan como evento)
  maxMass: number;     // la mayor masa alcanzada en la partida
  absorbed: number;    // cuerpos absorbidos con la órbita llena
  planets: Int32Array;             // índices de los planetas de la pantalla (fijo desde que se arma el mapa)
  readonly joinT: Float32Array;       // segundos desde que entró a tu órbita (para acoplarse de a poco); muy grande = ya acoplado
  readonly planetDmg: Float32Array;   // daño acumulado de cada planeta (para partirlo a golpes)
  planetCaptures: number;          // planetas que entraron a tu órbita (evento)
  graveHits: number;               // golpes graves (evento)
  planetBreaks: number;            // planetas partidos a golpes (evento)
  lastStealCount: number;          // cuántos cuerpos se llevó el último cometa
  ability: number;                 // habilidad activa (0 a 3), según los planetas en órbita
  planetsHeld: number;             // planetas en tu órbita
  abilityUps: number; abilityDowns: number;   // habilidades ganadas y perdidas (eventos)
  readonly captured: Int32Array;   // índices capturados en el último paso
  capturedCount: number;
}

export interface BodySpec { x: number; y: number; vx: number; vy: number; radius: number; kind: number }

const MAX_MOONS = 4;
const MAX_DEBRIS = 60;

// Masa que aporta a tu estrella el cuerpo i al entrar a tu sistema (y la que se lleva al irse).
// Suma sólo una parte (un planeta, una décima; un asteroide, tres cuartos): el enjambre se ve grande pero la masa crece despacio.
export function massGain(w: World, i: number): number {
  const k = w.kind[i]!;
  // Siendo planeta crece más despacio: la etapa de planeta dura lo suyo (uno a dos minutos).
  return w.mass[i] * (k >= KIND_ROCKY && k <= KIND_GAS ? w.config.planetMassGain : w.config.bodyMassGain) * (w.ignited ? 1 : w.config.planetPhaseGain);
}

// Tamaño (radio) de la estrella según su masa. Lo usan la simulación y el dibujo.
// Tamaño del cuerpo del jugador. Antes de la ignición (masa 30) es un planeta gaseoso: arranca más chico que los planetas
// comunes y crece hasta ser como los grandes; desde la ignición, el tamaño de una estrella (que sigue creciendo).
export function starSize(mass: number): number {
  const m = Math.max(0, mass);
  return m < 30 ? 1.6 + 0.8 * Math.sqrt(m) : 4 + 0.55 * Math.sqrt(m);
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
  // Cada planeta entra en la lista de planetas de la pantalla (crea un arreglo: sólo al armar el mapa o en pruebas).
  if (b.kind >= KIND_ROCKY && b.kind <= KIND_GAS) {
    const pl = new Int32Array(w.planets.length + 1); pl.set(w.planets); pl[w.planets.length] = i; w.planets = pl;
  }
  // Un rocoso o helado se puede partir en dos pedazos que se mueven cada uno por su cuenta: el segundo pedazo
  // se reserva ya, muerto, al lado (no entra en la lista de planetas: el planeta sigue siendo uno).
  if ((b.kind === KIND_ROCKY || b.kind === KIND_ICE) && w.count < w.capacity) {
    const j = w.count++;
    w.x[j] = w.prevX[j] = b.x; w.y[j] = w.prevY[j] = b.y; w.vx[j] = w.vy[j] = 0;
    w.radius[j] = b.radius; w.mass[j] = 0; w.parent[j] = -1; w.kind[j] = b.kind; w.state[j] = DEAD; w.noCatch[j] = 0;
    w.twin[i] = j; w.twin[j] = i;
  }
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
  const capacity = config.asteroidCount + config.planetCount * (1 + MAX_MOONS + MAX_DEBRIS) + config.debrisReserve + config.planetCount + extraCapacity;   // + un pedazo de reserva por planeta
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
      timer: new Float32Array(MAX_COMETS), carry: new Int32Array(MAX_COMETS),
      size: new Float32Array(MAX_COMETS).fill(1), speedMul: new Float32Array(MAX_COMETS).fill(1), turnMul: new Float32Array(MAX_COMETS).fill(1),
      tint: new Float32Array(MAX_COMETS), bright: new Float32Array(MAX_COMETS).fill(1), wander: new Float32Array(MAX_COMETS),
    },
    cometClock: config.cometFirst, cometSteals: 0, cometKills: 0, rng: createRng(seed ^ 0x9e3779b9),
    over: OVER_NONE, phase: PHASE_PLAY, phaseTime: 0, mergeR: 0, mergeA: 0, invuln: 0, hits: 0, slingCd: 0, fireSlow: 0, fireSlowK: 0, fireSlowT: 1, breakFxCount: 0, breakFxX: 0, breakFxY: 0, breakFxR: 0, breakFxKind: 0, breakFxAx: 1, breakFxAy: 0, ignited: !config.planetStart, ignitions: 0, rockHits: 0, contactHits: 0, disintegrated: 0, diskGrazes: 0, inDisk: 0, tide: 0, diskStripAcc: 0, shots: 0, charge: 0, gathered: 0, boltAngle: 0, bolts: 0, lastBoltSize: 0, boltHitsBh: 0, bhSlow: 0,
    x: f(), y: f(), prevX: f(), prevY: f(), vx: f(), vy: f(), radius: f(), mass: f(),
    orbitR: f(), orbitTarget: f(), orbitAngle: f(), orbitW: f(),
    parent: new Int32Array(capacity).fill(-1),
    state: new Uint8Array(capacity), kind: new Uint8Array(capacity), noCatch: new Float32Array(capacity), life: new Float32Array(capacity),
    broken: new Float32Array(capacity), breakAx: new Float32Array(capacity), breakAy: new Float32Array(capacity), twin: new Int32Array(capacity).fill(-1), halfSide: new Int8Array(capacity), impacts: new Float32Array(MAX_IMPACTS * 4), impactCount: 0, tidalBreaks: 0, planetCrashes: 0, crashX: 0, crashY: 0, crashR: 0,
    orbitingCount: 0, stage: 0, stageUps: 0, maxMass: config.starStartMass, absorbed: 0, captured: new Int32Array(capacity), capturedCount: 0,
    planets: new Int32Array(0), planetDmg: new Float32Array(capacity), joinT: new Float32Array(capacity).fill(1e9), planetCaptures: 0, graveHits: 0, planetBreaks: 0, lastStealCount: 0, ability: 0, planetsHeld: 0, abilityUps: 0, abilityDowns: 0,
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
    // Tamaños y velocidades desparejos: muchas piedras chicas, pocas grandes; la mayoría lentas y algunas veloces
    // (las chicas, en promedio, más rápidas).
    const ang = rng.range(0, Math.PI * 2), u = rng.next(), radius = 0.25 + 1.2 * Math.pow(rng.next(), 2.2);
    const speed = (0.4 + 6 * u * u) * (1.25 - 0.35 * (radius - 0.25) / 1.2);
    addBody(w, { x: px, y: py, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, radius, kind: KIND_ASTEROID });
    placed++;
  }

  // Planetas, algunos con lunas y otros con su propio cinturón de escombros.
  for (let k = 0; k < config.planetCount; k++) {
    let px = 0, py = 0;
    do { px = rng.range(-hw, hw); py = rng.range(-hh, hh); } while (Math.hypot(px, py) < config.spawnClearRadius * 3);
    const ang = rng.range(0, Math.PI * 2), speed = 0.8 + 3.4 * Math.pow(rng.next(), 1.5);   // los planetas derivan, cada uno a su ritmo: hay que esquivarlos
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
  // Algunos planetas rocosos o helados ya están partidos (se sortea al final, sin alterar el resto del mapa).
  for (let i = 0; i < w.count; i++) {
    const k = w.kind[i]!;
    if ((k !== KIND_ROCKY && k !== KIND_ICE) || w.state[i] === DEAD || w.halfSide[i] !== 0) continue;   // los pedazos (de reserva o ya separados) no cuentan
    if (rng.next() >= config.preBrokenChance) continue;
    const a = rng.range(0, Math.PI * 2);
    w.broken[i] = 60; w.breakAx[i] = Math.cos(a); w.breakAy[i] = Math.sin(a);
    w.radius[i] *= 0.85; w.mass[i] = w.radius[i] ** 3;
    splitHalves(w, i, 6);   // partido hace rato: los pedazos ya se separaron un poco
  }
  return w;
}

// Parte el planeta `i` (ya marcado como partido, con su eje y su tamaño de esfera entera) en dos cuerpos: cada
// pedazo con su masa y su centro de masa, alejándose del otro por el eje del corte (el chico, más rápido, como en un
// empujón que conserva el momento). Desde ahí cada uno sigue por su cuenta: deriva, se captura o se pierde solo.
// `apart` = segundos de separación ya recorridos. Sin pedazo de reserva, queda como un cuerpo (el render lo dibuja igual).
// Anota una ruptura para que el render dibuje su explosión.
export function noteBreak(w: World, i: number, ax: number, ay: number): void {
  w.breakFxCount++; w.breakFxX = w.x[i]; w.breakFxY = w.y[i]; w.breakFxR = w.radius[i];
  w.breakFxKind = w.kind[i]!; w.breakFxAx = ax; w.breakFxAy = ay;
}

export function splitHalves(w: World, i: number, apart = 0): void {
  const j = w.twin[i]!;
  if (j < 0 || w.state[j] !== DEAD || w.halfSide[i] !== 0) return;
  const R = w.radius[i], ax = w.breakAx[i]!, ay = w.breakAy[i]!;
  const h0 = cutOffset(halfSeed(Math.min(i, j)));
  const vT = capVolume(h0), vB = 1 - vT;
  const cT = capCentroid(h0) * R, cB = capCentroid(-h0) * R;
  const S = w.config.halfSplitSpeed;
  const x = w.x[i], y = w.y[i], vx = w.vx[i], vy = w.vy[i];
  const uT = S * vB, uB = S * vT;   // velocidades de separación (el momento total se conserva)
  w.x[i] = w.prevX[i] = x + ax * (cT + uT * apart); w.y[i] = w.prevY[i] = y + ay * (cT + uT * apart);
  w.x[j] = w.prevX[j] = x - ax * (cB + uB * apart); w.y[j] = w.prevY[j] = y - ay * (cB + uB * apart);
  w.vx[i] = vx + ax * uT; w.vy[i] = vy + ay * uT;
  w.vx[j] = vx - ax * uB; w.vy[j] = vy - ay * uB;
  w.radius[i] = R * Math.cbrt(vT); w.mass[i] = w.radius[i] ** 3;
  w.radius[j] = R * Math.cbrt(vB); w.mass[j] = w.radius[j] ** 3;
  w.kind[j] = w.kind[i]!; w.state[j] = w.state[i]!; w.parent[j] = -1; w.noCatch[j] = w.noCatch[i]!;
  w.broken[j] = w.broken[i]!; w.breakAx[j] = ax; w.breakAy[j] = ay; w.planetDmg[j] = 0; w.joinT[j] = 1e9;
  w.halfSide[i] = 1; w.halfSide[j] = -1;
  // Recién partido: los pedazos derivan unos segundos antes de que tu gravedad los pueda atrapar (nada de capturas al
  // instante: primero se separan, después se curvan hacia vos y entran).
  if (apart === 0) { w.noCatch[i] = w.config.splitNoCatch; w.noCatch[j] = w.config.splitNoCatch * (1.2 + 0.6 * ((j * 0.618034) % 1)); }
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
  mix(w.star.x); mix(w.star.y); mix(w.star.mass); mix(w.bh.x); mix(w.bh.y); mix(w.bh.mass); mix(w.phase); mix(w.phaseTime);
  for (let i = 0; i < w.count; i++) { mix(w.x[i]); mix(w.y[i]); mix(w.state[i]); }
  return h >>> 0;
}
