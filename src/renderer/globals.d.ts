import type { BenchResult } from '../dev/benchmarks/result';
import type { Diagnostics } from '../render/spaceView';
import type { ViewParams } from '../render/params';
import type { QualityLevel } from '../render/quality';
import type { World } from '../sim/world';

declare global {
  interface Window {
    platform?: { kind: 'electron' };
    __GAME__?: { diagnostics: Diagnostics; world: World; forceOver?: (kind: number) => void };
    __LAB__?: { params: ViewParams; apply(): void; setTilt(deg: number): void; setQuality(level: QualityLevel): void };
    __BENCH_RESULT__?: BenchResult;
  }
}
export {};
