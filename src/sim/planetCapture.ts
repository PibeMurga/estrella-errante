import { boltReach, returnGathered } from './launch';
import { loseMass } from './integrity';
import { STAGES, stageFor } from './stages';
import { breakPlanet, spawnDebris } from './tidal';
import { BOLT, DEAD, FREE, ORBITING, OVER_SHATTERED, KIND_GAS, massGain, noteBreak, KIND_ROCKY, MAX_IMPACTS, OVER_DIMMED, PROJECTILE, RETURNING, starSize, type World } from './world';

// Escalones de los planetas según su tamaño comparado con el de tu estrella (E):
// hasta la mitad entran solos; hasta E hay que partirlos; hasta 1,5·E dañan; más grandes, golpe grave.
export const TIER_CAPTURE = 0, TIER_BREAK = 1, TIER_HURT = 2, TIER_GRAVE = 3;

export const isPlanetKind = (k: number): boolean => k >= KIND_ROCKY && k <= KIND_GAS;

// ¿Entra solo a tu órbita? Los chicos, y también los medianos que ya están partidos (el planeta que partís es tuyo).
export function joinsOrbit(w: World, i: number): boolean {
  const t = planetTier(w.radius[i], w.star.mass);
  return t === TIER_CAPTURE || (t === TIER_BREAK && w.broken[i]! > 0);
}

export function planetTier(radius: number, starMass: number): number {
  const E = starSize(starMass);
  if (radius <= 0.5 * E) return TIER_CAPTURE;
  if (radius <= E) return TIER_BREAK;
  if (radius <= 1.5 * E) return TIER_HURT;
  return TIER_GRAVE;
}

// Tu mundo se hace pedazos: explosión, escombros por todos lados y se termina la partida.
export function shatter(w: World, dx: number, dy: number): void {
  const s = w.star, d = Math.hypot(dx, dy) || 1, R = starSize(s.mass);
  w.breakFxCount++; w.breakFxX = s.x; w.breakFxY = s.y; w.breakFxR = R * 1.4; w.breakFxKind = KIND_ROCKY; w.breakFxAx = -dy / d; w.breakFxAy = dx / d;
  spawnDebris(w, s.x, s.y, s.vx, s.vy, R, -dy / d, dx / d, Math.min(30, 8 + Math.round(R * 3)), 0.3, 1.2);
  for (let i = 0; i < w.count; i++) if (w.state[i] === ORBITING) { w.state[i] = FREE; w.noCatch[i] = 99; }
  w.orbitingCount = 0;
  w.over = OVER_SHATTERED;
}

// Golpe grave: perdés una etapa entera de masa y rebotás. Sin nada en órbita, la estrella se apaga.
export function graveHit(w: World, p: number): void {
  const c = w.config, s = w.star;
  returnGathered(w);
  // Desproporcionado: contra algo de más de 2,5 veces tu tamaño, tu mundo se hace pedazos.
  if (w.radius[p] > starSize(s.mass) * c.lethalRatio) { shatter(w, w.x[p] - s.x, w.y[p] - s.y); return; }
  if (w.orbitingCount === 0) { w.over = OVER_DIMMED; return; }
  w.graveHits++;
  w.invuln = c.hurtInvuln;
  const nx = s.x - w.x[p], ny = s.y - w.y[p];
  const nd = Math.hypot(nx, ny) || 1;
  s.vx = (nx / nd) * c.hurtBounce * 1.4; s.vy = (ny / nd) * c.hurtBounce * 1.4;
  const st = stageFor(s.mass);
  const width = st > 0 ? STAGES[st]!.mass - STAGES[st - 1]!.mass : s.mass * 0.5;
  loseMass(w, width);
  w.stage = stageFor(s.mass);
}

// Golpe a un planeta: sólo los que se pueden partir acumulan daño. Al llegar a su aguante se parte:
// los rocosos y helados, en dos pedazos (el dibujo de planeta partido); los gaseosos pierden su envoltura.
// Partido, entra solo a tu órbita. Devuelve true si lo partió.
// Golpes que aguanta un planeta antes de partirse: los que dañan aguantan bastante más; los graves, infinito (-1).
export function planetHp(w: World, p: number): number {
  const c = w.config, t = planetTier(w.radius[p], w.star.mass);
  if (t === TIER_GRAVE || t === TIER_CAPTURE) return -1;
  return Math.ceil(c.planetHpPerRadius * (t === TIER_HURT ? c.hurtHpMul : 1) * w.radius[p]);
}

export function hitPlanet(w: World, p: number, dmg: number): boolean {
  const c = w.config;
  // Los tuyos (en órbita) también se dañan con tus disparos: aguantan según su radio, sea cual sea su escalón.
  const own = w.state[p] === ORBITING;
  const hp = own ? Math.ceil(c.planetHpPerRadius * w.radius[p]) : planetHp(w, p);
  if ((w.state[p] !== FREE && !own) || w.broken[p]! > 0 || hp < 0) return false;   // ya partido: no se vuelve a partir
  w.planetDmg[p] = w.planetDmg[p]! + dmg;
  if (w.planetDmg[p]! < hp) return false;
  // Partiste uno tuyo: sus pedazos siguen girando a tu alrededor (no perdiste nada; la resistencia no baja).
  const R = w.radius[p];
  let ax = w.x[p] - w.star.x, ay = w.y[p] - w.star.y;
  const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
  if (w.kind[p] === KIND_GAS) noteBreak(w, p, ax, ay);
  if (w.kind[p] === KIND_GAS) spawnDebris(w, w.x[p], w.y[p], w.vx[p], w.vy[p], R, ax, ay, c.tidalDebris);
  else breakPlanet(w, p, ax, ay, false);
  // Además de los escombros, fragmentos rocosos más grandes que un asteroide, que se pueden sumar a tu órbita.
  spawnDebris(w, w.x[p], w.y[p], w.vx[p], w.vy[p], R * 0.7, -ay, ax, c.breakFragments, 1.15, c.maxCaptureSize);
  // Un rocoso o helado sigue siendo el mismo planeta, colapsado y en dos mitades (breakPlanet ya le deja casi todo su tamaño).
  // Un gaseoso conserva su tamaño y su aspecto (no tiene corteza que partir): sólo queda marcado como partido, y es tuyo.
  if (w.kind[p] === KIND_GAS) { w.broken[p] = 1e-6; w.breakAx[p] = ax; w.breakAy[p] = ay; }
  w.planetDmg[p] = 0;
  w.planetBreaks++;
  return true;
}

// Un asteroide lanzado choca contra un planeta como una piedra pesada, no como una pelota: a veces se deshace en esquirlas
// que quedan flotando junto al golpe; si no, pierde casi toda la velocidad contra la superficie, se desvía rozándola y
// queda suelto. En los dos casos se pierde (y la estrella, su masa, si venía de la honda: la del bólido ya se descontó).
function crashRock(w: World, i: number, p: number, dx: number, dy: number, sling: boolean): void {
  const c = w.config, r = w.rng;
  if (sling) w.star.mass = Math.max(c.starStartMass, w.star.mass - massGain(w, i));
  const d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  // Uno de tus planetas se mueve con tu estrella.
  const pvx = w.state[p] === ORBITING ? w.star.vx : w.vx[p], pvy = w.state[p] === ORBITING ? w.star.vy : w.vy[p];
  const rvx = w.vx[i] - pvx, rvy = w.vy[i] - pvy;
  if (r.next() < c.rockShatterChance) {
    w.state[i] = DEAD;
    spawnDebris(w, w.x[i], w.y[i], pvx + nx * 1.5, pvy + ny * 1.5, w.radius[i] * 1.5, nx, ny, 3, 0.12, Math.max(0.15, w.radius[i] * 0.45));
    return;
  }
  // Rebote pesado: casi sin rebote en la normal y con mucho roce en la tangente.
  const vn = rvx * nx + rvy * ny, tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
  const outN = vn < 0 ? -vn * c.rockRestitution : vn, outT = vt * c.rockFriction;
  w.vx[i] = pvx + nx * outN + tx * outT; w.vy[i] = pvy + ny * outN + ty * outT;
  // Que quede apoyado fuera del planeta, no adentro.
  const R = w.radius[p] + w.radius[i] + 0.05;
  w.x[i] = w.x[p] + nx * R; w.y[i] = w.y[p] + ny * R;
  w.state[i] = FREE;
  w.noCatch[i] = c.boltNoCatch;
}

// Honda y bólido contra planetas sueltos: la honda rebota (vuelve) y el bólido queda suelto donde pegó.
export function stepPlanetHits(w: World): void {
  const c = w.config, P = w.planets;
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st !== PROJECTILE && st !== BOLT) continue;
    for (let k = 0; k < P.length * 2; k++) {
      const p = k < P.length ? P[k]! : w.twin[P[k - P.length]!]!;   // también el segundo pedazo de un partido
      if (p < 0 || (w.state[p] !== FREE && w.state[p] !== ORBITING)) continue;   // también los tuyos: son obstáculo
      const r = w.radius[p] + w.radius[i] + (st === BOLT ? boltReach(w) : 0);   // un bólido grande pega en un área mayor
      const dx = w.x[i] - w.x[p], dy = w.y[i] - w.y[p];
      if (dx * dx + dy * dy >= r * r) continue;
      // El golpe queda marcado en el terreno: el render dibuja una pequeña explosión ahí.
      const slot = (w.impactCount % MAX_IMPACTS) * 4;
      w.impacts[slot] = p; w.impacts[slot + 1] = Math.atan2(dy, dx); w.impacts[slot + 2] = st === BOLT ? 0.55 + 0.12 * Math.sqrt(w.lastBoltSize) : 0.45;   // el golpe crece con el bólido w.impactCount++;
      crashRock(w, i, p, dx, dy, st === PROJECTILE);
      hitPlanet(w, p, st === BOLT ? c.boltPlanetDmg * (w.ability >= 3 ? 1.5 : 1) : 1);   // un bólido entero parte uno mediano
      break;
    }
  }
}
