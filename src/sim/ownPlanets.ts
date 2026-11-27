import { ORBITING, type World } from './world';

// Tus planetas en órbita (y los pedazos de los partidos), juntados una vez por paso en un arreglo reutilizado.
let OWN = new Int32Array(64);
export const OWN_LIST = (): Int32Array => OWN;
export function ownPlanets(w: World): number {
  const P = w.planets;
  if (OWN.length < P.length * 2) OWN = new Int32Array(P.length * 2);   // sólo crece al armar el mapa
  let n = 0;
  for (let k = 0; k < P.length * 2; k++) {
    const p = k < P.length ? P[k]! : w.twin[P[k - P.length]!]!;
    if (p >= 0 && w.state[p] === ORBITING) OWN[n++] = p;
  }
  return n;
}
export function ownPlanet(k: number): number { return OWN[k]!; }
