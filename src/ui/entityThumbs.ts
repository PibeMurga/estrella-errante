// Miniaturas de lo que hay en el espacio, dibujadas a mano en un lienzo chico (sin imágenes externas): esfera con luz
// de costado y sombra, y el detalle de cada cosa (cráteres, casquetes, bandas, brillo, disco). Cada una se dibuja una
// sola vez, al armar la intro.

export type ThumbKind = 'asteroid' | 'comet' | 'moon' | 'rocky' | 'ice' | 'gas' | 'brown' | 'star' | 'hole';

const S = 44;   // lado del lienzo (en píxeles de CSS); se dibuja al doble para que se vea nítido

// Ruido simple y repetible (para que cada miniatura salga igual siempre).
let seed = 7;
const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function sphere(c: CanvasRenderingContext2D, x: number, y: number, r: number, lit: string, mid: string, dark: string): void {
  const g = c.createRadialGradient(x - r * 0.45, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lit); g.addColorStop(0.55, mid); g.addColorStop(1, dark);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
// Sombra del lado de la noche (la luz viene de arriba a la izquierda).
function night(c: CanvasRenderingContext2D, x: number, y: number, r: number, k = 0.75): void {
  const g = c.createLinearGradient(x - r * 0.6, y - r * 0.6, x + r, y + r);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function craters(c: CanvasRenderingContext2D, x: number, y: number, r: number, n: number): void {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.85, cr = r * (0.08 + rnd() * 0.16);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.arc(cx + cr * 0.15, cy + cr * 0.15, cr, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = Math.max(0.6, cr * 0.25); c.beginPath(); c.arc(cx - cr * 0.1, cy - cr * 0.1, cr, Math.PI * 0.9, Math.PI * 1.7); c.stroke();
  }
  c.restore();
}
function bands(c: CanvasRenderingContext2D, x: number, y: number, r: number, cols: string[]): void {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  let yy = y - r;
  let i = 0;
  while (yy < y + r) {
    const h = r * (0.12 + rnd() * 0.22);
    c.fillStyle = cols[i++ % cols.length]!; c.globalAlpha = 0.55;
    c.beginPath(); c.moveTo(x - r, yy);
    for (let t = 0; t <= 8; t++) c.lineTo(x - r + (t / 8) * r * 2, yy + Math.sin(t * 1.7 + i) * r * 0.03);
    c.lineTo(x + r, yy + h); c.lineTo(x - r, yy + h); c.closePath(); c.fill();
    yy += h;
  }
  c.globalAlpha = 1; c.restore();
}

export function drawThumb(kind: ThumbKind, size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S * 2; cv.style.width = cv.style.height = `${S}px`;
  const c = cv.getContext('2d')!;
  c.scale(2, 2);
  let x = S / 2, y = S / 2;
  const r = size / 2;
  seed = 7 + kind.length * 131;
  switch (kind) {
    case 'asteroid': {
      // Roca irregular: un contorno con bultos, luz de costado y un par de hoyos.
      c.beginPath();
      for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2, d = r * (0.72 + rnd() * 0.4); c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * d * 1.15, y + Math.sin(a) * d * 0.85); }
      c.closePath();
      const g = c.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#b4aca2'); g.addColorStop(0.5, '#6e675f'); g.addColorStop(1, '#221f1c');
      c.fillStyle = g; c.fill();
      craters(c, x, y, r * 0.8, 3);
      break;
    }
    case 'comet': {
      x -= 13; y -= 8;   // el núcleo arriba a la izquierda: así entra la cola
      // Como los cometas fotografiados: cola de polvo ancha y curva (blanco amarillento) y cola de iones recta y fina
      // (azulada), las dos hacia el lado contrario a la luz; una coma difusa y el núcleo, un punto.
      const ax = 1, ay = 0.55, L = Math.hypot(ax, ay), ux = ax / L, uy = ay / L;   // hacia abajo a la derecha
      const len = 34;
      c.save();
      const dust = c.createLinearGradient(x, y, x + ux * len, y + uy * len);
      dust.addColorStop(0, 'rgba(255,244,215,0.75)'); dust.addColorStop(0.5, 'rgba(255,236,200,0.25)'); dust.addColorStop(1, 'rgba(255,236,200,0)');
      c.fillStyle = dust; c.beginPath();
      c.moveTo(x - uy * 1.5, y + ux * 1.5);
      c.quadraticCurveTo(x + ux * len * 0.5 - uy * 2, y + uy * len * 0.5 + ux * 2 + 4, x + ux * len - uy * 1 , y + uy * len + 9);
      c.lineTo(x + ux * len + uy * 7, y + uy * len - ux * 7 + 5);
      c.quadraticCurveTo(x + ux * len * 0.5 + uy * 3, y + uy * len * 0.5 - ux * 3, x + uy * 1.5, y - ux * 1.5);
      c.closePath(); c.fill();
      const ion = c.createLinearGradient(x, y, x + ux * (len + 6), y + uy * (len + 6));
      ion.addColorStop(0, 'rgba(150,200,255,0.85)'); ion.addColorStop(1, 'rgba(150,200,255,0)');
      c.strokeStyle = ion; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + ux * (len + 6) - uy * 4, y + uy * (len + 6) + ux * 4 - 3); c.stroke();
      c.restore();
      const coma = c.createRadialGradient(x, y, 0, x, y, 5.5); coma.addColorStop(0, 'rgba(235,250,255,1)'); coma.addColorStop(0.35, 'rgba(190,235,230,0.55)'); coma.addColorStop(1, 'rgba(160,220,210,0)');
      c.fillStyle = coma; c.beginPath(); c.arc(x, y, 5.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 1.1, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'moon': sphere(c, x, y, r, '#e4dfd6', '#a8a299', '#4a4641'); craters(c, x, y, r, 6); night(c, x, y, r); break;
    case 'rocky': sphere(c, x, y, r, '#d39a72', '#9a6044', '#3a2218'); craters(c, x, y, r, 5); night(c, x, y, r); break;
    case 'ice': {
      sphere(c, x, y, r, '#f2fbff', '#a9cfe2', '#3d6378');
      c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
      c.strokeStyle = 'rgba(70,110,140,0.45)'; c.lineWidth = 0.8;
      for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(x - r + rnd() * r, y - r + rnd() * 2 * r); c.lineTo(x + rnd() * r, y - r + rnd() * 2 * r); c.stroke(); }   // grietas
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(x, y - r * 0.92, r * 0.55, r * 0.16, 0, 0, Math.PI * 2); c.fill();   // casquete
      c.restore(); night(c, x, y, r);
      break;
    }
    case 'gas': sphere(c, x, y, r, '#f2dcb4', '#c79a68', '#4e3220'); bands(c, x, y, r, ['#e9d2aa', '#a8714a', '#d9b383', '#8f5f3e']); night(c, x, y, r, 0.8); break;
    case 'brown': {
      sphere(c, x, y, r, '#8a4048', '#5a2228', '#1a0a0c'); bands(c, x, y, r, ['#7a3038', '#4a1a20', '#9a4448']);
      const h = c.createRadialGradient(x, y, r * 0.8, x, y, r * 1.35); h.addColorStop(0, 'rgba(160,40,40,0.35)'); h.addColorStop(1, 'rgba(160,40,40,0)');
      c.fillStyle = h; c.beginPath(); c.arc(x, y, r * 1.35, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'star': {
      const h = c.createRadialGradient(x, y, r * 0.6, x, y, r * 1.9); h.addColorStop(0, 'rgba(255,200,110,0.6)'); h.addColorStop(1, 'rgba(255,160,60,0)');
      c.fillStyle = h; c.beginPath(); c.arc(x, y, r * 1.9, 0, Math.PI * 2); c.fill();
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.6, '#ffd27a'); g.addColorStop(1, '#ff9a3a');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();   // granulado de la superficie
      for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(255,${150 + Math.floor(rnd() * 80)},60,0.18)`; c.beginPath(); c.arc(x - r + rnd() * 2 * r, y - r + rnd() * 2 * r, 0.8 + rnd() * 1.4, 0, Math.PI * 2); c.fill(); }
      c.restore();
      break;
    }
    case 'hole': {
      // Como la imagen del Event Horizon Telescope y las simulaciones: una sombra negra grande, un anillo de luz fino y
      // brillante a su alrededor (más fuerte de un lado, por el giro), y el disco de gas visto casi de canto que cruza por
      // delante; la parte de atrás del disco se ve curvada por encima de la sombra (la luz se dobla).
      const R = r * 1.05;
      const glow = c.createRadialGradient(x, y, R * 0.9, x, y, R * 1.9); glow.addColorStop(0, 'rgba(255,150,60,0.35)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(x, y, R * 1.9, 0, Math.PI * 2); c.fill();
      // Anillo de luz doblada: grueso arriba (el disco de atrás) y fino abajo; más brillante a la izquierda.
      const ringG = c.createLinearGradient(x - R, y, x + R, y); ringG.addColorStop(0, '#fff1c8'); ringG.addColorStop(0.5, '#ffb055'); ringG.addColorStop(1, '#b8501e');
      c.strokeStyle = ringG;
      c.lineWidth = 3.2; c.beginPath(); c.arc(x, y, R * 1.02, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.lineWidth = 1.3; c.beginPath(); c.arc(x, y, R * 1.0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, R * 0.93, 0, Math.PI * 2); c.fill();
      // Disco por delante, casi de canto.
      const disk = c.createLinearGradient(x - R * 2.1, y, x + R * 2.1, y);
      disk.addColorStop(0, 'rgba(255,170,90,0)'); disk.addColorStop(0.2, 'rgba(255,236,190,0.95)'); disk.addColorStop(0.5, 'rgba(255,170,80,0.9)');
      disk.addColorStop(0.85, 'rgba(190,80,30,0.6)'); disk.addColorStop(1, 'rgba(160,60,20,0)');
      c.fillStyle = disk; c.beginPath(); c.ellipse(x, y + R * 0.05, R * 2.1, R * 0.17, 0, 0, Math.PI * 2); c.fill();
      break;
    }
  }
  return cv;
}
