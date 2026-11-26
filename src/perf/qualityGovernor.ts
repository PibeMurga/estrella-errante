import { lowerQuality, type QualityLevel } from '../render/quality';
import { FrameTimeRecorder } from './frameTimes';

export interface GovernorOptions { budgetMs: number; windowFrames: number; cooldownFrames: number }

// Baja la calidad sólo si el rendimiento empeora respecto de lo normal en esta máquina.
// La primera ventana fija la referencia: así un monitor o un límite de 30/40 Hz no se confunde con una placa lenta.
export class QualityGovernor {
  private readonly rec: FrameTimeRecorder;
  private sinceChange = 0;
  private sinceCheck = 0;
  private budget: number;
  private baselineSet = false;

  constructor(
    private level: QualityLevel,
    private readonly opts: GovernorOptions = { budgetMs: 18, windowFrames: 180, cooldownFrames: 300 },
  ) {
    this.rec = new FrameTimeRecorder(opts.windowFrames);
    this.budget = opts.budgetMs;
  }

  get current(): QualityLevel { return this.level; }

  // Devuelve el nivel nuevo sólo en el cuadro en que cambia. Evalúa una vez por ventana, no en cada cuadro.
  sample(frameMs: number): QualityLevel | null {
    this.rec.push(frameMs);
    this.sinceChange++;
    this.sinceCheck++;
    if (this.rec.count < this.opts.windowFrames) return null;
    if (!this.baselineSet) {
      this.budget = Math.max(this.opts.budgetMs, this.rec.percentile(50) * 1.25);
      this.baselineSet = true;
      this.sinceCheck = 0;
      return null;
    }
    if (this.sinceChange < this.opts.cooldownFrames || this.sinceCheck < this.opts.windowFrames) return null;
    this.sinceCheck = 0;
    if (this.rec.percentile(95) <= this.budget) return null;
    const next = lowerQuality(this.level);
    if (!next) return null;
    this.level = next;
    this.rec.reset();
    this.sinceChange = 0;
    return next;
  }
}
