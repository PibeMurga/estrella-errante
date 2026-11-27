import './pause.css';

// Pausa: el mismo fósforo del visor. ESC (o Start en el mando) pausa y retoma; con la partida en pausa,
// R arranca una nueva. Sólo durante la partida (no en el cartel final).
export interface Pause {
  readonly paused: boolean;
  set(on: boolean): void;
  // Mando: Start pausa y retoma. Hay que soltar y volver a apretar.
  pollPad(canPause: boolean): void;
}

export function createPause(parent: HTMLElement, opts: { canPause: () => boolean; onRestart: () => void; onChange?: (on: boolean) => void }): Pause {
  const root = document.createElement('div');
  root.className = 'pause';
  root.innerHTML = `
    <div class="panel">
      <div class="title">PAUSA</div>
      <div class="keys"><span>[ESC] SEGUIR</span><span>[R] NUEVA PARTIDA</span></div>
    </div>`;
  parent.appendChild(root);
  let paused = false, padHeld = true;

  const api: Pause = {
    get paused() { return paused; },
    set(on) {
      if (on === paused) return;
      paused = on;
      root.classList.toggle('on', on);
      opts.onChange?.(on);
    },
    pollPad(canPause) {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      let down = false;
      for (const p of navigator.getGamepads()) if (p?.buttons[9]?.pressed) down = true;
      if (down && !padHeld && (paused || canPause)) api.set(!paused);
      padHeld = down;
    },
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Escape') { if (paused || opts.canPause()) api.set(!paused); }
    else if (paused && (e.key === 'r' || e.key === 'R')) opts.onRestart();
  });
  return api;
}
