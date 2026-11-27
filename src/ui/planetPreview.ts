// Planetita de muestra para elegir el tipo de gaseoso: bandas que fluyen y giran, una tormenta, luz de costado con su
// lado de noche y un borde de atmósfera. Dibujado en un lienzo 2D (sin otra escena 3D), con los colores del tipo.
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function drawPlanetPreview(canvas: HTMLCanvasElement, colors: readonly [string, string, string], t: number, seed: number): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width, R = W / 2 - 2, img = g.createImageData(W, W), d = img.data;
  const A = hex(colors[0]), B = hex(colors[1]), C = hex(colors[2]);
  const lx = -0.55, ly = -0.45, lz = 0.7;   // luz desde arriba a la izquierda
  for (let py = 0; py < W; py++) {
    for (let px = 0; px < W; px++) {
      const x = (px - W / 2) / R, y = (py - W / 2) / R, r2 = x * x + y * y, o = (py * W + px) * 4;
      if (r2 > 1) { d[o + 3] = 0; continue; }
      const z = Math.sqrt(1 - r2);
      const lon = Math.atan2(x, z) + t * 0.35, lat = y;
      // Bandas con remolinos: una suma de senos que se mueve con la longitud.
      const swirl = 0.35 * Math.sin(lon * 3 + lat * 9 + seed) + 0.2 * Math.sin(lon * 7 - lat * 13 + seed * 2);
      const band = Math.sin(lat * 13 + swirl * 2.2 + seed);
      const k = 0.5 + 0.5 * band;
      let rr = A[0] + (B[0] - A[0]) * k, gg = A[1] + (B[1] - A[1]) * k, bb = A[2] + (B[2] - A[2]) * k;
      const sx = lon % (Math.PI * 2) - 1, storm = Math.exp(-((sx * 1.6) ** 2 + ((lat + 0.3) * 6) ** 2));
      rr += (C[0] - rr) * storm * 0.7; gg += (C[1] - gg) * storm * 0.7; bb += (C[2] - bb) * storm * 0.7;
      const ndl = Math.max(0, x * lx + y * ly + z * lz), lit = 0.06 + 1.05 * Math.pow(ndl, 0.8);
      const rim = Math.pow(1 - z, 3) * 0.6 * (0.3 + ndl);
      d[o] = Math.min(255, rr * lit + A[0] * rim); d[o + 1] = Math.min(255, gg * lit + A[1] * rim); d[o + 2] = Math.min(255, bb * lit + A[2] * rim);
      d[o + 3] = r2 > 0.97 ? 255 * (1 - (r2 - 0.97) / 0.03) : 255;
    }
  }
  g.putImageData(img, 0, 0);
}

export const PREVIEW_COLORS: readonly (readonly [string, string, string])[] = [
  ['#c39a6b', '#eadbc0', '#8f5f3e'],
  ['#d6c296', '#f2e8cc', '#b0925c'],
  ['#3f68b4', '#86aee4', '#26407c'],
];
