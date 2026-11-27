import { playerName } from './playerName';
import { OVER_ESCAPED, OVER_SHATTERED, OVER_SWALLOWED, OVER_WON, type World } from '../sim/world';
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

  // Una derrota se muestra a los 1,2 s; la victoria espera además a que termine la onda gravitatoria (3,8 s).
  let wait = DELAY + 2.6, shown = false, done = false, padHeld = true;
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
      if (wait > (w.over === OVER_WON ? 0 : 2.6)) return;
      shown = true;
      const titles: Record<number, [string, string]> = {
        [OVER_SWALLOWED]: ['ESTRELLA TRAGADA', 'EL AGUJERO NEGRO TE ALCANZÓ'],
        [OVER_ESCAPED]: ['EL RIVAL SE ESCAPÓ', 'NO LO ALCANZASTE A TIEMPO'],
        [OVER_WON]: ['FUSIÓN', 'TE COMISTE AL AGUJERO NEGRO RIVAL · GANASTE LA PANTALLA'],
        [OVER_SHATTERED]: ['HECHO PEDAZOS', 'CHOCASTE CONTRA ALGO MUCHÍSIMO MÁS GRANDE QUE VOS'],
      };
      const [tt, wy] = titles[w.over] ?? ['ESTRELLA APAGADA', 'CHOCASTE CONTRA UN PLANETA SIN NADA EN ÓRBITA QUE TE PROTEJA'];
      title.textContent = tt; why.textContent = `${playerName()} · ${wy}`;
      root.classList.toggle('won', w.over === OVER_WON);
      const secs = w.tick / 60;
      stats.innerHTML = `
        <div><span>TIEMPO</span><b>${pad(secs / 60, 2)}:${pad(secs % 60, 2)}</b></div>
        <div><span>MASA MÁXIMA</span><b>${pad(w.maxMass, 4)}</b></div>
        <div><span>ETAPA</span><b>${STAGES[w.stage]!.name}</b></div>
        <div><span>BÓLIDOS</span><b>${w.bolts}</b></div>
        <div><span>COMETAS DESTRUIDOS</span><b>${w.cometKills}</b></div>`;
      root.classList.add('on');
    },
  };
}
