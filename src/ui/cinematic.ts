import { OVER_WON, PHASE_COLLAPSE, PHASE_MERGE, type World } from '../sim/world';
import './cinematic.css';

// Encima de la escena, durante las cinemáticas: bandas de cine, el destello de la supernova,
// su onda de choque y, al fusionarse, la onda gravitatoria (una deformación del fondo, no luz).
export interface Cinematic { update(w: World, dt: number): void }

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createCinematic(parent: HTMLElement): Cinematic {
  const root = document.createElement('div');
  root.className = 'cine';
  root.innerHTML = '<i class="bar t"></i><i class="bar b"></i><div class="flash"></div><div class="nova"></div><div class="gw"></div>';
  parent.appendChild(root);
  const flash = root.querySelector('.flash') as HTMLElement, nova = root.querySelector('.nova') as HTMLElement, gw = root.querySelector('.gw') as HTMLElement;
  let wonT = -1, lastOn = false;
  // Último valor escrito de cada elemento (opacidad, escala): sólo se toca el DOM, y se arman cadenas, si cambió.
  const last = new Float64Array(6).fill(-1);
  const slot = (el: HTMLElement): number => (el === flash ? 0 : el === nova ? 2 : 4);
  const set = (el: HTMLElement, op: number, sc: number): void => {
    const k = slot(el);
    const o = Math.round(op * 1000) / 1000, s = Math.round(sc * 1000) / 1000;
    if (o === last[k] && s === last[k + 1]) return;
    last[k] = o; last[k + 1] = s;
    el.style.opacity = String(o); el.style.transform = `scale(${s})`;
  };
  return {
    update(w, dt) {
      const t = w.phaseTime;
      if (w.over === OVER_WON) wonT = wonT < 0 ? 0 : wonT + dt; else wonT = -1;
      const on = (w.over === 0 && (w.phase === PHASE_COLLAPSE || w.phase === PHASE_MERGE)) || (wonT >= 0 && wonT < 2.5);
      if (on !== lastOn) { root.classList.toggle('on', on); lastOn = on; }
      if (w.phase === PHASE_COLLAPSE && w.over === 0) {
        set(flash, t < 2 ? 0 : t < 2.25 ? (t - 2) / 0.25 : Math.exp(-(t - 2.25) * 1.6), 1);
        const p = smooth(2.1, 5.1, t);
        set(nova, t > 2.1 ? 1 - p : 0, 0.05 + p * 2.2);
      } else { set(flash, 0, 1); set(nova, 0, 0); }
      if (wonT >= 0 && wonT < 2.2) { const p = wonT / 2.2; set(gw, 1 - p, 0.05 + p * 2.5); } else set(gw, 0, 0);
    },
  };
}
