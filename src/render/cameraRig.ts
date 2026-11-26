// Cámara inclinada que sigue a la estrella. Matemática pura (sin three) para poder probarla.
export interface CameraRigOptions { tiltDeg: number; distance: number; fovDeg: number; follow: number }
export const DEFAULT_RIG: CameraRigOptions = { tiltDeg: 35, distance: 150, fovDeg: 36, follow: 1.6 };

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

  constructor(opts: Partial<CameraRigOptions> = {}) {
    this.opts = { ...DEFAULT_RIG, ...opts };
    this.recompute();
  }

  get options(): Readonly<CameraRigOptions> { return this.opts; }

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
    const e = (this.opts.tiltDeg * Math.PI) / 180, d = this.opts.distance;
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
