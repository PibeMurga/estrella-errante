import { PerspectiveCamera, Scene, Vector3, type WebGLRenderer } from 'three';
import { createRng } from '../sim/rng';
import type { World } from '../sim/world';
import { CameraRig } from './cameraRig';
import { getWebGL2, MSG_CONTEXT_LOST, MSG_NO_WEBGL2, showFatal } from './context';
import type { FrameContext } from './layer';
import { buildLayers } from './layers';
import { DEFAULT_PARAMS, type ViewParams } from './params';
import { createPipeline } from './pipeline';
import { QUALITY, type QualityLevel } from './quality';

export interface Diagnostics {
  frames: number;
  quality: QualityLevel;
  calls: number;
  triangles: number;
  orbiting: number;
  canvasWidth: number;
  canvasHeight: number;
  lastFrameMs: number;   // tiempo de CPU para armar el cuadro
  lensEnabled: number;
  lensRadius: number;
  planetTypes: number;
}

export interface SpaceView {
  readonly ok: true;
  readonly params: ViewParams;
  readonly diagnostics: Diagnostics;
  readonly renderer: WebGLRenderer;
  readonly rig: CameraRig;
  update(world: World, alpha: number, time: number): void;
  render(): void;
  applyParams(): void;
  setQuality(level: QualityLevel): void;
  // Píxel (CSS, relativo al canvas) → coordenadas de la simulación. false si cae por encima del horizonte.
  screenToWorld(px: number, py: number, out: { x: number; y: number }): boolean;
}

export interface ViewFailure { readonly ok: false; readonly reason: string }

export interface SpaceViewOptions { world: World; quality: QualityLevel; seed?: number; params?: Partial<ViewParams> }

export function createSpaceView(canvas: HTMLCanvasElement, opts: SpaceViewOptions): SpaceView | ViewFailure {
  const gl = getWebGL2(canvas);
  if (!gl) return { ok: false, reason: MSG_NO_WEBGL2 };

  const params: ViewParams = { ...DEFAULT_PARAMS, ...opts.params };
  let quality = QUALITY[opts.quality];

  const scene = new Scene();
  const rig = new CameraRig();
  rig.snap(opts.world.star.x, opts.world.star.y);
  const camera = new PerspectiveCamera(rig.options.fovDeg, 16 / 9, 0.5, 6000);
  const lookTarget = new Vector3();
  const syncCamera = (): void => {
    camera.position.set(rig.position.x, rig.position.y, rig.position.z);
    lookTarget.set(rig.focus.x, 0, -rig.focus.y);
    camera.lookAt(lookTarget);
    camera.fov = rig.options.fovDeg;
  };
  syncCamera();

  const pipeline = createPipeline(canvas, gl, scene, camera);
  const layers = buildLayers({ world: opts.world, quality, rng: createRng(opts.seed ?? 1), pipeline });
  for (const l of layers) scene.add(l.object);

  const diagnostics: Diagnostics = {
    frames: 0, quality: quality.level, calls: 0, triangles: 0, orbiting: 0,
    canvasWidth: 0, canvasHeight: 0, lastFrameMs: 0, lensEnabled: 0, lensRadius: 0, planetTypes: 0,
  };
  const ctx: FrameContext = {
    world: opts.world, alpha: 1, time: 0, dt: 0, frame: 0, starX: opts.world.star.x, starY: opts.world.star.y,
    width: 1, height: 1, dpr: 1, quality, params, rig, camera,
  };

  const resize = (): void => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
    pipeline.setSize(w, h, dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rig.aspect = w / h;
    ctx.width = w; ctx.height = h; ctx.dpr = dpr; ctx.quality = quality;
    for (const l of layers) l.resize?.(ctx);
    diagnostics.canvasWidth = canvas.width;
    diagnostics.canvasHeight = canvas.height;
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showFatal(MSG_CONTEXT_LOST);
    setTimeout(() => location.reload(), 1500);
  });

  const applyParams = (): void => {
    pipeline.bloom.intensity = params.bloomIntensity;
    pipeline.bloom.luminanceMaterial.threshold = params.bloomThreshold;
    pipeline.vignette.darkness = params.vignetteDarkness;
    for (const l of layers) l.applyParams?.(params);
  };
  applyParams();

  const lensU = pipeline.lens.lensUniforms;
  let lastTime = -1;

  return {
    ok: true,
    params,
    diagnostics,
    renderer: pipeline.renderer,
    rig,
    update(world, alpha, time) {
      ctx.world = world;
      ctx.alpha = alpha;
      ctx.dt = lastTime < 0 ? 0 : Math.min(0.25, Math.max(0, time - lastTime));
      lastTime = time;
      ctx.time = time;
      ctx.starX = world.star.prevX + (world.star.x - world.star.prevX) * alpha;
      ctx.starY = world.star.prevY + (world.star.y - world.star.prevY) * alpha;
      rig.update(ctx.starX, ctx.starY, ctx.dt);
      syncCamera();
      for (const l of layers) l.update(ctx);
    },
    render() {
      const t0 = performance.now();
      pipeline.renderer.info.reset();
      for (const l of layers) l.prerender?.(pipeline.renderer, ctx);
      pipeline.composer.render();
      ctx.frame++;
      diagnostics.frames++;
      diagnostics.calls = pipeline.renderer.info.render.calls;
      diagnostics.triangles = pipeline.renderer.info.render.triangles;
      diagnostics.orbiting = ctx.world.orbitingCount;
      diagnostics.lensEnabled = lensU.uEnabled.value;
      diagnostics.lensRadius = lensU.uEinsteinR.value;
      diagnostics.lastFrameMs = performance.now() - t0;
    },
    applyParams,
    setQuality(level) {
      quality = QUALITY[level];
      diagnostics.quality = level;
      resize();
    },
    screenToWorld(px, py, out) {
      return rig.screenToSim((px / ctx.width) * 2 - 1, -((py / ctx.height) * 2 - 1), out);
    },
  };
}
