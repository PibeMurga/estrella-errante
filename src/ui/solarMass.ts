// La masa del juego en unidades reales. Siendo planeta, en masas de Júpiter (M♃): un gaseoso chico ronda 0,3 M♃, un
// gigante gaseoso unas pocas, la enana marrón empieza en 13 M♃ y la fusión se enciende en unas 80 M♃ (0,08 M☉).
// Desde la ignición, en masas solares (M☉): enana amarilla 0,8-1, estrella blanca 1,4, gigante azul 10-20,
// supergigante 25 y hipergigante 100 o más. Tramos lineales entre los umbrales de las etapas; más allá, crece en proporción.
const IGN = 30;
const AT_P = [0, 8, 18, 30], JUP = [0.3, 4, 13, 80];
const AT = [30, 70, 120, 175, 235, 310];
const SUN = [0.08, 0.8, 1.4, 10, 25, 100];

const lerp = (at: readonly number[], val: readonly number[], m: number): number => {
  for (let k = 1; k < at.length; k++) {
    if (m <= at[k]!) { const t = (m - at[k - 1]!) / (at[k]! - at[k - 1]!); return val[k - 1]! + (val[k]! - val[k - 1]!) * t; }
  }
  return val[val.length - 1]! * (m / at[at.length - 1]!);
};

// Masas de Júpiter (para la etapa de planeta).
export function jupiterMasses(mass: number): number { return lerp(AT_P, JUP, Math.max(0, mass)); }

// Masas solares (desde la ignición; antes, la equivalencia de las masas de Júpiter).
export function solarMasses(mass: number): number {
  const m = Math.max(0, mass);
  return m < IGN ? jupiterMasses(m) / 1000 : lerp(AT, SUN, m);
}

// La masa de otro cuerpo (el rival) en la misma unidad que la tuya: siendo planeta, en masas de Júpiter (1 M☉ = 1.000 M♃).
export function formatLike(mass: number, yourMass: number): string {
  if (yourMass >= IGN) return formatSolar(mass);
  const v = solarMasses(mass) * 1000;
  return `${(v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('es-AR')).replace('.', ',')} M♃`;
}

// Con decimales cuando es chica, sin decimales cuando es grande. Coma decimal y su unidad.
export function formatSolar(mass: number): string {
  const planet = mass < IGN;
  const v = planet ? jupiterMasses(mass) : solarMasses(mass);
  const txt = planet ? (v < 10 ? v.toFixed(1) : Math.round(v).toString()) : v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
  return `${txt.replace('.', ',')} ${planet ? 'M♃' : 'M☉'}`;
}
