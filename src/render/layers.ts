import type { Rng } from '../sim/rng';
import type { World } from '../sim/world';
import { createSky } from './background/sky';
import type { Layer } from './layer';
import type { Pipeline } from './pipeline';
import type { QualitySettings } from './quality';

export interface LayerDeps { world: World; quality: QualitySettings; rng: Rng; pipeline: Pipeline }

export function buildLayers(deps: LayerDeps): Layer[] {
  return [createSky(deps.quality, deps.rng)];
}
