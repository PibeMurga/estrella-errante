import { stepComets } from './comets';
import { breakPlanet } from './tidal';
import { damageBody, stepIntegrity } from './integrity';
import { stepRockImpacts } from './rockImpacts';
import { OWN_LIST, ownPlanets } from './ownPlanets';
import { stepEncounters, stepOwnPlanetRams, stepStarFlybys } from './encounters';
import { DT, type SimConfig } from './config';
import { IGNITION_MASS, stageFor } from './stages';
import { stepAbilities } from './abilities';
import { graveHit, isPlanetKind, shatter, joinsOrbit, stepPlanetHits, planetTier, TIER_GRAVE, TIER_HURT } from './planetCapture';
import { releaseLaunch, returnGathered, sling, slingAngle, stepBolts, stepLaunch } from './launch';
import { canCollapse, playerHoleRadius, startCollapse, startHunt, startMerge, stepMerge } from './phase';
import { ABSORBING, BOLT, KIND_ASTEROID, KIND_STAR, noteBreak, CARRIED, captureRadiusFor, DEAD, massGain, FREE, GATHERING, KIND_GAS, KIND_ICE, KIND_ROCKY, MAX_IMPACTS, ORBIT_PLANET, ORBITING, OVER_DIMMED, OVER_ESCAPED, PHASE_COLLAPSE, PHASE_HUNT, PHASE_IGNITION, PHASE_MERGE, PHASE_PLAY, PROJECTILE, RETURNING, OVER_NONE, OVER_SWALLOWED, starSize, type World } from './world';

// target: hacia dónde ir. aim: hacia dónde apuntar la honda (stick derecho); sin aim se apunta al objetivo.
export interface Intent {
  targetX: number; targetY: number; hasTarget: boolean;
  fire?: boolean;
  aimX?: number; aimY?: number; hasAim?: boolean;
  collapse?: boolean;   // pide el colapso a mano (sólo pruebas; en el juego es automático, ver config.autoCollapse)
  hold?: boolean;       // el botón de lanzar está apretado (mantener carga el bólido)
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

// Ancho de la franja de órbitas de los asteroides: crece con la estrella (un enjambre, no un anillo).
export function orbitBandWidth(c: SimConfig, starMass: number): number {
  return c.orbitMax - c.orbitMin + starSize(starMass) * c.orbitWidenK;
}

// Franja de órbitas: empieza un poco por fuera de la estrella y se ensancha a medida que la estrella crece.
let bandLo = 0, bandHi = 0;
function setOrbitBand(w: World): void {
  const c = w.config;
  bandLo = Math.max(c.orbitMin, starSize(w.star.mass) * c.orbitClearance);
  bandHi = bandLo + orbitBandWidth(c, w.star.mass);
}

// La estrella absorbe un cuerpo: no desaparece de golpe, cae en espiral hasta la superficie.
function startAbsorb(w: World, i: number, dx: number, dy: number): void {
  w.state[i] = ABSORBING;
  w.parent[i] = -1;
  w.orbitR[i] = Math.hypot(dx, dy);
  w.orbitAngle[i] = Math.atan2(dy, dx);
  w.absorbed++;
}

// Choque con un planeta grande: sin mundos en órbita la estrella se apaga; si no, pierde algunos y rebota.
function hurt(w: World, p: number): void {
  const c = w.config, s = w.star;
  returnGathered(w);   // el golpe desarma el montón: vuelve a la órbita y cuenta como tuyo
  if (w.orbitingCount === 0) { w.over = OVER_DIMMED; return; }
  w.hits++;
  w.invuln = c.hurtInvuln;
  // El golpe baja tu resistencia (más si el planeta es grande o vos chico); en cero, te fracturás.
  damageBody(w, c.hitIntegrity * (1 + clamp((w.radius[p] / starSize(s.mass) - 1) / 0.5, 0, 1) * 0.5) * smallness(w));
  let nx = s.x - w.x[p], ny = s.y - w.y[p];
  const nd = Math.hypot(nx, ny) || 1;
  nx /= nd; ny /= nd;
  // Choque pesado, no una pelota: pierde casi toda la velocidad contra el planeta, conserva un poco del roce de costado
  // y se separa apenas (más despacio cuanto más grande el planeta). Después queda aturdida un momento.
  const big = clamp((w.radius[p] / starSize(s.mass) - 1) / 0.5, 0, 1);
  const rvx = s.vx - w.vx[p], rvy = s.vy - w.vy[p];
  const vt = rvx * -ny + rvy * nx;
  s.vx = w.vx[p] + nx * c.hurtBounce * (1 - 0.4 * big) + -ny * vt * 0.3;
  s.vy = w.vy[p] + ny * c.hurtBounce * (1 - 0.4 * big) + nx * vt * 0.3;
  w.fireSlow = w.fireSlowT = c.hurtStun; w.fireSlowK = c.hurtStunK;
  // El golpe se ve: explosión en el punto de contacto y un cráter en el planeta.
  const slot = (w.impactCount % MAX_IMPACTS) * 4;
  w.impacts[slot] = p; w.impacts[slot + 1] = Math.atan2(ny, nx); w.impacts[slot + 2] = 1.6; w.impactCount++;
  // Escudo de órbita: se pierde el planeta más exterior (queda suelto, se puede recuperar) en lugar de asteroides.
  if (w.ability >= 2) {
    let out = -1;
    for (let i = 0; i < w.planets.length; i++) { const q = w.planets[i]!; if (w.state[q] === ORBITING && (out < 0 || w.orbitR[q] > w.orbitR[out])) out = q; }
    if (out >= 0) {
      const a = w.orbitAngle[out];
      w.state[out] = FREE;
      w.vx[out] = Math.cos(a) * c.lostSpeed + s.vx * 0.3; w.vy[out] = Math.sin(a) * c.lostSpeed + s.vy * 0.3;
      w.noCatch[out] = c.noCatchTime;
      w.orbitingCount--;
      s.mass = Math.max(c.starStartMass, s.mass - massGain(w, out));
      return;
    }
  }
  // Cuanto más grande el planeta, más duele: perdés una parte de tu órbita y de tu masa.
  const t = clamp((w.radius[p] / starSize(s.mass) - 1) / 0.5, 0, 1);
  // Cuanto más chico sos, más te afecta: un planeta o una enana recién nacida sufre mucho más que una gigante.
  const frail = smallness(w);
  const toLose = Math.max(c.hurtWorldsLost, Math.ceil(w.orbitingCount * Math.min(0.9, (c.hurtLossMin + (c.hurtLossMax - c.hurtLossMin) * t) * frail)));
  s.mass = Math.max(c.starStartMass, s.mass * (1 - Math.min(0.6, (c.hurtMassMin + (c.hurtMassMax - c.hurtMassMin) * t) * frail)));
  let lost = 0;
  for (let i = 0; i < w.count && lost < toLose; i++) {
    if (w.state[i] !== ORBITING || isPlanetKind(w.kind[i]!)) continue;   // se pierden asteroides y lunas, no planetas
    const a = w.orbitAngle[i];
    w.state[i] = FREE;
    w.vx[i] = Math.cos(a) * c.lostSpeed + s.vx * 0.3;
    w.vy[i] = Math.sin(a) * c.lostSpeed + s.vy * 0.3;
    w.noCatch[i] = c.noCatchTime;
    w.orbitingCount--;
    s.mass = Math.max(c.starStartMass, s.mass - massGain(w, i));
    lost++;
  }
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
        s.mass = Math.max(c.starStartMass, s.mass - massGain(w, i));
        return;
      }
      w.state[i] = RETURNING;
    }
  } else {
    if (d < bandHi && w.orbitingCount + w.gathered >= c.orbitCapacity) {
      // Volvió con la órbita llena: la estrella lo absorbe (su masa ya estaba contada).
      startAbsorb(w, i, -dx, -dy);
      return;
    }
    if (d < bandHi) {
      w.state[i] = ORBITING;
      w.orbitR[i] = d;
      w.orbitTarget[i] = clamp(d * 0.9, bandLo, bandHi);
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

// Qué tan frágil sos por tu tamaño: 1,8 siendo muy chico, baja hasta 1 cuando tu cuerpo mide 10 o más.
function smallness(w: World): number {
  return 1 + 0.8 * clamp((10 - starSize(w.star.mass)) / 7, 0, 1);
}

// Un asteroide veloz o grande golpea la estrella: se funde en ella (suma su masa), la empuja un poco y le arranca uno o
// dos cuerpos de la órbita (dos si es grande). Destello en la superficie, en el punto del golpe.
function rockHitsStar(w: World, i: number, dx: number, dy: number): void {
  const c = w.config, s = w.star;
  // Apenas un sacudón: una estrella pesa muchísimo más que una roca.
  const kick = Math.min(1.2, (w.radius[i] ** 3) * 0.6 / Math.sqrt(Math.max(s.mass, 1))) * smallness(w);
  s.vx += (-dx / (Math.hypot(dx, dy) || 1)) * kick;
  s.vy += (-dy / (Math.hypot(dx, dy) || 1)) * kick;
  w.state[i] = DEAD;
  s.mass += massGain(w, i);
  const slot = (w.impactCount % MAX_IMPACTS) * 4;
  w.impacts[slot] = -1; w.impacts[slot + 1] = Math.atan2(dy, dx); w.impacts[slot + 2] = 0.5 + 0.5 * Math.min(1, w.radius[i]); w.impactCount++;
  w.rockHits++;
  damageBody(w, c.rockIntegrity * smallness(w));
  let lose = Math.round((w.radius[i] > c.rockHitSize ? 2 : 1) * smallness(w));   // más si sos chico
  for (let j = 0; j < w.count && lose > 0; j++) {
    if (w.state[j] !== ORBITING || isPlanetKind(w.kind[j]!)) continue;
    const a = w.orbitAngle[j];
    w.state[j] = FREE; w.orbitingCount--;
    w.vx[j] = s.vx + Math.cos(a) * c.lostSpeed; w.vy[j] = s.vy + Math.sin(a) * c.lostSpeed;
    w.noCatch[j] = c.noCatchTime;
    s.mass = Math.max(c.starStartMass, s.mass - massGain(w, j));
    lose--;
  }
}

// Los planetas más grandes que vos son sólidos: aunque estés en los segundos sin daño después de un golpe, tu estrella no
// los atraviesa. Choca, pierde la velocidad con que se metía y queda apoyada.
function solidBigPlanets(w: World): void {
  const s = w.star, size = starSize(s.mass);
  for (let q = 0; q < w.planets.length * 2; q++) {
    const P = w.planets, p = q < P.length ? P[q]! : w.twin[P[q - P.length]!]!;
    if (p < 0 || w.radius[p] <= size) continue;
    const okState = w.state[p] === FREE || (w.state[p] === ORBIT_PLANET && w.parent[p]! >= 0 && w.kind[w.parent[p]!] === KIND_STAR);
    if (!okState) continue;
    const dx = s.x - w.x[p], dy = s.y - w.y[p], D = size + w.radius[p], d2 = dx * dx + dy * dy;
    if (d2 >= D * D) continue;
    const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
    s.x = w.x[p] + nx * D; s.y = w.y[p] + ny * D;
    const vn = (s.vx - w.vx[p]) * nx + (s.vy - w.vy[p]) * ny;
    if (vn < 0) { s.vx -= vn * nx; s.vy -= vn * ny; }
  }
}

// Las estrellas del mapa: te tiran con su gravedad (mucho más que un planeta), de cerca te arrancan cuerpos de la
// órbita, y si la tocás: siendo más chico que ella, te quema (perdés masa y resistencia y te empuja hacia afuera);
// siendo una estrella claramente más grande, la absorbés (suma mucha masa) y sus planetas quedan sueltos.
// Imán de órbita: cerca de un cuerpo más grande que vos, tu movimiento se va volviendo una órbita a su alrededor (se
// frena lo que va hacia él o se aleja, y se suma la velocidad de giro). Fuerza `strength`, alcance `zoneK` radios.
function couple(w: World, cx: number, cy: number, cvx: number, cvy: number, R: number, strength: number, zoneK: number): void {
  const s = w.star, me = starSize(s.mass), gx = cx - s.x, gy = cy - s.y, g = Math.hypot(gx, gy) || 1;
  const zone = R * zoneK + me;
  if (g >= zone) return;
  const close = 1 - Math.max(0, g - R - me) / (zone - R - me);
  const k = Math.min(1, strength * Math.min(2.5, R / me - 0.4) * close * close * DT);
  if (k <= 0) return;
  const ux = gx / g, uy = gy / g, tx = -uy, ty = ux;
  const rvx = s.vx - cvx, rvy = s.vy - cvy;
  const vr = rvx * ux + rvy * uy, vtNow = rvx * tx + rvy * ty;
  const vOrb = Math.min(22, Math.sqrt(w.config.starGravity * R * R * R / Math.max(g, R + me)));
  const vtWant = (vtNow >= 0 ? 1 : -1) * vOrb;
  const nvr = vr * (1 - k), nvt = vtNow + (vtWant - vtNow) * k;
  s.vx = cvx + ux * nvr + tx * nvt; s.vy = cvy + uy * nvr + ty * nvt;
}

function mapStarsAct(w: World): void {
  const c = w.config, s = w.star, me = starSize(s.mass), M = w.mapStars;
  w.starPullNow = 0;
  for (let q = 0; q < M.length; q++) {
    const st = M[q]!;
    if (w.state[st] === DEAD) continue;
    const R = w.radius[st], gx = w.x[st] - s.x, gy = w.y[st] - s.y, g2 = gx * gx + gy * gy, g = Math.sqrt(g2) || 1;
    const reach = R * 8 + me;   // con estrellas grandes, un alcance moderado (si no, tiran desde media pantalla)
    if (g < reach) {
      const a = Math.min(14, c.starGravity * R * R * R / Math.max(g2, (R + me) * (R + me))) * (1 - g / reach) * (w.coasting ? c.coastPullMul : 1);
      s.vx += (gx / g) * a * DT; s.vy += (gy / g) * a * DT;
      w.starPullNow = Math.max(w.starPullNow, a);
    }
    // Te acopla a su órbita: cerca de una estrella más grande que vos, tu movimiento se va volviendo una órbita a su
    // alrededor (se frena lo que va hacia ella o se aleja, y se suma la velocidad de giro). Si la diferencia no es
    // enorme, acelerando te escapás.
    if (R > me * 0.9) couple(w, w.x[st], w.y[st], w.vx[st], w.vy[st], R, c.starCouple * (w.coasting ? 2.2 : 0.6), 6);
    const touch = R + me;
    if (g < touch) {
      if (w.ignited && me > R * 1.15) {
        // La absorbés: suma mucha masa; sus planetas quedan sueltos.
        s.mass += 6 + R * 2.2;
        noteBreak(w, st, gx / g, gy / g);
        w.state[st] = DEAD;
        for (let j = 0; j < w.count; j++) if (w.parent[j] === st && w.state[j] !== DEAD) { w.parent[j] = -1; w.state[j] = FREE; w.noCatch[j] = 1; }
        w.starsEaten++;
      } else if (w.invuln <= 0) {
        // Te quema: perdés masa y resistencia y te empuja hacia afuera.
        w.invuln = c.hurtInvuln;
        s.mass = Math.max(c.starStartMass, s.mass * 0.82);
        damageBody(w, 0.45);
        s.vx = w.vx[st] - (gx / g) * 9; s.vy = w.vy[st] - (gy / g) * 9;
        s.x = w.x[st] - (gx / g) * touch; s.y = w.y[st] - (gy / g) * touch;
        w.starBurns++;
        if (w.orbitingCount === 0 && s.mass <= c.starStartMass * 1.01) { w.over = OVER_DIMMED; return; }
      }
    }
    // De cerca, la marea de la estrella te arranca de a poco lo que tenés en órbita.
    const strip = Math.max(0, 1 - (g - R - me) / (R * 3));
    if (strip > 0 && w.orbitingCount > 0) {
      w.planetStripAcc += c.planetStrip * 1.6 * strip * strip * DT * Math.sqrt(w.orbitingCount);
      while (w.planetStripAcc >= 1 && w.orbitingCount > 0) {
        w.planetStripAcc -= 1;
        let best = -1, bestD = Infinity;
        for (let i = 0; i < w.count; i++) {
          if (w.state[i] !== ORBITING || isPlanetKind(w.kind[i]!)) continue;
          const e = (w.x[i] - w.x[st]) ** 2 + (w.y[i] - w.y[st]) ** 2;
          if (e < bestD) { bestD = e; best = i; }
        }
        if (best < 0) break;
        const bx = w.x[st] - w.x[best], by = w.y[st] - w.y[best], bd = Math.hypot(bx, by) || 1;
        w.state[best] = FREE; w.orbitingCount--;
        w.vx[best] = s.vx + (bx / bd) * 7; w.vy[best] = s.vy + (by / bd) * 7;
        w.noCatch[best] = 2.5;
        s.mass = Math.max(c.starStartMass, s.mass - massGain(w, best));
        w.planetSteals++;
      }
    }
  }
}

// Disco de acreción del rival: meterse cuesta, aunque pases rápido. Cuanto más hondo, más: el gas te frena, la marea te
// arranca cuerpos de la órbita (salen hacia el agujero, que se los come) y perdés masa.
function crossDisk(w: World, dd: number): void {
  const c = w.config, s = w.star, bh = w.bh;
  const R = bh.radius * c.bhDiskR, T = bh.radius * c.bhTidalR, S = bh.radius * c.bhSwallowR;
  const depth = dd < R ? 1 - (dd - S) / (R - S) : 0;
  // Zona de marea (más amplia que el disco): primero te arranca la órbita; sin órbita, deshace tu estrella de a poco.
  const tide = dd < T ? Math.min(1, 1 - (dd - S) / (T - S)) : 0;
  w.tide = Math.max(0, tide);
  if (depth > 0 && w.inDisk === 0) w.diskGrazes++;
  w.inDisk = Math.max(0, Math.min(1, depth));
  if (tide <= 0) { w.diskStripAcc = 0; return; }
  if (w.orbitingCount === 0) {
    // Ya no te queda nada que te proteja: la marea te va deshaciendo, suave y cada vez más rápido. En cero, se terminó.
    s.mass = Math.max(0, s.mass * (1 - c.bhTidalDrain * (tide * tide + 0.15 * tide) * DT) - 0.02 * tide * DT);
    if (s.mass <= c.starStartMass * 0.25) { w.over = OVER_SWALLOWED; return; }
  }
  const kt = tide * tide * 0.35;                    // la marea, suave lejos del disco
  const k = w.inDisk * w.inDisk + 0.25 * w.inDisk;   // el disco: suave en el borde, muy fuerte adentro
  const drag = Math.max(0, 1 - c.bhDiskDrag * k * DT);
  s.vx *= drag; s.vy *= drag;
  if (k > 0) s.mass = Math.max(w.orbitingCount === 0 ? 0 : c.starStartMass, s.mass * (1 - c.bhDiskDrain * k * DT));
  w.diskStripAcc += c.bhDiskStrip * (k + kt) * DT * w.orbitingCount;
  while (w.diskStripAcc >= 1 && w.orbitingCount > 0) {
    w.diskStripAcc -= 1;
    // El cuerpo de la órbita más cercano al agujero sale despedido hacia él.
    let best = -1, bestD = Infinity;
    for (let i = 0; i < w.count; i++) {
      if (w.state[i] !== ORBITING || isPlanetKind(w.kind[i]!)) continue;
      const e = (w.x[i] - bh.x) ** 2 + (w.y[i] - bh.y) ** 2;
      if (e < bestD) { bestD = e; best = i; }
    }
    if (best < 0) break;
    const gx = bh.x - w.x[best], gy = bh.y - w.y[best], gd = Math.hypot(gx, gy) || 1;
    w.state[best] = FREE; w.orbitingCount--;
    w.vx[best] = s.vx + (gx / gd) * 12; w.vy[best] = s.vy + (gy / gd) * 12;
    w.noCatch[best] = 3;
    s.mass = Math.max(c.starStartMass, s.mass - massGain(w, best));
  }
}

// Se acomoda en su órbita (o cae a la estrella si la está absorbiendo) a velocidad limitada:
// se lo ve acercarse e imantarse, no saltar. La franja sigue el tamaño de la estrella.
function moveOrbiting(w: World, i: number, absorbing: boolean, size: number, holeR = 0): void {
  const c = w.config, s = w.star;
  if (holeR > 0) {
    // Siendo agujero negro, tu sistema cae de a poco al centro, en espiral y cada vez más rápido.
    // Cada cuerpo a su ritmo (los planetas, más lento). Su masa ya estaba contada: no se suma otra vez.
    const pace = (0.5 + ((i * 0.618034) % 1)) * (isPlanetKind(w.kind[i]!) ? 0.6 : 1);
    const r = w.orbitR[i] - c.huntOrbitFall * pace * (1 + 8 / Math.max(w.orbitR[i], 1)) * DT;
    w.orbitR[i] = r;
    if (r <= holeR * 0.9) { w.state[i] = DEAD; w.orbitingCount--; return; }
    const a = w.orbitAngle[i] + c.orbitSpeedK * Math.pow(c.orbitMin / Math.max(r, 1e-6), 1.5) * DT;
    w.orbitAngle[i] = a;
    w.x[i] = s.x + Math.cos(a) * r; w.y[i] = s.y + Math.sin(a) * r;
    return;
  }
  // Los planetas van en una franja propia, más afuera y más lenta que la de los asteroides.
  const planet = isPlanetKind(w.kind[i]!);
  const lo = planet ? bandHi + c.planetOrbitGap : bandLo, hi = planet ? lo + c.planetOrbitSpan : bandHi;
  let target = absorbing ? size * 0.7 : clamp(w.orbitTarget[i], lo, hi);
  // Recién atrapado se imanta: conserva el giro con que venía, se frena, baja un poco más que su órbita y después vuelve
  // suave a su lugar. Cada cuerpo a su manera: cuánto baja y cuánto tarda cambian (más lento si es un planeta).
  const v1 = (i * 0.618034) % 1, v2 = (i * 0.414214) % 1;
  const join = (planet ? c.planetJoinTime : c.bodyJoinTime) * (0.7 + 1.1 * v2);
  let k = 1;
  if (w.joinT[i]! < join) {
    const t = w.joinT[i]! / join; k = t * t * (3 - 2 * t); w.joinT[i] = w.joinT[i]! + DT;
    if (!absorbing) target = Math.max(size * 1.3, target * (1 - (0.08 + 0.22 * v1) * Math.sin(Math.PI * Math.min(1, t * 1.15))));
  }
  const maxDr = (planet ? c.planetInfallSpeed : c.orbitInfallSpeed) * (absorbing ? 1.6 : 1) * (0.25 + 0.75 * k) * DT;
  // Al entrar sigue con el movimiento que traía (hacia vos o alejándose) y de a poco pasa a acomodarse: continuo, pesado.
  const settle = clamp((target - w.orbitR[i]) * c.orbitEase, -maxDr, maxDr);
  const r = Math.max(absorbing ? 0 : size * 1.2, w.orbitR[i] + (k >= 1 || absorbing ? settle : (1 - k) * w.life[i]! * DT + k * settle));
  w.orbitR[i] = r;
  if (absorbing && r <= size * 0.8) { w.state[i] = DEAD; return; }
  // Cuanto más crecés, más fuerte gira tu sistema: todo lo que te orbita va un poco más rápido.
  const wOrbit = c.orbitSpeedK * Math.pow(c.orbitMin / Math.max(r, 1e-6), 1.5) * (1 + c.orbitSpinGrowth * Math.min(1, Math.sqrt(Math.max(0, s.mass) / 310)));
  // Al entrar se frena (gira más lento) y recupera el ritmo de la órbita al acoplarse.
  const a = w.orbitAngle[i] + (k >= 1 ? wOrbit : w.orbitW[i] + (wOrbit - w.orbitW[i]) * k) * DT;
  w.orbitAngle[i] = a;
  w.x[i] = s.x + Math.cos(a) * r;
  w.y[i] = s.y + Math.sin(a) * r;
}



// Tus planetas no se enciman: si dos se tocan en la órbita, se van separando de a poco a lo largo de ella
// (el de adelante se adelanta y el de atrás se atrasa). También los dos pedazos de un partido.
function separateOwnPlanets(w: World): void {
  const n = ownPlanets(w);
  for (let a = 0; a < n; a++) {
    const i = OWN_LIST()[a]!;
    for (let b = a + 1; b < n; b++) {
      const j = OWN_LIST()[b]!;
      const dx = w.x[i] - w.x[j], dy = w.y[i] - w.y[j], rr = (w.radius[i] + w.radius[j]) * 1.15;
      if (dx * dx + dy * dy >= rr * rr) continue;
      let da = Math.atan2(Math.sin(w.orbitAngle[i] - w.orbitAngle[j]), Math.cos(w.orbitAngle[i] - w.orbitAngle[j]));
      if (Math.abs(da) < 1e-4) da = i < j ? 1e-4 : -1e-4;
      const push = 0.5 * DT * Math.sign(da);
      w.orbitAngle[i] += push; w.orbitAngle[j] -= push;
    }
  }
}

// Cinemáticas (colapso y fusión): guion fijo. Sólo gira lo que está en órbita; lo demás espera.
function cinematic(w: World): void {
  w.phaseTime += DT;
  setOrbitBand(w);
  const size = starSize(w.star.mass);
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st === ORBITING || st === ABSORBING) moveOrbiting(w, i, st === ABSORBING, size);
  }
  if (w.phase === PHASE_COLLAPSE) {
    // El rival siente la supernova y huye: la caza nunca arranca con él pegado.
    const bh = w.bh, s = w.star;
    if (bh.active) {
      const dx = bh.x - s.x, dy = bh.y - s.y, d = Math.hypot(dx, dy) || 1;
      bh.prevX = bh.x; bh.prevY = bh.y;
      bh.x += (dx / d) * w.config.huntFleeSpeed * DT; bh.y += (dy / d) * w.config.huntFleeSpeed * DT;
    }
    if (w.phaseTime >= w.config.collapseTime) startHunt(w);
  }
  else if (w.phase === PHASE_IGNITION) stepIgnition(w);
  else stepMerge(w);
}

// Ignición: el centro se comprime, destella y una onda empuja lo suelto que está cerca; al final nace tu estrella:
// se desbloquea el disparo, despierta el agujero negro y empieza a correr el reloj de los cometas.
function stepIgnition(w: World): void {
  const c = w.config, s = w.star, t = w.phaseTime;
  if (t >= 1.2 && t - DT < 1.2) {
    for (let i = 0; i < w.count; i++) {
      if (w.state[i] !== FREE) continue;
      const dx = w.x[i] - s.x, dy = w.y[i] - s.y, d2 = dx * dx + dy * dy;
      if (d2 > 25 * 25 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), push = 4 * (1 - d / 25);   // suave: el gran empujón es el del colapso
      w.vx[i] += (dx / d) * push; w.vy[i] += (dy / d) * push;
    }
  }
  // Lo suelto sigue moviéndose durante la cinemática (empujado por la onda).
  for (let i = 0; i < w.count; i++) if (w.state[i] === FREE && w.parent[i] === -1) { w.x[i] += w.vx[i] * DT; w.y[i] += w.vy[i] * DT; }
  if (t >= c.ignitionTime) {
    w.phase = PHASE_PLAY; w.phaseTime = 0;
    w.ignited = true;
    w.cometClock = c.cometFirst;
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
  w.comets.prevX.set(w.comets.x);
  w.comets.prevY.set(w.comets.y);
  // Partida terminada: todo queda quieto (y sin interpolar) hasta que se reinicie.
  if (w.over !== OVER_NONE) return;
  if (w.phase === PHASE_COLLAPSE || w.phase === PHASE_MERGE || w.phase === PHASE_IGNITION) { cinematic(w); w.tick++; return; }
  // Siendo planeta el agujero negro rival duerme: no se mueve, no atrae ni traga. Despierta con la ignición.
  const awake = bh.active && w.ignited;
  const hunting = w.phase === PHASE_HUNT;
  if (w.invuln > 0) w.invuln = Math.max(0, w.invuln - DT);
  stepIntegrity(w, DT);
  if (w.slingCd > 0) w.slingCd = Math.max(0, w.slingCd - DT);
  if (w.bhSlow > 0) w.bhSlow = Math.max(0, w.bhSlow - DT);

  let bhPullX = 0, bhPullY = 0;
  // El agujero negro persigue a la estrella, cada vez un poco más rápido.
  const range2 = c.bhRange * c.bhRange;
  // Crece con la raíz de su masa: comer lo hace más peligroso, pero no imposible de esquivar.
  const G = c.bhPull * Math.sqrt(bh.mass);
  if (awake) {
    const dx = s.x - bh.x, dy = s.y - bh.y;
    const d = Math.hypot(dx, dy);
    if (hunting) {
      // En la caza huye de vos, a velocidad fija.
      // Cerca del borde del mapa (que da la vuelta alrededor tuyo) no puede alejarse más: huye de costado.
      if (d > 1e-6) {
        const ux = -dx / d, uy = -dy / d;
        const edge = d >= Math.min(hw, hh) * 0.8;
        bh.vx = (edge ? -uy : ux) * c.huntFleeSpeed; bh.vy = (edge ? ux : uy) * c.huntFleeSpeed;
      }
    } else {
      bh.speed = Math.min(c.bhMaxSpeed, bh.speed + c.bhAccel * DT);
      const v = w.bhSlow > 0 ? bh.speed * c.boltBhSlowFactor : bh.speed;   // un bólido lo frena unos segundos
      if (d > 1e-6) { bh.vx = (dx / d) * v; bh.vy = (dy / d) * v; }
    }
    bh.x += bh.vx * DT;
    bh.y += bh.vy * DT;
    // Sin bordes: la vuelta del mapa se calcula alrededor de la estrella.
    if (bh.x - s.x > hw) { bh.x -= 2 * hw; bh.prevX -= 2 * hw; } else if (bh.x - s.x < -hw) { bh.x += 2 * hw; bh.prevX += 2 * hw; }
    if (bh.y - s.y > hh) { bh.y -= 2 * hh; bh.prevY -= 2 * hh; } else if (bh.y - s.y < -hh) { bh.y += 2 * hh; bh.prevY += 2 * hh; }
    // Su gravedad también tira de la estrella.
    const gx = bh.x - s.x, gy = bh.y - s.y;
    const g2 = gx * gx + gy * gy;
    if (!hunting && g2 < range2 && g2 > 1e-9) {
      const a = c.bhStarPull * Math.min(c.bhMaxAccel, G / Math.max(g2, 1)) * DT / Math.sqrt(g2);
      bhPullX = gx * a; bhPullY = gy * a;   // se suma después del control: tu manejo no lo anula
    }
  }

  if (w.fireSlow > 0) w.fireSlow = Math.max(0, w.fireSlow - DT);
  // Movimiento con inercia: acelera hacia una velocidad deseada y frena para llegar sin pasarse.
  const acc = hunting ? c.starAccel : c.starAccel / (1 + c.starMassInertia * s.mass);   // siendo agujero negro ya no cargás con la inercia de la estrella
  let desX = 0;
  let desY = 0;
  // Sin el clic izquierdo, vas suelto: casi no frenás y te llevan las fuerzas de lo que tenés cerca (mucho más fuerte).
  const coasting = !hunting && !intent.hasTarget;
  w.coasting = coasting;
  let maxDv = acc * c.starBrake * DT * (coasting ? 0.15 : 1);
  if (intent.hasTarget && Number.isFinite(intent.targetX) && Number.isFinite(intent.targetY)) {
    const dx = intent.targetX - s.x;
    const dy = intent.targetY - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1e-6) {
      // Siendo agujero negro en la caza no frenás al acercarte: vas a fondo hacia lo que apuntás.
      const speed = hunting ? (dist > 1 ? c.starMaxSpeed : 0) : Math.min(c.starMaxSpeed, Math.sqrt(2 * acc * 0.8 * dist), (c.starMaxSpeed * dist) / c.starSlowRadius);
      // Recién disparaste: la marcha deseada vuelve de a poco a la normal.
      const slow = w.fireSlow > 0 ? 1 - w.fireSlowK * (w.fireSlow / w.fireSlowT) : 1;
      desX = (dx / dist) * speed * slow;
      desY = (dy / dist) * speed * slow;
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
  if (!hunting) mapStarsAct(w);
  if (w.over !== OVER_NONE) { w.tick++; return; }
  // Los planetas sueltos también te tiran, según su tamaño (los inmensos se sienten; los chicos, casi nada).
  let strongest = -1, strongestA = 0;
  if (!hunting) {
    const P = w.planets, me = starSize(s.mass);
    for (let q = 0; q < P.length; q++) {
      const p = P[q]!;
      if (w.state[p] !== FREE) continue;
      const r = w.radius[p], gx = w.x[p] - s.x, gy = w.y[p] - s.y, g2 = gx * gx + gy * gy, reach = r * 7 + me;
      if (g2 > reach * reach || g2 < 1e-6) continue;
      const g = Math.sqrt(g2), a = Math.min(6, c.planetGravity * r * r * r / Math.max(g2, (r + me) * (r + me))) * (1 - g / reach) * (coasting ? c.coastPullMul : 1);
      s.vx += (gx / g) * a * DT; s.vy += (gy / g) * a * DT;
      // El que más tira (y es más grande que vos) te acopla a su órbita si vas suelto.
      if (r > me * 1.1 && a > strongestA) { strongestA = a; strongest = p; }
      // Un planeta bastante más grande que vos, de cerca, te roba de a poco lo que tenés en órbita (más suave que el
      // agujero negro): conviene alejarse.
      const strip = r > me * 1.3 ? Math.max(0, 1 - (g - r - me) / (r * 1.6)) : 0;
      if (strip > 0 && w.orbitingCount > 0) {
        w.planetStripAcc += c.planetStrip * strip * strip * Math.min(2, r / me - 1) * DT * Math.sqrt(w.orbitingCount);
        while (w.planetStripAcc >= 1 && w.orbitingCount > 0) {
          w.planetStripAcc -= 1;
          let best = -1, bestD = Infinity;
          for (let i = 0; i < w.count; i++) {
            if (w.state[i] !== ORBITING || isPlanetKind(w.kind[i]!)) continue;
            const e = (w.x[i] - w.x[p]) ** 2 + (w.y[i] - w.y[p]) ** 2;
            if (e < bestD) { bestD = e; best = i; }
          }
          if (best < 0) break;
          const bx = w.x[p] - w.x[best], by = w.y[p] - w.y[best], bd = Math.hypot(bx, by) || 1;
          w.state[best] = FREE; w.orbitingCount--;
          w.vx[best] = s.vx + (bx / bd) * 6; w.vy[best] = s.vy + (by / bd) * 6;
          w.noCatch[best] = 2.5;
          s.mass = Math.max(c.starStartMass, s.mass - massGain(w, best));
          w.planetSteals++;
        }
      }
    }
  }
  if (coasting && strongest >= 0 && strongestA > w.starPullNow) couple(w, w.x[strongest], w.y[strongest], w.vx[strongest], w.vy[strongest], w.radius[strongest], c.starCouple * 1.6, 5);
  s.vx += bhPullX * (coasting ? 1.6 : 1); s.vy += bhPullY * (coasting ? 1.6 : 1);
  if (sp > c.starMaxSpeed) { s.vx *= c.starMaxSpeed / sp; s.vy *= c.starMaxSpeed / sp; }
  s.x += s.vx * DT;
  s.y += s.vy * DT;
  const holeR = hunting ? playerHoleRadius(w) : 0;
  if (awake) {
    const dd = Math.hypot(s.x - bh.x, s.y - bh.y);
    if (hunting) {
      w.inDisk = 0; w.tide = 0;
      if (dd < holeR + bh.radius) { startMerge(w); w.tick++; return; }
    } else if (dd < bh.radius * c.bhSwallowR + starSize(s.mass) * 0.5) {
      w.over = OVER_SWALLOWED;
      w.tick++;
      return;
    } else { crossDisk(w, dd); if (w.over !== OVER_NONE) { w.tick++; return; } }
  }

  setOrbitBand(w);
  const captureR = s.captureRadius;
  const size = starSize(s.mass);
  let hit = -1;
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st !== DEAD && w.broken[i] > 0) w.broken[i] += DT;   // un planeta partido se sigue enfriando, esté donde esté
    if (st === DEAD || st === CARRIED || st === GATHERING || st === BOLT) continue;
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
        // La gravedad de tu sistema: los asteroides y lunas sueltas cercanas se curvan hacia vos y caen a tu órbita.
        const pieceOfPlanet = w.broken[i]! > 0 && w.kind[i] !== KIND_GAS;   // los pedazos de un partido también caen hacia vos
        if (!hunting && w.kind[i] !== KIND_STAR && (pieceOfPlanet || (w.kind[i] !== KIND_ROCKY && w.kind[i] !== KIND_ICE && w.kind[i] !== KIND_GAS)) && w.noCatch[i]! <= 0
            && w.radius[i] <= c.rockHitSize && w.vx[i] * w.vx[i] + w.vy[i] * w.vy[i] <= c.rockHitSpeed * c.rockHitSpeed) {   // los que te golpean, no: pasan derecho
          const ex = s.x - x, ey = s.y - y, e2 = ex * ex + ey * ey, R = captureR * c.starPullReach;
          if (e2 < R * R && e2 > 1e-6) {
            // Siendo planeta tu gravedad es mucho más débil: atrae poco y de cerca.
            const e = Math.sqrt(e2), a = c.starPullAccel * (pieceOfPlanet ? 0.35 : 1) * (w.ignited ? 1 : c.planetPullMul) * (1 - e / R) * DT / e;
            w.vx[i] += ex * a; w.vy[i] += ey * a;
          }
        }
        if (awake) {
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
      if (hunting) {
        // Tu agujero negro aspira: lo que entra en su zona de atracción cae en espiral, cada vez más rápido, y se lo traga.
        // Nada pasa de largo. No hay capturas ni choques.
        if (d < holeR * c.huntPullRange) {
          if (st === ORBIT_PLANET) {
            // Arranca la luna de su planeta, con la velocidad que llevaba al girar.
            const p = w.parent[i]!, ang = w.orbitAngle[i], v = w.orbitW[i] * w.orbitR[i];
            w.vx[i] = w.vx[p] - Math.sin(ang) * v; w.vy[i] = w.vy[p] + Math.cos(ang) * v;
            w.state[i] = FREE; w.parent[i] = -1;
          }
          const nd = Math.max(d, 1e-6), rx = (s.x - x) / nd, ry = (s.y - y) / nd;
          const acc = Math.min(c.huntPullMax, c.huntPullAccel * (holeR / Math.max(d, 1)) ** 2);
          w.vx[i] += (rx - ry * 0.3) * acc * DT;   // hacia el centro, con un poco de giro: espiral
          w.vy[i] += (ry + rx * 0.3) * acc * DT;
          const drag = 1 - c.huntPullDrag * DT;     // pierde velocidad respecto de vos: no queda orbitando
          w.vx[i] = s.vx + (w.vx[i] - s.vx) * drag; w.vy[i] = s.vy + (w.vy[i] - s.vy) * drag;
        }
        if (d < holeR * c.huntSwallowFactor) { w.state[i] = DEAD; s.mass += massGain(w, i); }
        continue;
      }
      // Escalón del planeta: los más grandes que la estrella la dañan al tocarla (o es un golpe grave).
      const k = w.kind[i]!;
      // Planetas sueltos, y también los que giran alrededor de una estrella del mapa: son sólidos igual.
      const loose = isPlanetKind(k) && ((st === FREE && w.parent[i] === -1) || (st === ORBIT_PLANET && w.parent[i] >= 0 && w.kind[w.parent[i]!] === KIND_STAR));
      const tier = loose ? planetTier(w.radius[i], s.mass) : -1;
      if (tier >= TIER_HURT && d < size + w.radius[i] && hit < 0 && w.invuln <= 0) hit = i;
      if (w.noCatch[i]! > 0) { w.noCatch[i] = w.noCatch[i]! - DT; continue; }
      // Los asteroides veloces o grandes no se suman: si te tocan, te golpean.
      if (st === FREE && k === KIND_ASTEROID && (w.radius[i] > c.rockHitSize || Math.hypot(w.vx[i], w.vy[i]) > c.rockHitSpeed)) {
        if (d < size + w.radius[i]) rockHitsStar(w, i, x - s.x, y - s.y);
        continue;
      }
      // Para robarle algo a un planeta, la estrella tiene que ser claramente más grande que él.
      const canSteal = st === FREE || starSize(s.mass) >= w.radius[w.parent[i]!] * c.stealSizeRatio;
      const joins = tier >= 0 && joinsOrbit(w, i);   // planetas chicos, o medianos ya partidos: entran solos
      const small = w.radius[i] <= c.maxCaptureSize || joins;
      // A un planeta se lo atrapa ya desde el borde de su franja: se lo ve acercarse y caer en órbita.
      const reach = joins ? Math.max(captureR, bandHi + c.planetOrbitGap + c.planetOrbitSpan) : captureR;
      // Los planetas tienen su propia órbita: no cuentan para el tope (nunca se absorben).
      if (canSteal && d < reach && small && !joins && w.orbitingCount + w.gathered >= c.orbitCapacity) {
        // Órbita llena: la estrella lo absorbe (suma su masa y el cuerpo queda libre para la reserva de escombros).
        startAbsorb(w, i, x - s.x, y - s.y);
        s.mass += massGain(w, i);
        continue;
      }
      if (canSteal && d < reach && small) {
        w.state[i] = ORBITING;
        w.parent[i] = -1;
        w.orbitR[i] = d;
        if (joins) { w.orbitTarget[i] = Math.min(d, bandHi + c.planetOrbitGap + ((i * 0.618034) % 1) * c.planetOrbitSpan); w.planetCaptures++; }
        else w.orbitTarget[i] = clamp(d * 0.9, bandLo, bandHi);
        w.orbitAngle[i] = Math.atan2(y - s.y, x - s.x);
        // Giro con que venía, alrededor de la estrella: desde ahí se acopla de a poco (ver moveOrbiting).
        w.orbitW[i] = clamp(((x - s.x) * (w.vy[i] - s.vy) - (y - s.y) * (w.vx[i] - s.vx)) / Math.max(d * d, 1e-6), -3, 3);
        // Y la velocidad con que se acercaba (o alejaba): la conserva al principio, así no se frena de golpe.
        w.life[i] = clamp(((x - s.x) * (w.vx[i] - s.vx) + (y - s.y) * (w.vy[i] - s.vy)) / Math.max(d, 1e-6), -12, 12);
        w.joinT[i] = 0;
        w.orbitingCount++;
        s.mass += massGain(w, i);
        w.captured[w.capturedCount++] = i;
      }
    } else moveOrbiting(w, i, st === ABSORBING, size, hunting && st === ORBITING ? holeR : 0);
  }

  separateOwnPlanets(w);
  stepEncounters(w);
  stepOwnPlanetRams(w);
  stepRockImpacts(w);
  if (!hunting) stepStarFlybys(w);
  if (hit >= 0) { if (planetTier(w.radius[hit], s.mass) === TIER_GRAVE) graveHit(w, hit); else hurt(w, hit); }
  if (!hunting) solidBigPlanets(w);
  if (w.over !== OVER_NONE) { w.tick++; return; }   // se apagó en este paso: no pasa nada más
  if (!hunting) stepComets(w);
  if (!hunting) {
    stepBolts(w);
    stepPlanetHits(w);
    if (intent.fire && w.slingCd <= 0 && w.orbitingCount > 0) {   // disparo directo (bot y pruebas)
      const a = slingAngle(w, intent);
      if (Number.isFinite(a)) sling(w, a);
    }
    stepLaunch(w, intent);
  }
  bh.radius = c.bhStartRadius * Math.cbrt(bh.mass);
  stepAbilities(w);
  s.captureRadius = captureRadiusFor(c, s.mass) * (w.ability >= 1 ? c.abilityGravityMul : 1);   // gravedad ampliada
  if (s.mass > w.maxMass) w.maxMass = s.mass;
  // Al llegar a la masa de ignición, se enciende la fusión: cinemática de la ignición (una sola vez).
  if (!w.ignited && w.phase === PHASE_PLAY && s.mass >= IGNITION_MASS) { w.phase = PHASE_IGNITION; w.phaseTime = 0; w.ignitions++; releaseLaunch(w); }
  const st = stageFor(s.mass);
  if (st > w.stage) { w.stage = st; w.stageUps++; }
  if (hunting) {
    w.phaseTime += DT;
    if (w.phaseTime >= c.huntTimeLimit) w.over = OVER_ESCAPED;
  } else if ((c.autoCollapse || intent.collapse) && canCollapse(w)) startCollapse(w);   // la última transformación es automática
  w.tick++;
}
