import { stepComets } from './comets';
import { breakPlanet } from './tidal';
import { stepEncounters, stepStarFlybys } from './encounters';
import { DT, type SimConfig } from './config';
import { stageFor } from './stages';
import { stepAbilities } from './abilities';
import { graveHit, isPlanetKind, joinsOrbit, stepPlanetHits, planetTier, TIER_GRAVE, TIER_HURT } from './planetCapture';
import { returnGathered, sling, slingAngle, stepBolts, stepLaunch } from './launch';
import { canCollapse, playerHoleRadius, startCollapse, startHunt, startMerge, stepMerge } from './phase';
import { ABSORBING, BOLT, CARRIED, captureRadiusFor, DEAD, massGain, FREE, GATHERING, KIND_GAS, KIND_ICE, KIND_ROCKY, ORBIT_PLANET, ORBITING, OVER_DIMMED, OVER_ESCAPED, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, PROJECTILE, RETURNING, OVER_NONE, OVER_SWALLOWED, starSize, type World } from './world';

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
  let nx = s.x - w.x[p], ny = s.y - w.y[p];
  const nd = Math.hypot(nx, ny) || 1;
  nx /= nd; ny /= nd;
  s.vx = nx * c.hurtBounce;
  s.vy = ny * c.hurtBounce;
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
  let lost = 0;
  for (let i = 0; i < w.count && lost < c.hurtWorldsLost; i++) {
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
  const target = absorbing ? size * 0.7 : clamp(w.orbitTarget[i], lo, hi);
  // Recién atrapado se imanta: conserva el giro con que venía y se acopla de a poco a la órbita (más lento si es un planeta).
  const join = planet ? c.planetJoinTime : c.bodyJoinTime;
  let k = 1;
  if (w.joinT[i]! < join) { const t = w.joinT[i]! / join; k = t * t * (3 - 2 * t); w.joinT[i] = w.joinT[i]! + DT; }
  const maxDr = (planet ? c.planetInfallSpeed : c.orbitInfallSpeed) * (absorbing ? 1.6 : 1) * (0.25 + 0.75 * k) * DT;
  const r = w.orbitR[i] + clamp((target - w.orbitR[i]) * c.orbitEase, -maxDr, maxDr);
  w.orbitR[i] = r;
  if (absorbing && r <= size * 0.8) { w.state[i] = DEAD; return; }
  const wOrbit = c.orbitSpeedK * Math.pow(c.orbitMin / Math.max(r, 1e-6), 1.5);
  const a = w.orbitAngle[i] + (k >= 1 ? wOrbit : w.orbitW[i] + (wOrbit - w.orbitW[i]) * k) * DT;
  w.orbitAngle[i] = a;
  w.x[i] = s.x + Math.cos(a) * r;
  w.y[i] = s.y + Math.sin(a) * r;
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
  else stepMerge(w);
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
  if (w.phase === PHASE_COLLAPSE || w.phase === PHASE_MERGE) { cinematic(w); w.tick++; return; }
  const hunting = w.phase === PHASE_HUNT;
  if (w.invuln > 0) w.invuln = Math.max(0, w.invuln - DT);
  if (w.slingCd > 0) w.slingCd = Math.max(0, w.slingCd - DT);
  if (w.bhSlow > 0) w.bhSlow = Math.max(0, w.bhSlow - DT);

  // El agujero negro persigue a la estrella, cada vez un poco más rápido.
  const range2 = c.bhRange * c.bhRange;
  // Crece con la raíz de su masa: comer lo hace más peligroso, pero no imposible de esquivar.
  const G = c.bhPull * Math.sqrt(bh.mass);
  if (bh.active) {
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
      s.vx += gx * a;
      s.vy += gy * a;
    }
  }

  // Movimiento con inercia: acelera hacia una velocidad deseada y frena para llegar sin pasarse.
  const acc = hunting ? c.starAccel : c.starAccel / (1 + c.starMassInertia * s.mass);   // siendo agujero negro ya no cargás con la inercia de la estrella
  let desX = 0;
  let desY = 0;
  let maxDv = acc * c.starBrake * DT;
  if (intent.hasTarget && Number.isFinite(intent.targetX) && Number.isFinite(intent.targetY)) {
    const dx = intent.targetX - s.x;
    const dy = intent.targetY - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1e-6) {
      // Siendo agujero negro en la caza no frenás al acercarte: vas a fondo hacia lo que apuntás.
      const speed = hunting ? (dist > 1 ? c.starMaxSpeed : 0) : Math.min(c.starMaxSpeed, Math.sqrt(2 * acc * 0.8 * dist), (c.starMaxSpeed * dist) / c.starSlowRadius);
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
  const holeR = hunting ? playerHoleRadius(w) : 0;
  if (bh.active) {
    const dd = Math.hypot(s.x - bh.x, s.y - bh.y);
    if (hunting) {
      if (dd < holeR + bh.radius) { startMerge(w); w.tick++; return; }
    } else if (dd < bh.radius + starSize(s.mass) * 0.5) {
      w.over = OVER_SWALLOWED;
      w.tick++;
      return;
    }
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
      const tier = st === FREE && w.parent[i] === -1 && isPlanetKind(k) ? planetTier(w.radius[i], s.mass) : -1;
      if (tier >= TIER_HURT && d < size + w.radius[i] && hit < 0 && w.invuln <= 0) hit = i;
      if (w.noCatch[i]! > 0) { w.noCatch[i] = w.noCatch[i]! - DT; continue; }
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
        w.joinT[i] = 0;
        w.orbitingCount++;
        s.mass += massGain(w, i);
        w.captured[w.capturedCount++] = i;
      }
    } else moveOrbiting(w, i, st === ABSORBING, size, hunting && st === ORBITING ? holeR : 0);
  }

  stepEncounters(w);
  if (!hunting) stepStarFlybys(w);
  if (hit >= 0) { if (planetTier(w.radius[hit], s.mass) === TIER_GRAVE) graveHit(w, hit); else hurt(w, hit); }
  if (w.over !== OVER_NONE) { w.tick++; return; }   // se apagó en este paso: no pasa nada más
  if (!hunting) stepComets(w);
  if (!hunting) {
    stepBolts(w, bandHi);
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
  const st = stageFor(s.mass);
  if (st > w.stage) { w.stage = st; w.stageUps++; }
  if (hunting) {
    w.phaseTime += DT;
    if (w.phaseTime >= c.huntTimeLimit) w.over = OVER_ESCAPED;
  } else if ((c.autoCollapse || intent.collapse) && canCollapse(w)) startCollapse(w);   // la última transformación es automática
  w.tick++;
}
