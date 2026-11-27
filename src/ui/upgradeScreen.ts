import './upgradeScreen.css';
import { chooseUpgrade, UPGRADE_MAX, UPGRADES } from '../sim/upgrades';
import type { World } from '../sim/world';

// Pantalla para elegir una mejora entre tres (aparece al subir de etapa; la partida espera).
// Clic, teclas 1, 2 y 3, o el mando: izquierda y derecha para moverse y A para tomarla.
export interface UpgradeScreen { update(w: World): void; readonly open: boolean }

export function createUpgradeScreen(parent: HTMLElement, onPick?: () => void): UpgradeScreen {
  const root = document.createElement('div');
  root.className = 'upgrades';
  root.innerHTML = `<div class="title">MEJORA</div><div class="sub">SUBISTE DE ETAPA · ELEGÍ UNA</div>
    <div class="cards">${[0, 1, 2].map((k) => `<div class="card" data-k="${k}"><div class="k">[${k + 1}]</div><div class="n"></div><div class="d"></div><div class="lv"></div></div>`).join('')}</div>`;
  parent.appendChild(root);
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.card'));
  let world: World | null = null, shown = false, sel = 1, padHeld = true;
  const pick = (k: number): void => {
    if (!world || !world.choosing || world.offer[k]! < 0) return;
    chooseUpgrade(world, k);
    onPick?.();
  };
  cards.forEach((c, k) => c.addEventListener('click', () => pick(k)));
  window.addEventListener('keydown', (e) => {
    if (!shown) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); pick(Number(e.key) - 1); }
  });
  const markSel = (): void => { cards.forEach((c, k) => c.classList.toggle('sel', k === sel)); };

  return {
    get open() { return shown; },
    update(w) {
      world = w;
      const on = w.choosing;
      if (on !== shown) {
        shown = on;
        root.classList.toggle('on', on);
        if (on) {
          for (let k = 0; k < 3; k++) {
            const id = w.offer[k]!, c = cards[k]!;
            c.style.display = id < 0 ? 'none' : '';
            if (id < 0) continue;
            const lv = w.upg[id]!;
            (c.querySelector('.n') as HTMLElement).textContent = UPGRADES[id]!.name;
            (c.querySelector('.d') as HTMLElement).textContent = UPGRADES[id]!.desc;
            (c.querySelector('.lv') as HTMLElement).textContent = '●'.repeat(lv + 1) + '○'.repeat(UPGRADE_MAX - lv - 1);
          }
          sel = 1; markSel(); padHeld = true;
        }
      }
      if (!shown || !navigator.getGamepads) return;
      // Mando: izquierda/derecha (cruceta o stick) y A.
      let left = false, right = false, a = false;
      for (const p of navigator.getGamepads()) {
        if (!p) continue;
        if (p.buttons[14]?.pressed || (p.axes[0] ?? 0) < -0.6) left = true;
        if (p.buttons[15]?.pressed || (p.axes[0] ?? 0) > 0.6) right = true;
        if (p.buttons[0]?.pressed) a = true;
      }
      if (!padHeld) {
        if (left) { sel = Math.max(0, sel - 1); markSel(); }
        else if (right) { sel = Math.min(2, sel + 1); markSel(); }
        else if (a) pick(sel);
      }
      padHeld = left || right || a;
    },
  };
}
