import { isPlanetKind, planetTier, TIER_BREAK, TIER_CAPTURE } from '../sim/planetCapture';
import { DEAD, KIND_ASTEROID, MAX_COMETS, ORBITING, starSize, type World } from '../sim/world';

// Mapa chico, abajo a la derecha: lo que tenés cerca, minimalista y con el fósforo del visor. Vos al centro.
// Planetas a escala con el color de su marca: amarillo se puede partir, rojo daña, verde son tuyos, gris entran solos.
// Asteroides como puntitos, cometas con su color y el agujero negro en rojo con su zona de marea (o una flecha si está lejos).
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

  return {
    draw(w) {
      if (++acc % 4 !== 0) return;   // unos 15 cuadros por segundo alcanzan
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, SIZE, SIZE);
      g.save();
      g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.clip();
      g.fillStyle = 'rgba(2,10,8,0.72)'; g.fillRect(0, 0, SIZE, SIZE);
      // Anillos de distancia.
      g.strokeStyle = 'rgba(122,245,201,0.12)'; g.lineWidth = 1;
      for (const r of [0.33, 0.66]) { g.beginPath(); g.arc(C, C, C * r, 0, Math.PI * 2); g.stroke(); }
      const s = w.star, size = starSize(s.mass);
      const X = (x: number): number => C + (x - s.x) * k, Y = (y: number): number => C - (y - s.y) * k;
      // Asteroides sueltos.
      g.fillStyle = 'rgba(190,170,150,0.55)';
      for (let i = 0; i < w.count; i++) {
        if (w.kind[i] !== KIND_ASTEROID || w.state[i] === DEAD) continue;
        const dx = w.x[i] - s.x, dy = w.y[i] - s.y;
        if (Math.abs(dx) > RANGE || Math.abs(dy) > RANGE) continue;
        g.fillRect(X(w.x[i]), Y(w.y[i]), 1, 1);
      }
      // Planetas.
      for (let i = 0; i < w.count; i++) {
        if (!isPlanetKind(w.kind[i]!) || w.state[i] === DEAD) continue;
        const dx = w.x[i] - s.x, dy = w.y[i] - s.y;
        if (Math.abs(dx) > RANGE + 10 || Math.abs(dy) > RANGE + 10) continue;
        const own = w.state[i] === ORBITING, t = planetTier(w.radius[i], s.mass);
        g.fillStyle = own ? '#7af5c9' : t === TIER_CAPTURE || (t === TIER_BREAK && w.broken[i]! > 0) ? '#9aa3a0' : t === TIER_BREAK ? '#ffd23a' : '#ff4a3a';
        g.beginPath(); g.arc(X(w.x[i]), Y(w.y[i]), Math.max(1.6, w.radius[i] * k), 0, Math.PI * 2); g.fill();
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
      g.strokeStyle = 'rgba(122,245,201,0.5)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.stroke();
    },
  };
}
