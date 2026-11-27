// Geometría de un planeta partido en dos pedazos (casquetes de esfera). La usan la simulación (cada pedazo es un
// cuerpo con su masa y su centro de masa) y el render (dibuja cada pedazo con su cara de corte).

// Semilla del corte de un planeta, según su índice (la misma para sus dos pedazos).
export const halfSeed = (i: number): number => (i * 0.6180339) % 1;

// Altura del corte sobre el eje (−0,45 a 0,45 radios): pedazos de distinto tamaño. Igual que en el shader.
export function cutOffset(seed: number): number {
  const v = seed * 97 * 0.371;
  return (v - Math.floor(v) - 0.5) * 0.9;
}
// Fracción del volumen del planeta que queda del lado alto de un corte a altura h.
export function capVolume(h: number): number {
  const H = 1 - h;
  return (H * H * (3 - H)) / 4;
}
// Distancia del centro de masa de ese pedazo al centro de la esfera.
export function capCentroid(h: number): number {
  return (3 * (1 + h) * (1 + h)) / (4 * (2 + h));
}
