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
  const x = S / 2, y = S / 2, r = size / 2;
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
      // Núcleo chico y helado, con la cola que se abre hacia atrás (lejos de la luz).
      const g = c.createLinearGradient(x, y, x + 18, y + 12);
      g.addColorStop(0, 'rgba(190,230,255,0.75)'); g.addColorStop(1, 'rgba(190,230,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 1, y - r * 0.8); c.lineTo(x + 20, y + 8); c.lineTo(x + 14, y + 15); c.lineTo(x - r * 0.6, y + r * 0.9); c.closePath(); c.fill();
      const h = c.createRadialGradient(x, y, 0, x, y, r * 2.2); h.addColorStop(0, 'rgba(220,245,255,0.9)'); h.addColorStop(1, 'rgba(220,245,255,0)');
      c.fillStyle = h; c.beginPath(); c.arc(x, y, r * 2.2, 0, Math.PI * 2); c.fill();
      sphere(c, x, y, r * 0.7, '#ffffff', '#cfe4f0', '#7d95a6');
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
      // Disco de acreción inclinado (atrás y adelante), el anillo de fotones y la sombra negra.
      const ring = (front: boolean): void => {
        const g = c.createLinearGradient(x - r * 1.9, y, x + r * 1.9, y);
        g.addColorStop(0, 'rgba(255,120,40,0.25)'); g.addColorStop(0.3, 'rgba(255,190,110,0.95)'); g.addColorStop(0.7, 'rgba(255,150,70,0.8)'); g.addColorStop(1, 'rgba(255,100,30,0.2)');
        c.strokeStyle = g; c.lineWidth = 2.4;
        c.beginPath(); c.ellipse(x, y, r * 1.85, r * 0.42, -0.2, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); c.stroke();
      };
      ring(false);
      const h = c.createRadialGradient(x, y, r * 0.55, x, y, r * 0.95); h.addColorStop(0, 'rgba(255,170,90,0)'); h.addColorStop(0.8, 'rgba(255,170,90,0.85)'); h.addColorStop(1, 'rgba(255,170,90,0)');
      c.fillStyle = h; c.beginPath(); c.arc(x, y, r * 0.95, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, r * 0.62, 0, Math.PI * 2); c.fill();
      ring(true);
      break;
    }
  }
  return cv;
}
