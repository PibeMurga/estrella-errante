import './nameScreen.css';
import { drawPlanetPreview } from './planetPreview';
import { GAS_TYPES } from '../render/playerLook';
import { NAME_MAX, savedName, savedPlanetType, setPlanetType, setPlayerName, suggestName } from './playerName';

// «NOMBRA TU MUNDO»: antes de la partida. Enter (o A en el mando) empieza; «SUGERIR» (o X) propone un nombre.
// Lo guardado aparece ya escrito. Vacío: se usa una sugerencia.
export function createNameScreen(parent: HTMLElement, onStart: (name: string, planetType: number) => void): void {
  const root = document.createElement('div');
  root.className = 'namescreen';
  root.innerHTML = `
    <div class="panel">
      <div class="title">NOMBRA TU MUNDO</div>
      <div class="sub">NACE COMO PLANETA · SE ENCIENDE COMO ESTRELLA · TERMINA COMO AGUJERO NEGRO</div>
      <input type="text" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off">
      <div class="carousel"><button class="nav prev">‹</button><div class="ring">${GAS_TYPES.map((_, i) => `<canvas class="pl" data-t="${i}" width="120" height="120"></canvas>`).join('')}</div><button class="nav next">›</button></div>
      <div class="tname"></div><div class="tnote"></div>
      <div class="row"><button class="suggest">SUGERIR</button><button class="go">EMPEZAR</button></div>
      <div class="keys">[ENTER] EMPEZAR · [↑ ↓] CAMBIAR DE PLANETA</div>
    </div>`;
  parent.appendChild(root);
  const input = root.querySelector('input') as HTMLInputElement;
  input.value = savedName() || suggestName();
  let done = false, padHeld = true, type = savedPlanetType();
  // Carrusel: el elegido al centro y grande; los vecinos más chicos y apagados a los costados. Giran con ‹ ›, las
  // flechas del teclado o un clic sobre el de al lado.
  const pls = Array.from(root.querySelectorAll<HTMLCanvasElement>('.pl'));
  const tname = root.querySelector('.tname') as HTMLElement, tnote = root.querySelector('.tnote') as HTMLElement;
  const N = GAS_TYPES.length;
  const layout = (): void => {
    pls.forEach((cv, i) => {
      let off = i - type; if (off > N / 2) off -= N; if (off < -N / 2) off += N;
      const a = Math.abs(off);
      cv.style.transform = `translateX(${off * 92}px) scale(${a === 0 ? 1 : a === 1 ? 0.55 : 0.35})`;
      cv.style.opacity = a === 0 ? '1' : a === 1 ? '0.55' : a === 2 ? '0.22' : '0';
      cv.style.zIndex = String(10 - a);
    });
    tname.textContent = GAS_TYPES[type]!.name; tnote.textContent = GAS_TYPES[type]!.note;
  };
  const pick = (t: number): void => { type = ((t % N) + N) % N; layout(); };
  pls.forEach((cv, i) => cv.addEventListener('click', () => { pick(i); input.focus(); }));
  (root.querySelector('.prev') as HTMLElement).addEventListener('click', () => { pick(type - 1); input.focus(); });
  (root.querySelector('.next') as HTMLElement).addEventListener('click', () => { pick(type + 1); input.focus(); });
  pick(type);
  const start = (): void => {
    if (done) return;
    done = true;
    const name = setPlayerName(input.value);
    setPlanetType(type);
    root.classList.add('off');
    onStart(name, type);
  };
  input.addEventListener('input', () => { const p = input.selectionStart; input.value = input.value.toUpperCase(); input.setSelectionRange(p, p); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); start(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); pick(type - 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); pick(type + 1); }
    e.stopPropagation();
  });
  (root.querySelector('.suggest') as HTMLElement).addEventListener('click', () => { input.value = suggestName(); input.focus(); });
  (root.querySelector('.go') as HTMLElement).addEventListener('click', start);
  setTimeout(() => { input.focus(); input.select(); }, 0);
  // Los planetas giran despacio mientras elegís (sólo se dibujan los visibles).
  const spin = (now: number): void => {
    if (done) return;
    pls.forEach((cv, i) => {
      let off = Math.abs(i - type); off = Math.min(off, N - off);
      if (off <= 2) drawPlanetPreview(cv, GAS_TYPES[i]!.colors, now / 1000 + i * 2, 1.3 + i, GAS_TYPES[i]!.glow);
    });
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);
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
