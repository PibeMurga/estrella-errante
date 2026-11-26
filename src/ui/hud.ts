import { MAX_COMETS, type World } from '../sim/world';
import { STAGES, stageFor, stageProgress } from '../sim/stages';
import './hud.css';

// Visor de fósforo de la partida. El texto se actualiza a 10 Hz para no tocar el DOM en cada cuadro;
// la flecha y los corchetes del agujero negro se mueven en cada cuadro, sólo con transform.
export interface HudView { worldToScreen(simX: number, simY: number, out: { x: number; y: number; ahead?: boolean }): boolean }

export interface Hud {
  readonly root: HTMLElement;
  update(world: World, view: HudView, dt: number, width: number, height: number): void;
  reset(world: World): void;
  setVisible(on: boolean): void;
}

const SEGMENTS = 24;
const LOG_LINES = 3;
const LOG_LIFE = 4;     // segundos que dura una línea del registro
const UNIT = 100;       // unidades de la simulación por "UA" mostrada

const pad = (n: number, w: number): string => String(Math.max(0, Math.floor(n))).padStart(w, '0');
const ua = (d: number): string => (d / UNIT).toFixed(1).replace('.', ',');

export function createHud(parent: HTMLElement): Hud {
  const root = document.createElement('div');
  root.className = 'hud';
  root.innerHTML = `
    <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
    <div class="stage"><span class="name"></span> · <span class="pct"></span><div class="seg">${'<i class="o"></i>'.repeat(SEGMENTS)}</div></div>
    <div class="clock"><span class="time">00:00</span><br><span class="dim mass">MASA 0000</span></div>
    <div class="bhinfo am">AGUJERO NEGRO<br><span class="bhdist"></span></div>
    <div class="bottom"><span class="sling">HONDA ●</span><span class="am ecl">ECLIPSE ×0</span><span class="worlds">MUNDOS 000</span></div>
    <div class="log">${'<div></div>'.repeat(LOG_LINES)}</div>
    <div class="arrow am"><svg width="22" height="22" viewBox="-11 -11 22 22"><path d="M-6 -8 L7 0 L-6 8" fill="none" stroke="#ffb000" stroke-width="2.4"/></svg><span class="adist"></span></div>
    <div class="brackets"><i></i><i></i><i></i><i></i></div>`;
  parent.appendChild(root);

  const q = <T extends Element>(sel: string): T => root.querySelector(sel) as T;
  const nameEl = q<HTMLElement>('.stage .name'), pctEl = q<HTMLElement>('.stage .pct');
  const segs = Array.from(root.querySelectorAll<HTMLElement>('.seg i'));
  const timeEl = q<HTMLElement>('.time'), massEl = q<HTMLElement>('.mass');
  const bhDistEl = q<HTMLElement>('.bhdist'), bhInfo = q<HTMLElement>('.bhinfo');
  const slingEl = q<HTMLElement>('.sling'), eclEl = q<HTMLElement>('.ecl'), worldsEl = q<HTMLElement>('.worlds');
  const logEls = Array.from(root.querySelectorAll<HTMLElement>('.log div'));
  const arrow = q<HTMLElement>('.arrow'), arrowSvg = q<SVGElement>('.arrow svg'), arrowDist = q<HTMLElement>('.adist');
  const brackets = q<HTMLElement>('.brackets');

  const logText: string[] = [], logAge: number[] = [];
  const scr = { x: 0, y: 0, ahead: true as boolean | undefined }, edge = { x: 0, y: 0 };
  // Lo último escrito en el DOM: sólo se vuelve a escribir si cambió (a píxel entero).
  let shownMode = -1, lastTx = NaN, lastTy = NaN, lastHalf = NaN, lastAng = NaN, visible = true;
  let acc = 1, lastSeg = -1, lastBhDist = Infinity;
  let seen = { stageUps: 0, eclipses: 0, steals: 0, kills: 0, hits: 0, comets: 0, tidal: 0, crashes: 0 };

  const log = (text: string): void => {
    logText.unshift(text); logAge.unshift(0);
    if (logText.length > LOG_LINES) { logText.length = LOG_LINES; logAge.length = LOG_LINES; }
  };

  const activeComets = (w: World): number => { let n = 0; for (let k = 0; k < MAX_COMETS; k++) if (w.comets.mode[k] !== 0) n++; return n; };

  const hud: Hud = {
    root,
    reset(w) {
      seen = { stageUps: w.stageUps, eclipses: w.eclipses, steals: w.cometSteals, kills: w.cometKills, hits: w.hits, comets: activeComets(w), tidal: w.tidalBreaks, crashes: w.planetCrashes };
      logText.length = 0; logAge.length = 0;
      lastSeg = -1; acc = 1; lastBhDist = Infinity;
    },
    setVisible(on) { if (on !== visible) { visible = on; root.style.display = on ? '' : 'none'; } },
    update(w, view, dt, width, height) {
      const s = w.star, bh = w.bh;

      // Rumbo al agujero negro (cada cuadro).
      if (bh.active) {
        const onScreen = view.worldToScreen(bh.x, bh.y, scr);
        if (onScreen) {
          // El disco de acreción llega a ~4,9 radios del horizonte: los corchetes lo rodean.
          view.worldToScreen(bh.x + bh.radius * 4.9, bh.y, edge);
          const half = Math.round(Math.max(18, Math.abs(edge.x - scr.x)));
          const tx = Math.round(scr.x - half), ty = Math.round(scr.y - half);
          if (shownMode !== 1) { brackets.style.display = 'block'; arrow.style.display = 'none'; shownMode = 1; lastTx = NaN; }
          if (half !== lastHalf) { brackets.style.width = brackets.style.height = `${half * 2}px`; lastHalf = half; }
          if (tx !== lastTx || ty !== lastTy) { brackets.style.transform = `translate(${tx}px, ${ty}px)`; lastTx = tx; lastTy = ty; }
        } else {
          // Dirección real en pantalla (con la perspectiva de la cámara); si quedó detrás de la cámara, se invierte.
          const cx = width / 2, cy = height / 2, mx = cx - 70, my = cy - 60;
          let ex = scr.x - cx, ey = scr.y - cy;
          if (!scr.ahead) { ex = -ex; ey = -ey; }
          const len = Math.hypot(ex, ey) || 1;
          ex /= len; ey /= len;
          const t = Math.min(mx / Math.max(1e-6, Math.abs(ex)), my / Math.max(1e-6, Math.abs(ey)));
          const tx = Math.round(cx + ex * t - 11), ty = Math.round(cy + ey * t - 11);
          const ang = Math.round(Math.atan2(ey, ex) * 100) / 100;
          if (shownMode !== 0) { arrow.style.display = 'flex'; brackets.style.display = 'none'; shownMode = 0; lastTx = NaN; }
          if (tx !== lastTx || ty !== lastTy) { arrow.style.transform = `translate(${tx}px, ${ty}px)`; lastTx = tx; lastTy = ty; }
          if (ang !== lastAng) { arrowSvg.style.transform = `rotate(${ang}rad)`; lastAng = ang; }
        }
      }

      // Texto (10 Hz).
      acc += dt;
      for (let k = 0; k < logAge.length; k++) logAge[k] = logAge[k]! + dt;
      if (acc < 0.1) return;
      acc = 0;

      const st = stageFor(s.mass), prog = stageProgress(s.mass);
      nameEl.textContent = STAGES[st]!.name;
      pctEl.textContent = `${Math.floor(prog * 100)}%`;
      const lit = Math.round(prog * SEGMENTS);
      if (lit !== lastSeg) { for (let k = 0; k < SEGMENTS; k++) segs[k]!.className = k < lit ? '' : 'o'; lastSeg = lit; }

      const secs = w.tick / 60;
      timeEl.textContent = `${pad(secs / 60, 2)}:${pad(secs % 60, 2)}`;
      massEl.textContent = `MASA ${pad(s.mass, 4)}`;

      if (bh.active) {
        const d = Math.max(0, Math.hypot(bh.x - s.x, bh.y - s.y) - bh.radius);
        bhInfo.style.display = '';
        bhDistEl.textContent = `${ua(d)} UA · ${d < lastBhDist - 0.05 ? 'SE ACERCA' : 'SE ALEJA'}`;
        arrowDist.textContent = `${ua(d)} UA`;
        lastBhDist = d;
      } else bhInfo.style.display = 'none';

      slingEl.textContent = w.slingCd > 0 ? 'HONDA ○' : 'HONDA ●';
      slingEl.className = w.orbitingCount > 0 ? 'sling' : 'sling off';
      eclEl.textContent = `ECLIPSE ×${w.eclipses}`;
      worldsEl.textContent = `MUNDOS ${pad(w.orbitingCount, 3)}`;

      // Registro de sucesos.
      if (w.stageUps > seen.stageUps) log(`ETAPA: ${STAGES[w.stage]!.name}`);
      if (w.eclipses > seen.eclipses) log(`ECLIPSE ×${w.eclipseStrength}`);
      if (w.cometSteals > seen.steals) log('COMETA: TE ROBÓ UN MUNDO');
      if (w.cometKills > seen.kills) log('COMETA DESTRUIDO');
      if (w.hits > seen.hits) log('IMPACTO: PERDISTE MUNDOS');
      if (w.tidalBreaks > seen.tidal) log('MAREA: UN PLANETA SE PARTIÓ');
      if (w.planetCrashes > seen.crashes) log('CHOQUE DE PLANETAS');
      const ac = activeComets(w);
      if (ac > seen.comets) log('COMETA CAZADOR A LA VISTA');
      seen.stageUps = w.stageUps; seen.eclipses = w.eclipses; seen.steals = w.cometSteals;
      seen.kills = w.cometKills; seen.hits = w.hits; seen.tidal = w.tidalBreaks; seen.crashes = w.planetCrashes; seen.comets = ac;
      for (let k = 0; k < LOG_LINES; k++) {
        const el = logEls[k]!;
        if (k < logText.length && logAge[k]! < LOG_LIFE) {
          el.textContent = logText[k]!;
          el.style.opacity = String(1 - logAge[k]! / LOG_LIFE);
          el.className = logText[k]!.startsWith('COMETA: TE') || logText[k]!.startsWith('IMPACTO') ? 'am' : '';
        } else el.textContent = '';
      }
    },
  };
  return hud;
}
