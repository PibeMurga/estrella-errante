import { starSize } from '../sim/world';

// Cámara inclinada que sigue a la estrella. Matemática pura (sin three) para poder probarla.
// maxZoom: tope del alejamiento, para que la cámara nunca alcance a ver la costura donde el mapa da la vuelta.
export interface CameraRigOptions { tiltDeg: number; distance: number; fovDeg: number; follow: number; maxZoom: number }
export const DEFAULT_RIG: CameraRigOptions = { tiltDeg: 35, distance: 150, fovDeg: 36, follow: 1.6, maxZoom: 2.65 };

interface V3 { x: number; y: number; z: number }

// Plano de la simulación (x, y) → mundo 3D (x, 0, -y).
export function toWorld(simX: number, simY: number, out: V3): V3 {
  out.x = simX; out.y = 0; out.z = -simY;
  return out;
}

export class CameraRig {
  readonly focus = { x: 0, y: 0 };
  readonly position: V3 = { x: 0, y: 0, z: 0 };
  readonly forward: V3 = { x: 0, y: 0, z: -1 };
  readonly right: V3 = { x: 1, y: 0, z: 0 };
  readonly up: V3 = { x: 0, y: 1, z: 0 };
  aspect = 16 / 9;
  private opts: CameraRigOptions;
  private zoom = 1;   // multiplica la distancia: crece con la masa de la estrella (y con el zoom del jugador)
  private userWant = 1;   // zoom pedido por el jugador (rueda del mouse o LB/RB): de 0,7 (cerca) a 1,3 (lejos)

  constructor(opts: Partial<CameraRigOptions> = {}) {
    this.opts = { ...DEFAULT_RIG, ...opts };
    this.recompute();
  }

  get options(): Readonly<CameraRigOptions> { return this.opts; }

  // Distancia real de la cámara al foco.
  get distance(): number { return this.opts.distance * this.zoom; }

  // Se aleja de a poco cuando la estrella crece, para que se sienta la escala.
  followMass(mass: number, dt: number): void {
    if (!Number.isFinite(mass) || !(dt > 0)) return;
    // Se aleja según tu tamaño real: siendo enorme ves tu sistema y lo que lo rodea.
    const want = Math.min(this.opts.maxZoom, (1 + 0.075 * (starSize(mass) - starSize(1))) * this.userWant);
    this.zoom += (want - this.zoom) * (1 - Math.exp(-2.5 * dt));
    this.recompute();
  }

  // El jugador acerca (pasos negativos) o aleja (positivos) un poco la cámara. Cada paso, un 8 %.
  nudgeZoom(steps: number): void {
    if (!Number.isFinite(steps)) return;
    this.userWant = Math.min(1.3, Math.max(0.7, this.userWant * Math.pow(1.08, steps)));
  }

  setOptions(opts: Partial<CameraRigOptions>): void {
    this.opts = { ...this.opts, ...opts };
    this.recompute();
  }

  snap(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.focus.x = x; this.focus.y = y;
    this.recompute();
  }

  update(targetX: number, targetY: number, dt: number): void {
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !(dt > 0)) return;
    const k = 1 - Math.exp(-this.opts.follow * dt);
    this.focus.x += (targetX - this.focus.x) * k;
    this.focus.y += (targetY - this.focus.y) * k;
    this.recompute();
  }

  screenToSim(ndcX: number, ndcY: number, out: { x: number; y: number }): boolean {
    const t = Math.tan((this.opts.fovDeg * Math.PI) / 360);
    const f = this.forward, r = this.right, u = this.up;
    const dx = f.x + ndcX * t * this.aspect * r.x + ndcY * t * u.x;
    const dy = f.y + ndcX * t * this.aspect * r.y + ndcY * t * u.y;
    const dz = f.z + ndcX * t * this.aspect * r.z + ndcY * t * u.z;
    if (!(dy < -1e-6)) return false;
    const s = -this.position.y / dy;
    out.x = this.position.x + dx * s;
    out.y = -(this.position.z + dz * s);
    return true;
  }

  private recompute(): void {
    const e = (this.opts.tiltDeg * Math.PI) / 180, d = this.distance;
    const fx = this.focus.x, fz = -this.focus.y;
    const p = this.position;
    p.x = fx; p.y = d * Math.sin(e); p.z = fz + d * Math.cos(e);
    const f = this.forward;
    f.x = (fx - p.x) / d; f.y = (0 - p.y) / d; f.z = (fz - p.z) / d;
    // right = forward × (0,1,0)
    const r = this.right;
    r.x = -f.z; r.y = 0; r.z = f.x;
    const rl = Math.hypot(r.x, r.z) || 1; r.x /= rl; r.z /= rl;
    // up = right × forward
    const u = this.up;
    u.x = r.y * f.z - r.z * f.y; u.y = r.z * f.x - r.x * f.z; u.z = r.x * f.y - r.y * f.x;
  }
}
