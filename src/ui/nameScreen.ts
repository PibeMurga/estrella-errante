import './nameScreen.css';
import { NAME_MAX, savedName, setPlayerName, suggestName } from './playerName';

// «NOMBRÁ TU MUNDO»: antes de la partida. Enter (o A en el mando) empieza; «SUGERIR» (o X) propone un nombre.
// Lo guardado aparece ya escrito. Vacío: se usa una sugerencia.
export function createNameScreen(parent: HTMLElement, onStart: (name: string) => void): void {
  const root = document.createElement('div');
  root.className = 'namescreen';
  root.innerHTML = `
    <div class="panel">
      <div class="title">NOMBRÁ TU MUNDO</div>
      <div class="sub">NACE COMO PLANETA · SE ENCIENDE COMO ESTRELLA · TERMINA COMO AGUJERO NEGRO</div>
      <input type="text" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off">
      <div class="row"><button class="suggest">SUGERIR</button><button class="go">EMPEZAR</button></div>
      <div class="keys">[ENTER] EMPEZAR</div>
    </div>`;
  parent.appendChild(root);
  const input = root.querySelector('input') as HTMLInputElement;
  input.value = savedName() || suggestName();
  let done = false, padHeld = true;
  const start = (): void => {
    if (done) return;
    done = true;
    const name = setPlayerName(input.value);
    root.classList.add('off');
    onStart(name);
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
