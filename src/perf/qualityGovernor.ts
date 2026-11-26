import { lowerQuality, type QualityLevel } from '../render/quality';
import { FrameTimeRecorder } from './frameTimes';

export interface GovernorOptions { budgetMs: number; windowFrames: number; cooldownFrames: number }

export class QualityGovernor {
  private readonly rec: FrameTimeRecorder;
  private sinceChange = 0;

  constructor(
    private level: QualityLevel,
    private readonly opts: GovernorOptions = { budgetMs: 18, windowFrames: 180, cooldownFrames: 300 },
  ) {
    this.rec = new FrameTimeRecorder(opts.windowFrames);
  }

  get current(): QualityLevel { return this.level; }

  // Devuelve el nivel nuevo sólo en el cuadro en que cambia.
  sample(frameMs: number): QualityLevel | null {
    this.rec.push(frameMs);
    this.sinceChange++;
    if (this.rec.count < this.opts.windowFrames || this.sinceChange < this.opts.cooldownFrames) return null;
    if (this.rec.percentile(95) <= this.opts.budgetMs) return null;
    const next = lowerQuality(this.level);
    if (!next) return null;
    this.level = next;
    this.rec.reset();
    this.sinceChange = 0;
    return next;
  }
}
