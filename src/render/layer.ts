import type { Object3D, PerspectiveCamera, WebGLRenderer } from 'three';
import type { World } from '../sim/world';
import type { CameraRig } from './cameraRig';
import type { ViewParams } from './params';
import type { QualitySettings } from './quality';

export interface FrameContext {
  world: World;
  alpha: number;
  time: number;
  dt: number;
  frame: number;
  starX: number;   // posición interpolada de la estrella (simulación)
  starY: number;
  width: number;   // CSS px
  height: number;  // CSS px
  dpr: number;
  quality: QualitySettings;
  params: ViewParams;
  rig: CameraRig;
  camera: PerspectiveCamera;
}

export interface Layer {
  readonly object: Object3D;
  update(ctx: FrameContext): void;
  prerender?(renderer: WebGLRenderer, ctx: FrameContext): void;
  resize?(ctx: FrameContext): void;
  applyParams?(params: ViewParams): void;
}
