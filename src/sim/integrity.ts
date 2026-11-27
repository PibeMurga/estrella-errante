import { isPlanetKind } from './planetCapture';
import { FREE, ORBITING, type World } from './world';

// Resistencia de tu cuerpo (0 a 1): cada impacto la baja rápido y se recarga despacio. Si llega a cero, te fracturás:
// perdés una buena parte de la masa y de lo que tenés en órbita (sale despedido), y la barra vuelve a cargar desde abajo.
export function damageBody(w: World, amount: number): void {
  w.integrity -= amount;
  if (w.integrity > 0) return;
  const c = w.config, s = w.star;
  w.fractures++;
  w.integrity = c.integrityAfterFracture;
  s.mass = Math.max(c.starStartMass, s.mass * (1 - c.fractureMassLoss));
  let lose = Math.ceil(w.orbitingCount * c.fractureOrbitLoss);
  for (let j = 0; j < w.count && lose > 0; j++) {
    if (w.state[j] !== ORBITING || isPlanetKind(w.kind[j]!)) continue;
    const a = w.orbitAngle[j];
    w.state[j] = FREE; w.orbitingCount--;
    w.vx[j] = s.vx + Math.cos(a) * c.lostSpeed; w.vy[j] = s.vy + Math.sin(a) * c.lostSpeed;
    w.noCatch[j] = c.noCatchTime;
    lose--;
  }
}

// Se recarga despacio.
export function stepIntegrity(w: World, dt: number): void {
  if (w.integrity < 1) w.integrity = Math.min(1, w.integrity + w.config.integrityRegen * dt);
}
