import { MAX_COMETS, PHASE_COLLAPSE, PHASE_HUNT, PHASE_PLAY, type World } from '../sim/world';
import { playerName } from './playerName';
import './transmissions.css';

// Transmisiones de la civilización que te observa desde un planeta de este sistema. Nunca se la ve: sólo llegan sus
// mensajes al visor, escritos letra por letra, con su «voz» sin palabras. Te guían y te empujan a crecer. Nunca mienten;
// sólo omiten (el giro del final: no huyen del devorador, te usan para alimentarse de la fusión). Cada mensaje sale una
// vez por partida, cuando pasa lo que lo dispara.

interface Msg { readonly id: string; readonly lines: readonly string[] }

const RIVAL = 'HD 141569 A';   // designación de catálogo real de una estrella joven

const msg = (id: string, ...lines: string[]): Msg => ({ id, lines });
const INTRO = (name: string): Msg => msg('intro',
  'TE VEMOS, ' + name + '.',
  'SOS UN PLANETA GASEOSO, JOVEN Y CHICO, PERDIDO ENTRE GIGANTES.',
  'JUNTÁ MATERIA: CADA ROCA QUE ATRAPÁS TE HACE CRECER.',
  'SI CRECÉS LO SUFICIENTE, TE VAS A ENCENDER. TE NECESITAMOS ENCENDIDO.');
const MSGS = {
  firstOrbit: msg('orb', 'ASÍ. CADA UNA SUMA MASA. SEGUÍ JUNTANDO.'),
  giant: msg('giant', 'YA SOS UN GIGANTE.', 'LOS PLANETAS MÁS CHICOS QUE VOS SE PARTEN SI LOS CHOCÁS: SUS PEDAZOS PASAN A SER TUYOS.'),
  comet: msg('comet', 'UN COMETA. VIENE POR LO QUE JUNTASTE.', 'NO PODÉS DETENERLO TODAVÍA: LLEVALO CONTRA UN PLANETA.'),
  rival: msg('rival', 'HAY OTRA ESTRELLA JOVEN CERCA. EN SUS CATÁLOGOS ES ' + RIVAL + '.', 'NOSOTROS LE DECIMOS «LA ÁVIDA». CRECE MÁS RÁPIDO QUE VOS.'),
  brown: msg('brown', 'TU CENTRO SE CALIENTA. YA CASI.'),
  ignition: msg('ign', 'TE ENCENDISTE. NUESTRO MUNDO TE AGRADECE LA LUZ.', 'AHORA PODÉS DISPARAR: CLIC DERECHO.'),
  devourer: msg('bh', 'EL DEVORADOR SE MUEVE.', 'NO DEJES QUE TE TRAGUE. TODAVÍA NO.'),
  artifact: msg('art', 'ESO ERA NUESTRO. UNA SONDA DE CUANDO ÉRAMOS MÁS.', 'GUARDALA CERCA.'),
  yellow: msg('yel', 'NUESTRO MUNDO NUNCA TUVO TANTA LUZ.', 'SEGUÍ CRECIENDO. MÁS GRANDE. MÁS PESADA.'),
  collapse: msg('col', 'ESO ES. NO TENGAS MIEDO.', 'ESTO ESTABA PREVISTO.'),
  hunt: msg('hunt', 'AHORA SOS LO QUE ÉL ERA.', 'ALCANZALA. LA NECESITAMOS CERCA DE VOS.'),
};

const CHARS_PER_S = 38, HOLD = 3.2;

export interface Transmissions { update(w: World, dt: number, active: boolean): void; readonly busy: boolean }

export function createTransmissions(parent: HTMLElement, onVoice: (syllables: number) => void): Transmissions {
  const root = document.createElement('div');
  root.className = 'tx';
  root.innerHTML = '<div class="txh">TRANSMISIÓN · TERCER MUNDO DE ESTE SISTEMA</div><div class="txb"></div>';
  parent.appendChild(root);
  const body = root.querySelector<HTMLElement>('.txb')!;
  const queue: Msg[] = [];
  const said = new Set<string>();
  let cur: Msg | null = null, line = 0, chars = 0, hold = 0, alpha = 0, clock = 0, shown = '';
  const say = (m: Msg): void => { if (said.has(m.id)) return; said.add(m.id); queue.push(m); };

  return {
    get busy() { return cur !== null || queue.length > 0; },
    update(w, dt, active) {
      const t = Math.min(dt, 0.1);
      if (active && w.over === 0) {
        clock += t;
        // Disparadores (cada uno, una vez).
        if (clock > 0.8) say(INTRO(playerName() || 'MUNDO'));
        if (w.orbitingCount >= 6) say(MSGS.firstOrbit);
        if (w.stage >= 1) say(MSGS.giant);
        if (!w.ignited) for (let k = 0; k < MAX_COMETS; k++) if (w.comets.mode[k] !== 0) { say(MSGS.comet); break; }
        if (clock > 70) say(MSGS.rival);
        if (w.stage >= 2) say(MSGS.brown);
        if (w.ignited && w.phase === PHASE_PLAY && w.ignitions > 0) say(MSGS.ignition);
        if (w.ignited && w.bh.active && Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y) < 520) say(MSGS.devourer);
        if (w.artifactsFound > 0) say(MSGS.artifact);
        if (w.stage >= 4) say(MSGS.yellow);
        if (w.phase === PHASE_COLLAPSE) say(MSGS.collapse);
        if (w.phase === PHASE_HUNT) say(MSGS.hunt);
      }
      // Escritura letra por letra; al terminar cada mensaje, se sostiene y se apaga.
      if (cur === null && queue.length > 0 && active) {
        cur = queue.shift()!; line = 0; chars = 0; hold = 0;
        let words = 0; for (const l of cur.lines) words += l.split(' ').length;
        onVoice(Math.min(18, Math.round(words * 0.9)));
      }
      let text = '';
      if (cur !== null) {
        if (active) {
          const full = cur.lines[line]!;
          if (chars < full.length) chars = Math.min(full.length, chars + t * CHARS_PER_S);
          else if (line + 1 < cur.lines.length) { line++; chars = 0; }
          else hold += t;
        }
        for (let k = 0; k < line; k++) text += cur.lines[k] + '\n';
        text += cur.lines[line]!.slice(0, Math.floor(chars));
        if (hold > HOLD + cur.lines.length * 0.6) cur = null;
      }
      const want = cur !== null ? 1 : 0;
      alpha += (want - alpha) * Math.min(1, t * 5);
      root.style.opacity = alpha.toFixed(3);
      if (cur !== null && text !== shown) { body.textContent = text; shown = text; }
    },
  };
}
