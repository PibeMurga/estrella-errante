import { planetTier, TIER_BREAK, TIER_GRAVE } from '../sim/planetCapture';
import { COMET_HUNT } from '../sim/comets';
import { FREE, MAX_COMETS, PHASE_PLAY, starSize, type World } from '../sim/world';
import type { HudView } from './hud';

// Alarma de peligro en el visor:
// - un planeta que te destruye viene encima (cerca y acercándose): los bordes de la pantalla se tiñen de rojo y late un
//   cartel corto;
// - cometas que vienen a robarte desde fuera de cuadro: una flecha magenta en el borde, hacia donde están;
// - debajo del planeta marcado más cercano de cada clase, qué pasa si lo chocás.

const LABELS = ['', 'CHÓCALO: LO PARTES Y SUS PEDAZOS SE SUMAN A TU ÓRBITA', 'CHOCARLO TE DAÑA', 'TE DESTRUYE · ESQUÍVALO'];
const LABEL_CLASS = ['', 'brk', 'hrt', 'grv'];

const ARROWS = 4;

export interface DangerAlert { update(w: World, view: HudView, dt: number, width: number, height: number): void }

export function createDangerAlert(root: HTMLElement): DangerAlert {
  const vig = document.createElement('div');
  vig.className = 'dvig';
  const msg = document.createElement('div');
  msg.className = 'dmsg';
  msg.textContent = 'PELIGRO · ESE PLANETA TE DESTRUYE';
  root.append(vig, msg);
  // Agujero negro cerca: los bordes se oscurecen hacia un violeta profundo (la luz se curva y se apaga) y un cartel
  // pide alejarse. Crece a medida que te acercás; la flecha del borde late.
  const bhVig = document.createElement('div'); bhVig.className = 'bhvig';
  const bhMsg = document.createElement('div'); bhMsg.className = 'bhmsg';
  root.append(bhVig, bhMsg);
  let bhLevel = 0, bhShown = -1, bhText = '';
  const arrows: HTMLElement[] = [];
  for (let k = 0; k < ARROWS; k++) {
    const a = document.createElement('div');
    a.className = 'carrow';
    a.innerHTML = '<svg width="20" height="20" viewBox="-10 -10 20 20"><path d="M-5 -7 L7 0 L-5 7 Z" fill="currentColor"/></svg>';
    root.appendChild(a); arrows.push(a);
  }
  const labels: HTMLElement[] = [];
  for (let t = 1; t <= 3; t++) {
    const l = document.createElement('div');
    l.className = `plabel ${LABEL_CLASS[t]}`; l.textContent = LABELS[t]!;
    root.appendChild(l); labels.push(l);
  }
  const best = new Int32Array(4), bestD = new Float32Array(4), lab = new Float32Array(4);
  const pt = { x: 0, y: 0, ahead: true };
  let level = 0, shownLevel = -1, time = 0;
  const arrowOn = new Uint8Array(ARROWS);
  const arrowEl = root.querySelector<HTMLElement>('.arrow');

  return {
    update(w, view, dt, width, height) {
      time += dt;
      const s = w.star, E = starSize(s.mass), playing = w.over === 0 && w.phase === PHASE_PLAY && !w.choosing;
      // Peligro: el planeta letal más cercano que viene hacia vos (o ya está pegado).
      let danger = 0;
      if (playing && w.invuln <= 0) {
        for (let q = 0; q < w.planets.length; q++) {
          const p = w.planets[q]!;
          if (w.state[p] !== FREE || w.parent[p] !== -1) continue;
          const r = w.radius[p]!;
          if (planetTier(r, s.mass) !== TIER_GRAVE) continue;
          const dx = w.x[p] - s.x, dy = w.y[p] - s.y, gap = Math.hypot(dx, dy) - r - E;
          const reach = 18 + E * 2.5;
          if (gap > reach) continue;
          const closing = -((w.vx[p] - s.vx) * dx + (w.vy[p] - s.vy) * dy) / (Math.hypot(dx, dy) || 1);
          const v = (1 - Math.max(0, gap) / reach) * (closing > 0 || gap < E ? 1 : 0.45);
          if (v > danger) danger = v;
        }
      }
      level += (danger - level) * Math.min(1, dt * 5);
      const pulse = 0.75 + 0.25 * Math.sin(time * 10);
      const lv = Math.round(level * pulse * 100) / 100;
      if (lv !== shownLevel) {
        shownLevel = lv;
        vig.style.opacity = String(Math.min(1, lv * 1.1));
        msg.style.opacity = String(level > 0.35 ? Math.min(1, (level - 0.35) * 3) * pulse : 0);
      }

      // Cercanía al agujero negro.
      const bh = w.bh;
      let near = 0;
      if (playing && bh.active) {
        const d = Math.hypot(bh.x - s.x, bh.y - s.y), tidal = bh.radius * w.config.bhTidalR, far = tidal + 380 + E * 6;
        near = Math.max(0, Math.min(1, 1 - (d - tidal) / (far - tidal)));
      }
      bhLevel += (near - bhLevel) * Math.min(1, dt * 3);
      const bl = Math.round(bhLevel * (0.85 + 0.15 * Math.sin(time * (3 + bhLevel * 6))) * 100) / 100;
      if (bl !== bhShown) {
        bhShown = bl;
        bhVig.style.opacity = String(Math.min(1, bl * 1.2));
        bhMsg.style.opacity = String(bhLevel > 0.25 ? Math.min(1, (bhLevel - 0.25) * 2.5) : 0);
        arrowEl?.classList.toggle('near', bhLevel > 0.25);
      }
      const want = bhLevel > 0.75 ? 'AGUJERO NEGRO · SU MAREA TE VA A DESHACER · ALÉJATE YA' : w.ignited ? 'AGUJERO NEGRO CERCA · TE ATRAE · ALÉJATE' : 'AGUJERO NEGRO CERCA · NO TE ACERQUES';
      if (want !== bhText) { bhText = want; bhMsg.textContent = want; }

      // Rótulos: el planeta marcado más cercano de cada clase.
      best.fill(-1); bestD.fill(Infinity);
      if (playing) {
        for (let q = 0; q < w.planets.length; q++) {
          const p = w.planets[q]!;
          if (w.state[p] !== FREE || w.parent[p] !== -1) continue;
          const r = w.radius[p]!, t = planetTier(r, s.mass);
          if (t < TIER_BREAK || (t === TIER_BREAK && w.broken[p]! > 0)) continue;
          const gap = Math.hypot(w.x[p] - s.x, w.y[p] - s.y) - r - E;
          if (gap < 50 + E * 3 && gap < bestD[t]!) { bestD[t] = gap; best[t] = p; }
        }
      }
      for (let t = TIER_BREAK; t <= TIER_GRAVE; t++) {
        const p = best[t]!, l = labels[t - 1]!;
        const on = p >= 0 && view.worldToScreen(w.x[p], w.y[p] - w.radius[p]! * 1.6, pt);
        lab[t] = lab[t]! + ((on ? 1 : 0) - lab[t]!) * Math.min(1, dt * 5);
        l.style.opacity = lab[t]! > 0.02 ? lab[t]!.toFixed(2) : '0';   // (una vez quieto en 0, el texto no cambia)
        if (on) l.style.transform = `translate(${Math.round(pt.x)}px, ${Math.round(pt.y + 6)}px) translateX(-50%)`;
      }

      // Cometas fuera de cuadro que vienen a cazarte.
      let n = 0;
      const cm = w.comets, cx = width / 2, cy = height / 2, mx = cx - 40, my = cy - 40;
      for (let k = 0; k < MAX_COMETS && n < ARROWS; k++) {
        if (!playing || cm.mode[k] !== COMET_HUNT) continue;
        const vis = view.worldToScreen(cm.x[k]!, cm.y[k]!, pt);
        if (vis && pt.ahead !== false && pt.x > 20 && pt.x < width - 20 && pt.y > 20 && pt.y < height - 20) continue;   // ya se ve
        let ex = pt.x - cx, ey = pt.y - cy;
        if (pt.ahead === false) { ex = -ex; ey = -ey; }
        const len = Math.hypot(ex, ey) || 1; ex /= len; ey /= len;
        const t = Math.min(mx / Math.max(1e-6, Math.abs(ex)), my / Math.max(1e-6, Math.abs(ey)));
        const a = arrows[n]!;
        a.style.transform = `translate(${Math.round(cx + ex * t - 10)}px, ${Math.round(cy + ey * t - 10)}px) rotate(${Math.atan2(ey, ex).toFixed(2)}rad)`;
        if (!arrowOn[n]) { a.style.opacity = '1'; arrowOn[n] = 1; }
        n++;
      }
      for (let k = n; k < ARROWS; k++) if (arrowOn[k]) { arrows[k]!.style.opacity = '0'; arrowOn[k] = 0; }
    },
  };
}
