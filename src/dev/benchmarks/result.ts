export interface BenchResult {
  seconds: number;
  frames: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  fps: number;
  asteroids: number;
  bodies: number;
  quality: string;
  calls: number;
  triangles: number;
  gpu: string;
}
