import { MAX_COMETS, FREE, KIND_ASTEROID, KIND_GAS, KIND_ICE, KIND_MOON, KIND_ROCKY, PHASE_PLAY, starSize, type World } from '../sim/world';
import type { HudView } from './hud';
import './guide.css';

// Guía de la primera pantalla: carteles cortos que señalan en pantalla lo que hay (tu mundo, un asteroide, un planeta y
// sus tipos, las barras, la carrera, el mapa y el disparo). Van de a uno, cada uno unos segundos. El del cometa sale
// cuando aparece el primero. Se muestra en las primeras partidas (después, ya se sabe).

const SEEN_KEY = 'magnar.guia';
const SHOWS = 3;   // partidas en las que aparece

const enum Target { PLAYER, ASTEROID, PLANET, BARS, RACE, MAP, SHOT, COMET }
interface Step { target: Target; title: string; text: string; time: number }
const STEPS: readonly Step[] = [
  { target: Target.PLAYER, title: 'TU MUNDO · UN PLANETA GASEOSO', text: 'MANTÉN EL CLIC IZQUIERDO PARA IR HACIA EL MOUSE · AL SOLTAR, TE LLEVA LA GRAVEDAD', time: 6.5 },
  { target: Target.ASTEROID, title: 'ASTEROIDE', text: 'ROCA SUELTA · PASA CERCA Y QUEDA GIRANDO EN TU ÓRBITA · CADA UNA QUE SUMAS TE HACE CRECER', time: 6 },
  { target: Target.BARS, title: 'ETAPA Y RESISTENCIA', text: 'ETAPA: CUÁNTO TE FALTA PARA LA PRÓXIMA · RESIST.: TU INTEGRIDAD; BAJA AL PERDER MASA Y EN CERO TE FRACTURAS', time: 8 },
  { target: Target.RACE, title: 'LA CARRERA', text: 'TU MASA CONTRA LA DEL RIVAL · CRECE HASTA LA IGNICIÓN Y SUPÉRALO', time: 6.5 },
  { target: Target.MAP, title: 'MAPA', text: 'TÚ EN EL CENTRO · ESTRELLAS CERCANAS · EN ROJO, EL AGUJERO NEGRO', time: 6 },
  { target: Target.SHOT, title: 'DISPARO', text: 'PRIMERO CRECE HASTA SER ESTRELLA · DESPUÉS VAS A PODER ATACAR CON LOS ASTEROIDES DE TU ÓRBITA: CLIC DERECHO', time: 7 },
];
const PLANET_STEP: Step = { target: Target.PLANET, title: 'PLANETA', text: '', time: 8 };
const COMET_STEP: Step = { target: Target.COMET, title: 'COMETA', text: 'VIENE A ROBARTE CUERPOS DE LA ÓRBITA · DISPÁRALE: LO QUE SE LLEVA QUEDA SUELTO', time: 7 };

const PLANET_NAME: Record<number, string> = { [KIND_ROCKY]: 'PLANETA ROCOSO', [KIND_ICE]: 'PLANETA HELADO', [KIND_GAS]: 'PLANETA GASEOSO', [KIND_MOON]: 'SATÉLITE' };

export interface Guide { update(w: World, view: HudView, dt: number, width: number, height: number, active: boolean): void }

export function createGuide(parent: HTMLElement): Guide {
  let shows = 0;
  try { shows = Number(localStorage.getItem(SEEN_KEY) ?? '0') || 0; localStorage.setItem(SEEN_KEY, String(shows + 1)); } catch { /* sin almacenamiento: se muestra */ }
  const enabled = shows < SHOWS;
  const root = document.createElement('div');
  root.className = 'guide';
  root.innerHTML = '<div class="gline"></div><div class="gring"></div><div class="gbox"><b></b><span></span></div>';
  parent.appendChild(root);
  const line = root.querySelector<HTMLElement>('.gline')!, ring = root.querySelector<HTMLElement>('.gring')!;
  const box = root.querySelector<HTMLElement>('.gbox')!, boxT = box.querySelector('b')!, boxS = box.querySelector('span')!;
  let idx = -1, t = -1.2;   // un respiro después de la intro
  let cur: Step | null = null, cometDone = false, planetDone = false, alpha = 0, shownTitle = '';
  const pt = { x: 0, y: 0, ahead: true }, top = { x: 0, y: 0 };
  let target = -1;

  // Busca en pantalla el cuerpo más cercano a vos de un tipo (asteroide o planeta suelto).
  const nearest = (w: World, planet: boolean, view: HudView, width: number, height: number): number => {
    let best = -1, bd = Infinity;
    const me = starSize(w.star.mass);
    for (let i = 0; i < w.count; i++) {
      if (w.state[i] !== FREE) continue;
      const k = w.kind[i]!;
      if (planet ? !(k >= KIND_ROCKY && k <= KIND_MOON) : (k !== KIND_ASTEROID || w.radius[i] < 0.6)) continue;
      const d = (w.x[i] - w.star.x) ** 2 + (w.y[i] - w.star.y) ** 2;
      if (d >= bd || d < (me * 3) ** 2) continue;
      if (!view.worldToScreen(w.x[i], w.y[i], pt) || pt.x < 140 || pt.x > width - 140 || pt.y < 110 || pt.y > height - 90) continue;
      bd = d; best = i;
    }
    return best;
  };

  return {
    update(w, view, dt, width, height, active) {
      const on = enabled && active && w.over === 0 && w.phase === PHASE_PLAY && !w.choosing;
      if (on) t += Math.min(dt, 0.1);
      // El primer cometa a la vista interrumpe la guía (o aparece aunque ya haya terminado).
      if (on && !cometDone && w.ignited && (cur === null || cur.target !== Target.COMET)) {
        for (let k = 0; k < MAX_COMETS; k++) {
          if (w.comets.mode[k] === 0 || !view.worldToScreen(w.comets.x[k]!, w.comets.y[k]!, pt) || pt.x < 80 || pt.x > width - 80 || pt.y < 80 || pt.y > height - 80) continue;
          cometDone = true; cur = COMET_STEP; t = 0; target = k; break;
        }
      }
      if (on && t >= 0 && (cur === null || t > cur.time)) {
        cur = null; target = -1;
        // El planeta se explica apenas haya uno a la vista (entre un cartel y otro, o después de la secuencia).
        const pl = planetDone ? -1 : nearest(w, true, view, width, height);
        if (pl >= 0) { planetDone = true; cur = PLANET_STEP; t = 0; target = pl; }
        else if (idx + 1 < STEPS.length) {
          idx++; cur = STEPS[idx]!; t = 0;
          if (cur.target === Target.ASTEROID) {
            target = nearest(w, false, view, width, height);
            if (target < 0) t = cur.time;   // no hay ninguno a la vista: se salta
          }
          if (cur.target === Target.SHOT && w.ignited) t = cur.time;   // ya lo explicó el cartel de la ignición
        }
      }
      const want = on && cur !== null && t >= 0 && t < cur.time - 0.4 ? 1 : 0;
      alpha += (want - alpha) * Math.min(1, dt * 6);
      root.style.opacity = alpha.toFixed(3);
      if (alpha < 0.01 || cur === null) return;

      // Dónde apunta.
      let ok = true;
      switch (cur.target) {
        case Target.PLAYER: ok = view.worldToScreen(w.star.x, w.star.y, pt); if (ok) { view.worldToScreen(w.star.x + starSize(w.star.mass) * 1.1, w.star.y, top); } break;
        case Target.ASTEROID: case Target.PLANET:
          ok = target >= 0 && w.state[target] === FREE && view.worldToScreen(w.x[target], w.y[target], pt);
          if (ok) view.worldToScreen(w.x[target] + w.radius[target]! * 1.25, w.y[target], top);
          break;
        case Target.COMET: ok = w.comets.mode[target] !== 0 && view.worldToScreen(w.comets.x[target]!, w.comets.y[target]!, pt); break;
        case Target.BARS: pt.x = 88; pt.y = height / 2; break;
        case Target.RACE: pt.x = width / 2; pt.y = 76; break;
        case Target.MAP: pt.x = width - 165; pt.y = height - 120; break;
        case Target.SHOT: pt.x = width / 2 - 260; pt.y = height - 40; break;
      }
      if (!ok) { t = Math.max(t, cur.time - 0.4); return; }
      // Título del planeta según su tipo y su tamaño respecto de vos.
      let title = cur.title, text = cur.text;
      if (cur.target === Target.PLANET) {
        title = PLANET_NAME[w.kind[target]!] ?? 'PLANETA';
        const r = w.radius[target]!, me = starSize(w.star.mass);
        text = (r < me ? 'MÁS CHICO QUE TÚ: LO PUEDES CAPTURAR' : r > me * 2 ? 'TE DOBLA EN TAMAÑO: SI LO CHOCAS, TE DESTRUYE' : 'PARECIDO A TI: UN CHOQUE TE DAÑA')
          + ' · HAY ROCOSOS, HELADOS Y GASEOSOS; LOS SATÉLITES GIRAN A SU ALREDEDOR';
      }
      if (title !== shownTitle) { boxT.textContent = title; boxS.textContent = text; shownTitle = title; }
      // El cartel va hacia el centro de la pantalla desde el blanco, unido con una línea.
      const ringR = cur.target === Target.PLAYER || cur.target === Target.PLANET || cur.target === Target.ASTEROID ? Math.max(14, Math.abs(top.x - pt.x)) : cur.target === Target.BARS ? 40 : 16;
      const dirX = pt.x < width / 2 ? 1 : -1, dirY = pt.y < height / 2 ? 1 : -1;
      const bx = pt.x + dirX * (ringR + 70), by = pt.y + dirY * (ringR + 50);
      ring.style.transform = `translate(${pt.x - ringR}px, ${pt.y - ringR}px)`;
      ring.style.width = ring.style.height = `${ringR * 2}px`;
      const lx0 = pt.x + dirX * ringR * 0.71, ly0 = pt.y + dirY * ringR * 0.71;
      const len = Math.hypot(bx - lx0, by - ly0), ang = Math.atan2(by - ly0, bx - lx0);
      line.style.transform = `translate(${lx0}px, ${ly0}px) rotate(${ang}rad)`;
      line.style.width = `${len}px`;
      box.style.transform = `translate(${bx}px, ${by}px) translate(${dirX > 0 ? '0' : '-100%'}, ${dirY > 0 ? '0' : '-100%'})`;
    },
  };
}
