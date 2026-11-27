import { AmbientLight, Vector3 } from 'three';
import type { Rng } from '../sim/rng';
import type { World } from '../sim/world';
import { createSky } from './background/sky';
import { createBlackHoleLayer } from './blackhole/blackHole';
import { createAsteroidLayer } from './bodies/asteroids';
import { createBrokenPlanetsLayer } from './bodies/brokenPlanets';
import { createPlanetsLayer } from './bodies/planets';
import { createSunLayer } from './bodies/sun';
import { createBoltLayer } from './fx/bolt';
import { createCometsLayer } from './fx/comets';
import { createDangerMarksLayer, type DangerMarksLayer } from './fx/dangerMarks';
import { createImpactLayer } from './fx/impact';
import { createHitSparksLayer } from './fx/hitSparks';
import type { Layer } from './layer';
import type { Pipeline } from './pipeline';
import type { QualitySettings } from './quality';

export interface LayerDeps { world: World; quality: QualitySettings; rng: Rng; pipeline: Pipeline }
export interface BuiltLayers { layers: Layer[]; planetTypes: number; marks: DangerMarksLayer }

export function buildLayers(deps: LayerDeps): BuiltLayers {
  const sunPos = new Vector3();
  const planets = createPlanetsLayer(deps.world, deps.quality.planetSegments, deps.quality.planetOctaves, deps.rng, sunPos);
  const marks = createDangerMarksLayer(deps.world);
  const ambient: Layer = { object: new AmbientLight(0x1a2233, 0.03), update() {} };
  return {
    layers: [
      createSky(deps.quality, deps.rng),
      createSunLayer(sunPos),
      planets,
      createBrokenPlanetsLayer(deps.world, sunPos),
      createAsteroidLayer(deps.world, deps.rng),
      ambient,
      createBlackHoleLayer(deps.pipeline),
      createBlackHoleLayer(deps.pipeline, 'player'),
      createBoltLayer(),
      createCometsLayer(),
      createImpactLayer(),
      createHitSparksLayer(),
      marks,
    ],
    planetTypes: planets.typesShown,
    marks,
  };
}
