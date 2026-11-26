import { OVER_SWALLOWED, type World } from '../sim/world';
import { STAGES } from '../sim/stages';
import './gameOver.css';

// Cartel de fin de partida en fósforo. Aparece un momento después del final, para que se vea qué pasó.
export interface GameOver {
  readonly shown: boolean;
  update(world: World, dt: number): void;
}

const DELAY = 1.2;

const pad = (n: number, w: number): string => String(Math.max(0, Math.floor(n))).padStart(w, '0');

export function createGameOver(parent: HTMLElement, onRestart: () => void): GameOver {
  const root = document.createElement('div');
  root.className = 'gameover';
  root.innerHTML = `
    <div class="panel">
      <div class="title"></div>
      <div class="why"></div>
      <div class="stats"></div>
      <div class="again">[R] O CLIC · NUEVA PARTIDA</div>
    </div>`;
  parent.appendChild(root);
  const title = root.querySelector('.title') as HTMLElement;
  const why = root.querySelector('.why') as HTMLElement;
  const stats = root.querySelector('.stats') as HTMLElement;

  let wait = DELAY, shown = false, done = false, padHeld = true;
  const restart = (): void => { if (shown && !done) { done = true; onRestart(); } };
  root.addEventListener('pointerdown', restart);
  window.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') restart(); });

  return {
    get shown() { return shown; },
    update(w, dt) {
      if (w.over === 0 || shown) {
        // Joystick: A o Start reinician.
        // Hay que soltar y volver a apretar: un botón mantenido desde antes no saltea el resumen.
        if (shown && typeof navigator !== 'undefined' && navigator.getGamepads) {
          let down = false;
          for (const p of navigator.getGamepads()) if (p && (p.buttons[0]?.pressed || p.buttons[9]?.pressed)) down = true;
          if (down && !padHeld) restart();
          padHeld = down;
        }
        return;
      }
      wait -= dt;
      if (wait > 0) return;
      shown = true;
      const swallowed = w.over === OVER_SWALLOWED;
      title.textContent = swallowed ? 'ESTRELLA TRAGADA' : 'ESTRELLA APAGADA';
      why.textContent = swallowed ? 'EL AGUJERO NEGRO TE ALCANZÓ' : 'CHOCASTE SIN MUNDOS QUE TE PROTEJAN';
      const secs = w.tick / 60;
      stats.innerHTML = `
        <div><span>TIEMPO</span><b>${pad(secs / 60, 2)}:${pad(secs % 60, 2)}</b></div>
        <div><span>MASA MÁXIMA</span><b>${pad(w.maxMass, 4)}</b></div>
        <div><span>ETAPA</span><b>${STAGES[w.stage]!.name}</b></div>
        <div><span>ECLIPSES</span><b>${w.eclipses}</b></div>
        <div><span>COMETAS DESTRUIDOS</span><b>${w.cometKills}</b></div>`;
      root.classList.add('on');
    },
  };
}
