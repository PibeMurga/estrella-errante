import { isPlanetKind } from './planetCapture';
import { ORBITING, type World } from './world';

// Habilidades por cantidad de planetas en tu órbita, sobre el total de planetas de la pantalla.
// Se pierden si bajás del umbral (por ejemplo, si un cometa te roba un planeta).
export const ABILITY_NAMES: readonly string[] = ['', 'GRAVEDAD AMPLIADA', 'ESCUDO DE ÓRBITA', 'BÓLIDO MAYOR'];

export function planetsInOrbit(w: World): number {
  let n = 0;
  // Un planeta partido cuenta una vez: alcanza con tener uno de sus dos pedazos.
  for (let k = 0; k < w.planets.length; k++) {
    const p = w.planets[k]!, t = w.twin[p]!;
    if (isPlanetKind(w.kind[p]!) && (w.state[p] === ORBITING || (t >= 0 && w.halfSide[p] !== 0 && w.state[t] === ORBITING))) n++;
  }
  return n;
}

export function abilityLevel(w: World): number {
  const total = w.planets.length;
  if (total === 0) return 0;
  const f = planetsInOrbit(w) / total, c = w.config;
  return f >= c.ability3 - 1e-9 ? 3 : f >= c.ability2 - 1e-9 ? 2 : f >= c.ability1 - 1e-9 ? 1 : 0;
}

export function stepAbilities(w: World): void {
  w.planetsHeld = planetsInOrbit(w);
  const lvl = abilityLevel(w);
  if (lvl > w.ability) w.abilityUps++; else if (lvl < w.ability) w.abilityDowns++;
  w.ability = lvl;
}
