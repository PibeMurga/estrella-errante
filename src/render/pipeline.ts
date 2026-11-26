import { type Camera, HalfFloatType, NoToneMapping, type Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import {
  BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import { LensPass } from './blackhole/lensPass';

export interface Pipeline {
  readonly renderer: WebGLRenderer;
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;
  readonly vignette: VignetteEffect;
  readonly lens: LensPass;
  setSize(width: number, height: number, dpr: number): void;
}

export function createPipeline(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, scene: Scene, camera: Camera): Pipeline {
  const renderer = new WebGLRenderer({ canvas, context: gl, powerPreference: 'high-performance' });
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.info.autoReset = false;

  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const lens = new LensPass();
  composer.addPass(lens);
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: 0.35, intensity: 0.95, radius: 0.7 });
  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.55 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  composer.addPass(new EffectPass(camera, bloom, vignette, tone));
  composer.addPass(new EffectPass(camera, new SMAAEffect()));

  return {
    renderer, composer, bloom, vignette, lens,
    setSize(width, height, dpr) {
      renderer.setPixelRatio(dpr);
      // false: no tocar el estilo del canvas; su tamaño lo maneja el CSS (si no, deja de seguir a la ventana).
      composer.setSize(width, height, false);
    },
  };
}
