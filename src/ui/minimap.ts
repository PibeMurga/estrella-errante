import { isPlanetKind, planetTier, TIER_BREAK, TIER_CAPTURE } from '../sim/planetCapture';
import { DEAD, KIND_ASTEROID, MAX_COMETS, ORBITING, starSize, type World } from '../sim/world';

// Mapa chico, abajo a la derecha: lo que tenés cerca, minimalista y con el fósforo del visor. Vos al centro.
// Planetas a escala con el color de su marca: amarillo se puede partir, rojo daña, verde son tuyos, gris entran solos.
// La densidad de asteroides como una sombra suave, cometas con su color y el agujero negro en rojo con su zona de marea (o una flecha si está lejos).
const RANGE = 160;   // unidades del mundo del centro al borde

export interface Minimap { draw(w: World): void }

export function createMinimap(parent: HTMLElement): Minimap {
  const cv = document.createElement('canvas');
  cv.className = 'minimap';
  const SIZE = 170, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = SIZE * dpr; cv.height = SIZE * dpr;
  parent.appendChild(cv);
  const g = cv.getContext('2d')!;
  let acc = 0;
  const C = SIZE / 2, k = C / RANGE;
  const GRID = 16, CELL = (RANGE * 2) / GRID, dens = new Uint16Array(GRID * GRID);
  // Mancha suave para la densidad y fondo que se desvanece: se arman una sola vez.
  const blob = document.createElement('canvas'); blob.width = blob.height = 32;
  { const b = blob.getContext('2d')!, gr = b.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(170,150,130,1)'); gr.addColorStop(1, 'rgba(170,150,130,0)'); b.fillStyle = gr; b.fillRect(0, 0, 32, 32); }
  const bg = g.createRadialGradient(C, C, C * 0.55, C, C, C);
  bg.addColorStop(0, 'rgba(2,10,8,0.6)'); bg.addColorStop(1, 'rgba(2,10,8,0)');

  return {
    draw(w) {
      if (++acc % 4 !== 0) return;   // unos 15 cuadros por segundo alcanzan
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, SIZE, SIZE);
      g.save();
      g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.clip();
      // Sin borde: se desvanece hacia afuera.
      g.fillStyle = bg; g.fillRect(0, 0, SIZE, SIZE);
      // Anillos de distancia.
      g.strokeStyle = 'rgba(122,245,201,0.07)'; g.lineWidth = 1;
      for (const r of [0.33, 0.66]) { g.beginPath(); g.arc(C, C, C * r, 0, Math.PI * 2); g.stroke(); }
      const s = w.star, size = starSize(s.mass);
      const X = (x: number): number => C + (x - s.x) * k, Y = (y: number): number => C - (y - s.y) * k;
      // Densidad de asteroides: una sombra suave por zonas (no cada punto).
      dens.fill(0);
      for (let i = 0; i < w.count; i++) {
        if (w.kind[i] !== KIND_ASTEROID || w.state[i] === DEAD) continue;
        const gx = Math.floor((w.x[i] - s.x + RANGE) / CELL), gy = Math.floor((s.y - w.y[i] + RANGE) / CELL);
        if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) continue;
        dens[gy * GRID + gx]++;
      }
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
        const v = dens[gy * GRID + gx]!;
        if (v === 0) continue;
        const cx = C + (gx + 0.5 - GRID / 2) * CELL * k, cy = C + (gy + 0.5 - GRID / 2) * CELL * k, rad = CELL * k * 1.1;
        g.globalAlpha = Math.min(0.55, v * 0.05);
        g.drawImage(blob, cx - rad, cy - rad, rad * 2, rad * 2);
      }
      g.globalAlpha = 1;
      // Planetas.
      for (let i = 0; i < w.count; i++) {
        if (!isPlanetKind(w.kind[i]!) || w.state[i] === DEAD) continue;
        const dx = w.x[i] - s.x, dy = w.y[i] - s.y;
        if (Math.abs(dx) > RANGE + 10 || Math.abs(dy) > RANGE + 10) continue;
        const own = w.state[i] === ORBITING, t = planetTier(w.radius[i], s.mass);
        g.fillStyle = own ? '#7af5c9' : t === TIER_CAPTURE || (t === TIER_BREAK && w.broken[i]! > 0) ? '#9aa3a0' : t === TIER_BREAK ? '#ffd23a' : '#ff4a3a';
        g.beginPath(); g.arc(X(w.x[i]), Y(w.y[i]), Math.max(1.6, w.radius[i] * k), 0, Math.PI * 2); g.fill();
      }
      // Estrellas del mapa: brillantes, con su halo.
      for (let q = 0; q < w.mapStars.length; q++) {
        const i = w.mapStars[q]!;
        if (w.state[i] === DEAD) continue;
        const dx = w.x[i] - s.x, dy = w.y[i] - s.y;
        if (Math.abs(dx) > RANGE + 20 || Math.abs(dy) > RANGE + 20) continue;
        const rr = Math.max(2.6, w.radius[i] * k);
        g.fillStyle = 'rgba(255,210,140,0.22)'; g.beginPath(); g.arc(X(w.x[i]), Y(w.y[i]), rr * 2.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffe2b0'; g.beginPath(); g.arc(X(w.x[i]), Y(w.y[i]), rr, 0, Math.PI * 2); g.fill();
      }
      // Cometas.
      const cm = w.comets;
      g.fillStyle = '#8fe8ff';
      for (let q = 0; q < MAX_COMETS; q++) if (cm.mode[q] !== 0) { g.beginPath(); g.arc(X(cm.x[q]!), Y(cm.y[q]!), 2.2, 0, Math.PI * 2); g.fill(); }
      // Agujero negro y su zona de marea.
      const bh = w.bh;
      if (bh.active) {
        const bx = X(bh.x), by = Y(bh.y);
        const inside = Math.abs(bh.x - s.x) < RANGE && Math.abs(bh.y - s.y) < RANGE;
        if (inside) {
          g.strokeStyle = 'rgba(255,74,58,0.35)'; g.beginPath(); g.arc(bx, by, bh.radius * w.config.bhTidalR * k, 0, Math.PI * 2); g.stroke();
          g.fillStyle = '#000'; g.strokeStyle = '#ff4a3a'; g.lineWidth = 1.5;
          g.beginPath(); g.arc(bx, by, Math.max(2.5, bh.radius * k), 0, Math.PI * 2); g.fill(); g.stroke();
        }
      }
      // Vos, con tu órbita.
      g.strokeStyle = 'rgba(122,245,201,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.arc(C, C, Math.max(4, s.captureRadius * k), 0, Math.PI * 2); g.stroke();
      g.fillStyle = w.ignited ? '#ffd9a0' : '#c9a57a';
      g.beginPath(); g.arc(C, C, Math.max(2.2, size * k), 0, Math.PI * 2); g.fill();
      g.restore();
      // Flecha al agujero negro si está fuera del mapa.
      if (bh.active) {
        const dx = bh.x - s.x, dy = bh.y - s.y;
        if (Math.abs(dx) >= RANGE || Math.abs(dy) >= RANGE) {
          const a = Math.atan2(-dy, dx), r = C - 7;
          g.fillStyle = '#ff4a3a';
          g.beginPath();
          g.moveTo(C + Math.cos(a) * (r + 5), C + Math.sin(a) * (r + 5));
          g.lineTo(C + Math.cos(a + 0.14) * (r - 3), C + Math.sin(a + 0.14) * (r - 3));
          g.lineTo(C + Math.cos(a - 0.14) * (r - 3), C + Math.sin(a - 0.14) * (r - 3));
          g.fill();
        }
      }
    },
  };
}
