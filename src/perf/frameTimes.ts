export class FrameTimeRecorder {
  private readonly buf: Float32Array;
  private readonly sorted: Float32Array;
  private n = 0;
  private i = 0;

  constructor(capacity = 600) {
    this.buf = new Float32Array(capacity);
    this.sorted = new Float32Array(capacity);
  }

  push(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.buf[this.i] = ms;
    this.i = (this.i + 1) % this.buf.length;
    if (this.n < this.buf.length) this.n++;
  }

  get count(): number { return this.n; }

  average(): number {
    if (this.n === 0) return 0;
    let s = 0;
    for (let k = 0; k < this.n; k++) s += this.buf[k];
    return s / this.n;
  }

  // Se llama pocas veces (no en cada cuadro): ordena una copia.
  percentile(p: number): number {
    if (this.n === 0) return 0;
    const view = this.sorted.subarray(0, this.n);
    view.set(this.buf.subarray(0, this.n));
    view.sort();
    const idx = Math.min(this.n - 1, Math.max(0, Math.ceil((p / 100) * this.n) - 1));
    return view[idx];
  }

  reset(): void { this.n = 0; this.i = 0; }
}
