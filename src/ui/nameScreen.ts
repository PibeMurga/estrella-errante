import './nameScreen.css';
import { drawPlanetPreview, PREVIEW_COLORS } from './planetPreview';
import { NAME_MAX, PLANET_TYPES, savedName, savedPlanetType, setPlanetType, setPlayerName, suggestName } from './playerName';

// «NOMBRÁ TU MUNDO»: antes de la partida. Enter (o A en el mando) empieza; «SUGERIR» (o X) propone un nombre.
// Lo guardado aparece ya escrito. Vacío: se usa una sugerencia.
export function createNameScreen(parent: HTMLElement, onStart: (name: string, planetType: number) => void): void {
  const root = document.createElement('div');
  root.className = 'namescreen';
  root.innerHTML = `
    <div class="panel">
      <div class="title">NOMBRÁ TU MUNDO</div>
      <div class="sub">NACE COMO PLANETA · SE ENCIENDE COMO ESTRELLA · TERMINA COMO AGUJERO NEGRO</div>
      <input type="text" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off">
      <div class="types">${PLANET_TYPES.map((t, i) => `<button class="type t${i}" data-t="${i}"><canvas width="72" height="72"></canvas><span>${t}</span></button>`).join('')}</div>
      <div class="row"><button class="suggest">SUGERIR</button><button class="go">EMPEZAR</button></div>
      <div class="keys">[ENTER] EMPEZAR</div>
    </div>`;
  parent.appendChild(root);
  const input = root.querySelector('input') as HTMLInputElement;
  input.value = savedName() || suggestName();
  let done = false, padHeld = true, type = savedPlanetType();
  const typeBtns = Array.from(root.querySelectorAll<HTMLElement>('.type'));
  const pick = (t: number): void => { type = t; typeBtns.forEach((b, i) => b.classList.toggle('on', i === t)); };
  typeBtns.forEach((b, i) => b.addEventListener('click', () => { pick(i); input.focus(); }));
  pick(type);
  // Los planetitas giran despacio mientras elegís.
  const previews = typeBtns.map((b) => b.querySelector('canvas') as HTMLCanvasElement);
  const spin = (now: number): void => {
    if (done) return;
    previews.forEach((cv, i) => drawPlanetPreview(cv, PREVIEW_COLORS[i]!, now / 1000 + i * 2, 1.3 + i));
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);
  const start = (): void => {
    if (done) return;
    done = true;
    const name = setPlayerName(input.value);
    setPlanetType(type);
    root.classList.add('off');
    onStart(name, type);
  };
  input.addEventListener('input', () => { const p = input.selectionStart; input.value = input.value.toUpperCase(); input.setSelectionRange(p, p); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); start(); } e.stopPropagation(); });
  (root.querySelector('.suggest') as HTMLElement).addEventListener('click', () => { input.value = suggestName(); input.focus(); });
  (root.querySelector('.go') as HTMLElement).addEventListener('click', start);
  setTimeout(() => { input.focus(); input.select(); }, 0);
  // Mando: A empieza, X sugiere.
  const poll = (): void => {
    if (done) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let a = false, x = false;
    for (const p of pads) { if (p?.buttons[0]?.pressed) a = true; if (p?.buttons[2]?.pressed) x = true; }
    if (!padHeld && a) start();
    else if (!padHeld && x) input.value = suggestName();
    padHeld = a || x;
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
