import { STAGES } from '../sim/stages';
import { PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, type World } from '../sim/world';

// Tu camino, abajo a la izquierda: de planeta gaseoso a agujero negro, una etapa por punto (cada uno del color y del
// tamaño de lo que vas a ser). Lo recorrido queda encendido, lo que viene apagado, y tu etapa late con su nombre.

const COLORS = ['#d9b07c', '#e3b98a', '#8a3a3c', '#ff6a3a', '#ffd27a', '#f4f6ff', '#9cc4ff', '#ffb0a0', '#ff8a6a'];

// Al transformarte, un cartel grande en el centro: qué sos ahora y qué significa.
const WHAT = [
  '', 'MÁS GRANDE QUE CUALQUIER PLANETA ROCOSO', 'TU CENTRO SE CALIENTA: CASI UNA ESTRELLA', '',
  'UNA ESTRELLA COMO EL SOL', 'MÁS CALIENTE Y MÁS BRILLANTE', 'QUEMA SU COMBUSTIBLE MUY RÁPIDO',
  'CIENTOS DE VECES MÁS ANCHA QUE EL SOL', 'AL BORDE DEL COLAPSO',
];

export interface PathTrack { update(w: World, dt: number): void }

export function createPathTrack(root: HTMLElement): PathTrack {
  const el = document.createElement('div');
  el.className = 'path';
  const n = STAGES.length + 1;   // y el agujero negro al final
  let html = '<div class="ph">TU CAMINO</div><div class="pr">';
  for (let k = 0; k < n; k++) {
    const sz = 5 + k * 1.3, col = k < STAGES.length ? COLORS[k] ?? '#fff' : '#000';
    html += `<i class="${k === n - 1 ? 'bh' : ''}" style="width:${sz}px;height:${sz}px;--c:${col}"></i>`;
    if (k < n - 1) html += '<s></s>';
  }
  html += '</div><div class="pn"></div>';
  el.innerHTML = html;
  root.appendChild(el);
  const dots = Array.from(el.querySelectorAll<HTMLElement>('.pr i'));
  const name = el.querySelector<HTMLElement>('.pn')!;
  const tf = document.createElement('div');
  tf.className = 'tform';
  tf.innerHTML = '<span>TRANSFORMACIÓN</span><b></b><i></i>';
  root.appendChild(tf);
  const tfName = tf.querySelector('b')!, tfWhat = tf.querySelector('i')!;
  let shown = -1, tfT = 0;

  return {
    update(w, dt) {
      const hole = w.phase === PHASE_COLLAPSE || w.phase === PHASE_HUNT || w.phase === PHASE_MERGE;
      const at = hole ? n - 1 : w.stage;
      if (tfT > 0) { tfT = Math.max(0, tfT - Math.min(dt, 0.1)); if (tfT === 0) tf.classList.remove('on'); }
      if (at === shown) return;
      // Subiste de etapa (no al empezar, ni en la ignición: esa tiene su propia cinemática y su cartel).
      if (shown >= 0 && at > shown && at !== 3) {
        tfName.textContent = hole ? 'AHORA SOS UN AGUJERO NEGRO' : 'AHORA SOS ' + (at === 1 || at === 6 ? 'UN ' : 'UNA ') + STAGES[at]!.name;
        tfWhat.textContent = hole ? 'TODO LO QUE SE ACERQUE, CAE' : WHAT[at] ?? '';
        tf.classList.add('on'); tfT = 3.6;
      }
      shown = at;
      for (let k = 0; k < n; k++) dots[k]!.className = (k === n - 1 ? 'bh ' : '') + (k < at ? 'done' : k === at ? 'now' : '');
      name.textContent = (hole ? 'AGUJERO NEGRO' : STAGES[at]!.name) + (at < n - 1 ? '  →  ' + (at + 1 < STAGES.length ? STAGES[at + 1]!.name : 'AGUJERO NEGRO') : '');
    },
  };
}
