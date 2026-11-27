// La masa del juego, en masas solares (M☉), con valores reales para cada etapa: una enana roja ronda los 0,1-0,5 M☉,
// una amarilla 1 M☉, una gigante azul 10-20, una supergigante 25 y una hipergigante 100 o más. Tramos lineales entre
// los umbrales de las etapas; más allá, crece en proporción.
const AT = [0, 40, 90, 145, 205, 280];
const SUN = [0.08, 0.8, 1.4, 10, 25, 100];

export function solarMasses(mass: number): number {
  const m = Math.max(0, mass);
  for (let k = 1; k < AT.length; k++) {
    if (m <= AT[k]!) { const t = (m - AT[k - 1]!) / (AT[k]! - AT[k - 1]!); return SUN[k - 1]! + (SUN[k]! - SUN[k - 1]!) * t; }
  }
  return SUN[SUN.length - 1]! * (m / AT[AT.length - 1]!);
}

// Con decimales cuando es chica (0,45), sin decimales cuando es grande (120). Coma decimal.
export function formatSolar(mass: number): string {
  const v = solarMasses(mass);
  const txt = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
  return `${txt.replace('.', ',')} M☉`;
}
