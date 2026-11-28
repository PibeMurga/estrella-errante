import './intro.css';
import { drawThumb, type ThumbKind } from './entityThumbs';

// Intro de la partida: la primera transmisión de la civilización, con la partida quieta. Te dice quién sos y qué tenés
// que hacer; a la izquierda, lo que hay en el espacio, de lo más chico a lo más inmenso. Con un clic (o Enter) se
// completa el texto; con otro, empieza la partida (y la guía te muestra cómo moverte).

interface Entity { readonly name: string; readonly note: string; readonly size: number; readonly kind: ThumbKind; readonly you?: boolean; readonly danger?: boolean }
const ENTITIES: readonly Entity[] = [
  { name: 'ASTEROIDE', note: 'ROCA SUELTA · SUMALA Y CRECÉS', size: 12, kind: 'asteroid' },
  { name: 'COMETA', note: 'CHICO, PERO TE ROBA LO QUE JUNTASTE', size: 10, kind: 'comet', danger: true },
  { name: 'SATÉLITE', note: 'GIRA ALREDEDOR DE UN PLANETA', size: 16, kind: 'moon' },
  { name: 'PLANETA ROCOSO', note: 'SÓLIDO · SI ES MÁS CHICO, SE PARTE', size: 20, kind: 'rocky' },
  { name: 'PLANETA HELADO', note: 'HIELO Y ROCA', size: 23, kind: 'ice' },
  { name: 'PLANETA GASEOSO', note: 'VOS, AL EMPEZAR', size: 28, kind: 'gas', you: true },
  { name: 'ENANA MARRÓN', note: 'CASI UNA ESTRELLA', size: 31, kind: 'brown' },
  { name: 'ESTRELLA', note: 'ENCENDIDA · DE ROJA A HIPERGIGANTE', size: 24, kind: 'star' },
  { name: 'AGUJERO NEGRO', note: 'EL DEVORADOR · Y TU DESTINO', size: 20, kind: 'hole', danger: true },
];

const LINES = (name: string): string[] => [
  'TRANSMISIÓN INTERCEPTADA · ORIGEN: EL TERCER MUNDO DE ESTE SISTEMA',
  '',
  'TE VEMOS, ' + name + '.',
  'SOS UN PLANETA GASEOSO, JOVEN Y CHICO, PERDIDO ENTRE GIGANTES.',
  'JUNTÁ MATERIA: CADA ROCA QUE ATRAPÁS TE HACE CRECER.',
  'SI CRECÉS LO SUFICIENTE, TE VAS A ENCENDER COMO ESTRELLA.',
  'TE NECESITAMOS ENCENDIDO.',
];

export interface Intro { readonly active: boolean; start(name: string): void; update(dt: number): void }

export function createIntro(parent: HTMLElement, onVoice: (syllables: number) => void, onDone: () => void): Intro {
  const root = document.createElement('div');
  root.className = 'intro';
  root.innerHTML = `<div class="ilist"><div class="ih">LO QUE HAY EN EL ESPACIO · DE MENOR A MAYOR</div>${ENTITIES.map((e) =>
    `<div class="ie${e.you ? ' you' : ''}${e.danger ? ' dng' : ''}"><em></em><div><b>${e.name}</b><span>${e.note}</span></div></div>`).join('')}</div>
    <div class="itext"><pre></pre><div class="igo">CLIC O ENTER PARA EMPEZAR</div></div>`;
  parent.appendChild(root);
  root.querySelectorAll('.ie em').forEach((em, k) => em.appendChild(drawThumb(ENTITIES[k]!.kind, ENTITIES[k]!.size)));
  const pre = root.querySelector('pre')!, go = root.querySelector<HTMLElement>('.igo')!;
  let active = false, lines: string[] = [], chars = 0, total = 0, shown = -1, t = 0;

  const advance = (): void => {
    if (!active) return;
    if (chars < total) { chars = total; return; }   // primer clic: completa el texto
    active = false;
    root.classList.remove('on');
    onDone();
  };
  window.addEventListener('pointerdown', () => { if (active && t > 0.3) advance(); });
  window.addEventListener('keydown', (e) => { if (active && t > 0.3 && (e.key === 'Enter' || e.key === ' ')) advance(); });

  return {
    get active() { return active; },
    start(name) {
      lines = LINES(name); total = lines.join('\n').length; chars = 0; t = 0; active = true;
      root.classList.add('on');
      onVoice(16);
    },
    update(dt) {
      if (!active) return;
      t += Math.min(dt, 0.1);
      if (t > 0.6) chars = Math.min(total, chars + Math.min(dt, 0.1) * 40);
      const n = Math.floor(chars);
      if (n !== shown) { pre.textContent = lines.join('\n').slice(0, n); shown = n; }
      go.style.opacity = chars >= total ? '1' : '0';
    },
  };
}
