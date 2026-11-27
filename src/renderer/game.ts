import { InputController } from '../input/controller';
import { QualityGovernor } from '../perf/qualityGovernor';
import { showFatal } from '../render/context';
import { createSpaceView } from '../render/spaceView';
import { DEFAULT_CONFIG } from '../sim/config';
import { FixedStepper } from '../sim/loop';
import { step } from '../sim/step';
import { createWorld, PHASE_COLLAPSE, PHASE_MERGE } from '../sim/world';
import { createGameOver } from '../ui/gameOver';
import { createHud } from '../ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
// Cada partida, un mapa distinto. Con ?seed=N se repite un mapa (lo usan las pruebas).
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Math.floor(Math.random() * 2 ** 31);
const world = createWorld(DEFAULT_CONFIG, seed);
const view = createSpaceView(canvas, { world, quality: 'high' });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const input = new InputController(canvas, (sx, sy, out) => view.screenToWorld(sx, sy, out));
  const stepper = new FixedStepper();
  const governor = new QualityGovernor('high');
  const hud = createHud(document.body);
  hud.reset(world);
  // Nueva partida: se recarga con otra semilla (mapa nuevo). Las capas del dibujo arman sus índices al empezar.
  const gameOver = createGameOver(document.body, () => {
    location.replace(`${location.pathname}?seed=${1 + Math.floor(Math.random() * (2 ** 31 - 2))}`);
  });
  window.__GAME__ = { diagnostics: view.diagnostics, world, forceOver: (kind: number) => { world.over = kind; } };
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    const steps = stepper.advance(elapsed);
    const intent = input.poll(world.star.x, world.star.y);
    for (let i = 0; i < steps; i++) { step(world, intent); intent.fire = false; intent.collapse = false; }
    view.update(world, stepper.alpha, now / 1000);
    view.render();
    hud.setVisible(world.over === 0 && world.phase !== PHASE_COLLAPSE && world.phase !== PHASE_MERGE);
    hud.update(world, view, elapsed, window.innerWidth, window.innerHeight);
    gameOver.update(world, elapsed);
    const next = governor.sample(elapsed * 1000);
    if (next) view.setQuality(next);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
