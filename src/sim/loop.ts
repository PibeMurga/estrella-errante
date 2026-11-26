import { DT } from './config';

export class FixedStepper {
  private acc = 0;

  constructor(private readonly dt = DT, private readonly maxSteps = 5) {}

  advance(elapsedSeconds: number): number {
    if (!(elapsedSeconds > 0)) return 0;
    this.acc += Math.min(elapsedSeconds, this.dt * this.maxSteps);
    let n = 0;
    while (this.acc + 1e-9 >= this.dt && n < this.maxSteps) { this.acc -= this.dt; n++; }
    if (this.acc < 0) this.acc = 0;
    return n;
  }

  get alpha(): number {
    return Math.min(1, this.acc / this.dt);
  }
}
