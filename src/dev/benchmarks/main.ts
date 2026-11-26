// Banco de estrés (sólo desarrollo): escena fija y recorrido fijo para medir siempre lo mismo.
import { FrameTimeRecorder } from '../../perf/frameTimes';
import { showFatal } from '../../render/context';
import type { QualityLevel } from '../../render/quality';
import { createSpaceView } from '../../render/spaceView';
import { DEFAULT_CONFIG } from '../../sim/config';
import { FixedStepper } from '../../sim/loop';
import { type Intent, step } from '../../sim/step';
import { createWorld } from '../../sim/world';

const query = new URLSearchParams(location.search);
const seconds = Math.max(1, Number(query.get('seconds') ?? '10'));
const q = query.get('quality');
const quality: QualityLevel = q === 'low' || q === 'medium' ? q : 'high';
const WARMUP = 2;

const config = { ...DEFAULT_CONFIG, asteroidCount: 2000, planetCount: 300, orbitCapacity: 600 };
const world = createWorld(config, 424242);
const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = createSpaceView(canvas, { world, quality });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const rec = new FrameTimeRecorder(Math.ceil(seconds * 240));
  const stepper = new FixedStepper();
  const intent: Intent = { targetX: 0, targetY: 0, hasTarget: true };
  window.__GAME__ = { diagnostics: view.diagnostics, world };
  const gl = view.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'desconocida';
  let start = -1;
  let last = performance.now();
  const frame = (now: number): void => {
    if (start < 0) start = now;
    const t = (now - start) / 1000;
    const elapsed = (now - last) / 1000;
    last = now;
    intent.targetX = config.arenaHalfWidth * 0.6 * Math.sin(t * 0.4);
    intent.targetY = config.arenaHalfHeight * 0.6 * Math.sin(t * 0.53);
    const steps = stepper.advance(elapsed);
    for (let i = 0; i < steps; i++) step(world, intent);
    view.update(world, stepper.alpha, now / 1000);
    view.render();
    if (t > WARMUP) rec.push(elapsed * 1000);
    if (t >= WARMUP + seconds) {
      const avg = rec.average();
      window.__BENCH_RESULT__ = {
        seconds, frames: rec.count, avgMs: avg, p95Ms: rec.percentile(95), p99Ms: rec.percentile(99),
        fps: avg > 0 ? 1000 / avg : 0, asteroids: config.asteroidCount, bodies: config.planetCount, quality,
        calls: view.diagnostics.calls, triangles: view.diagnostics.triangles, gpu,
      };
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
