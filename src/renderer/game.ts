import { InputController } from '../input/controller';
import { QualityGovernor } from '../perf/qualityGovernor';
import { showFatal } from '../render/context';
import { createSpaceView } from '../render/spaceView';
import { DEFAULT_CONFIG } from '../sim/config';
import { FixedStepper } from '../sim/loop';
import { step } from '../sim/step';
import { createWorld } from '../sim/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const world = createWorld(DEFAULT_CONFIG, 20261124);
const view = createSpaceView(canvas, { world, quality: 'high' });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const input = new InputController(canvas, (sx, sy, out) => view.screenToWorld(sx, sy, out));
  const stepper = new FixedStepper();
  const governor = new QualityGovernor('high');
  window.__GAME__ = { diagnostics: view.diagnostics, world };
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    const steps = stepper.advance(elapsed);
    const intent = input.poll(world.star.x, world.star.y);
    for (let i = 0; i < steps; i++) step(world, intent);
    view.update(world, stepper.alpha, now / 1000);
    view.render();
    const next = governor.sample(elapsed * 1000);
    if (next) view.setQuality(next);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
