import { InputController } from '../input/controller';
import { QualityGovernor } from '../perf/qualityGovernor';
import { showFatal } from '../render/context';
import { createSpaceView } from '../render/spaceView';
import { GAME_CONFIG } from '../sim/config';
import { FixedStepper } from '../sim/loop';
import { step } from '../sim/step';
import { createWorld, PHASE_COLLAPSE, PHASE_MERGE } from '../sim/world';
import { createGameOver } from '../ui/gameOver';
import { createHud } from '../ui/hud';
import { createCinematic } from '../ui/cinematic';
import { createPause } from '../ui/pause';

const canvas = document.getElementById('game') as HTMLCanvasElement;
// Cada partida, un mapa distinto. Con ?seed=N se repite un mapa (lo usan las pruebas).
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Math.floor(Math.random() * 2 ** 31);
const world = createWorld(GAME_CONFIG, seed);
const view = createSpaceView(canvas, { world, quality: 'high' });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const input = new InputController(canvas, (sx, sy, out) => view.screenToWorld(sx, sy, out));
  const stepper = new FixedStepper();
  const governor = new QualityGovernor('high');
  const hud = createHud(document.body);
  const cine = createCinematic(document.body);
  hud.reset(world);
  // Nueva partida: se recarga con otra semilla (mapa nuevo). Las capas del dibujo arman sus índices al empezar.
  const restart = (): void => location.replace(`${location.pathname}?seed=${1 + Math.floor(Math.random() * (2 ** 31 - 2))}`);
  const gameOver = createGameOver(document.body, restart);
  // Pausa con ESC (o Start): sólo mientras se juega, no en las cinemáticas ni en el cartel final.
  const canPause = (): boolean => world.over === 0 && world.phase !== PHASE_COLLAPSE && world.phase !== PHASE_MERGE;
  const pause = createPause(document.body, {
    canPause, onRestart: restart,
    onChange: (on) => { if (!on) input.poll(world.star.x, world.star.y); },   // al retomar se descarta lo apretado durante la pausa
  });
  window.__GAME__ = { diagnostics: view.diagnostics, world, forceOver: (kind: number) => { world.over = kind; } };
  // Zoom: la rueda del mouse acerca o aleja un poco la cámara; en el mando, LB acerca y RB aleja (mantenidos).
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (!pause.paused) view.rig.nudgeZoom(Math.sign(e.deltaY)); }, { passive: false });
  const pollZoomPad = (dt: number): void => {
    if (!navigator.getGamepads) return;
    for (const p of navigator.getGamepads()) {
      if (!p) continue;
      if (p.buttons[4]?.pressed) view.rig.nudgeZoom(-dt * 6);
      if (p.buttons[5]?.pressed) view.rig.nudgeZoom(dt * 6);
    }
  };
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    pause.pollPad(canPause());
    if (!pause.paused) pollZoomPad(elapsed);
    const steps = pause.paused ? 0 : stepper.advance(elapsed);
    // El control se lee sólo en los cuadros que avanzan la simulación: así un clic muy corto no se pierde
    // en un cuadro sin pasos (a más de 60 cuadros por segundo los hay).
    if (steps > 0) {
      const intent = input.poll(world.star.x, world.star.y);
      for (let i = 0; i < steps; i++) { step(world, intent); intent.fire = false; intent.collapse = false; }
    }
    view.update(world, stepper.alpha, now / 1000);
    view.render();
    hud.setVisible(world.over === 0 && world.phase !== PHASE_COLLAPSE && world.phase !== PHASE_MERGE);
    hud.update(world, view, elapsed, window.innerWidth, window.innerHeight);
    gameOver.update(world, elapsed);
    cine.update(world, elapsed);
    const next = governor.sample(elapsed * 1000);
    if (next) view.setQuality(next);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
