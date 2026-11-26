// Laboratorio visual (sólo desarrollo): ajustar la escena en vivo sin jugar una partida.
import Stats from 'stats-gl';
import { Pane } from 'tweakpane';
import { InputController } from '../../input/controller';
import { showFatal } from '../../render/context';
import type { QualityLevel } from '../../render/quality';
import { createSpaceView } from '../../render/spaceView';
import { DEFAULT_CONFIG } from '../../sim/config';
import { FixedStepper } from '../../sim/loop';
import { step } from '../../sim/step';
import { createWorld } from '../../sim/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const world = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 300, planetCount: 9 }, 7);
const view = createSpaceView(canvas, { world, quality: 'high' });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const p = view.params;
  const lab = { paused: false, quality: 'high' as QualityLevel, tilt: 35 };
  const pane = new Pane({ title: 'Laboratorio visual' });

  const post = pane.addFolder({ title: 'Postproceso' });
  post.addBinding(p, 'bloomIntensity', { min: 0, max: 4, label: 'Bloom' });
  post.addBinding(p, 'bloomThreshold', { min: 0, max: 3, label: 'Umbral' });
  post.addBinding(p, 'vignetteDarkness', { min: 0, max: 1, label: 'Viñeta' });

  const sun = pane.addFolder({ title: 'Sol y luz' });
  sun.addBinding(p, 'sunIntensity', { min: 0, max: 5, label: 'Brillo del sol' });
  sun.addBinding(p, 'lightIntensity', { min: 0, max: 8, label: 'Luz sobre cuerpos' });
  sun.addBinding(p, 'nebulaIntensity', { min: 0, max: 4, label: 'Nebulosa' });

  const hole = pane.addFolder({ title: 'Agujero negro' });
  hole.addBinding(p, 'lensEnabled', { label: 'Lente' });
  hole.addBinding(p, 'einsteinScale', { min: 0, max: 5, label: 'Radio de Einstein' });
  hole.addBinding(p, 'diskIntensity', { min: 0, max: 15, label: 'Disco' });
  hole.addBinding(p, 'blackHoleX', { min: -160, max: 160, label: 'Posición X' });
  hole.addBinding(p, 'blackHoleY', { min: -200, max: 160, label: 'Posición Y' });
  hole.addBinding(p, 'blackHoleRadius', { min: 1, max: 20, label: 'Tamaño' });

  const cam = pane.addFolder({ title: 'Cámara' });
  cam.addBinding(lab, 'tilt', { label: 'Inclinación', options: { '35°': 35, '50°': 50, '65°': 65 } })
    .on('change', (ev) => view.rig.setOptions({ tiltDeg: ev.value }));

  const sim = pane.addFolder({ title: 'Simulación' });
  sim.addBinding(lab, 'paused', { label: 'Pausar' });
  sim.addBinding(lab, 'quality', { label: 'Calidad', options: { Baja: 'low', Media: 'medium', Alta: 'high' } })
    .on('change', (ev) => view.setQuality(ev.value));
  sim.addButton({ title: 'Copiar parámetros' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(p, null, 2));
  });

  pane.on('change', () => view.applyParams());

  const stats = new Stats({ trackGPU: true, horizontal: true });
  document.body.appendChild(stats.dom);
  void stats.init(view.renderer);

  window.__GAME__ = { diagnostics: view.diagnostics, world };
  window.__LAB__ = {
    params: p,
    apply: () => view.applyParams(),
    setTilt: (deg: number) => { lab.tilt = deg; view.rig.setOptions({ tiltDeg: deg }); pane.refresh(); },
  };

  const input = new InputController(canvas, (sx, sy, out) => view.screenToWorld(sx, sy, out));
  const stepper = new FixedStepper();
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    const steps = lab.paused ? 0 : stepper.advance(elapsed);
    const intent = input.poll(world.star.x, world.star.y);
    for (let i = 0; i < steps; i++) step(world, intent);
    view.update(world, lab.paused ? 1 : stepper.alpha, now / 1000);
    view.render();
    stats.update();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
