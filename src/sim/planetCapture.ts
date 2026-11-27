import { returnGathered } from './launch';
import { STAGES, stageFor } from './stages';
import { breakPlanet, spawnDebris } from './tidal';
import { BOLT, FREE, KIND_GAS, KIND_ROCKY, OVER_DIMMED, PROJECTILE, RETURNING, starSize, type World } from './world';

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

// Golpe grave: perdés una etapa entera de masa y rebotás. Sin nada en órbita, la estrella se apaga.
export function graveHit(w: World, p: number): void {
  const c = w.config, s = w.star;
  returnGathered(w);
  if (w.orbitingCount === 0) { w.over = OVER_DIMMED; return; }
  w.graveHits++;
  w.invuln = c.hurtInvuln;
  const nx = s.x - w.x[p], ny = s.y - w.y[p];
  const nd = Math.hypot(nx, ny) || 1;
  s.vx = (nx / nd) * c.hurtBounce * 1.4; s.vy = (ny / nd) * c.hurtBounce * 1.4;
  const st = stageFor(s.mass);
  const width = st > 0 ? STAGES[st]!.mass - STAGES[st - 1]!.mass : s.mass * 0.5;
  s.mass = Math.max(c.starStartMass, s.mass - width);
  w.stage = stageFor(s.mass);
}

// Golpe a un planeta: sólo los que se pueden partir acumulan daño. Al llegar a su aguante se parte:
// los rocosos y helados, en dos pedazos (el dibujo de planeta partido); los gaseosos pierden su envoltura.
// Partido, entra solo a tu órbita. Devuelve true si lo partió.
export function hitPlanet(w: World, p: number, dmg: number): boolean {
  const c = w.config;
  if (w.state[p] !== FREE || w.broken[p]! > 0 || planetTier(w.radius[p], w.star.mass) !== TIER_BREAK) return false;   // ya partido: no se vuelve a partir
  w.planetDmg[p] = w.planetDmg[p]! + dmg;
  if (w.planetDmg[p]! < Math.ceil(c.planetHpPerRadius * w.radius[p])) return false;
  const R = w.radius[p];
  let ax = w.x[p] - w.star.x, ay = w.y[p] - w.star.y;
  const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
  if (w.kind[p] === KIND_GAS) spawnDebris(w, w.x[p], w.y[p], w.vx[p], w.vy[p], R, ax, ay, c.tidalDebris);
  else breakPlanet(w, p, ax, ay, false);
  // Además de los escombros, fragmentos rocosos más grandes que un asteroide, que se pueden sumar a tu órbita.
  spawnDebris(w, w.x[p], w.y[p], w.vx[p], w.vy[p], R * 0.7, -ay, ax, c.breakFragments, 1.15, c.maxCaptureSize);
  // Un rocoso o helado sigue siendo el mismo planeta, colapsado y en dos mitades (breakPlanet ya le deja casi todo su tamaño).
  // Un gaseoso no tiene corteza que partir: pierde su envoltura y se achica.
  if (w.kind[p] === KIND_GAS) { w.radius[p] = R * c.planetBreakKeep; w.mass[p] = w.radius[p] ** 3; }
  w.planetDmg[p] = 0;
  w.planetBreaks++;
  return true;
}

// Honda y bólido contra planetas sueltos: la honda rebota (vuelve) y el bólido queda suelto donde pegó.
export function stepPlanetHits(w: World): void {
  const c = w.config, P = w.planets;
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st !== PROJECTILE && st !== BOLT) continue;
    for (let k = 0; k < P.length; k++) {
      const p = P[k]!;
      if (w.state[p] !== FREE) continue;
      const r = w.radius[p] + w.radius[i];
      const dx = w.x[i] - w.x[p], dy = w.y[i] - w.y[p];
      if (dx * dx + dy * dy >= r * r) continue;
      if (st === PROJECTILE) w.state[i] = RETURNING;
      else { w.state[i] = FREE; w.vx[i] *= 0.2; w.vy[i] *= 0.2; w.noCatch[i] = c.boltNoCatch; }
      hitPlanet(w, p, st === BOLT ? c.boltPlanetDmg * (w.ability >= 3 ? 1.5 : 1) : 1);   // un bólido entero parte uno mediano
      break;
    }
  }
}
