import { HemisphereLight, Vector3 } from 'three';
import type { Rng } from '../sim/rng';
import type { World } from '../sim/world';
import { createSky } from './background/sky';
import { createBlackHoleLayer } from './blackhole/blackHole';
import { createAsteroidLayer } from './bodies/asteroids';
import { createBrokenPlanetsLayer } from './bodies/brokenPlanets';
import { createPlanetsLayer } from './bodies/planets';
import { createPlanetScarsLayer } from './bodies/planetScars';
import { createSunLayer } from './bodies/sun';
import { createPlayerPlanetLayer } from './bodies/playerPlanet';
import { createMapStarsLayer } from './bodies/mapStars';
import { createArtifactsLayer } from './bodies/artifacts';
import { createIgnitionLayer } from './fx/ignition';
import { createAimGuideLayer } from './fx/aimGuide';
import { createBoltLayer } from './fx/bolt';
import { createCometsLayer } from './fx/comets';
import { createDangerMarksLayer, type DangerMarksLayer } from './fx/dangerMarks';
import { createImpactLayer } from './fx/impact';
import { createHitSparksLayer } from './fx/hitSparks';
import { createBreakBurstLayer } from './fx/breakBurst';
import { createGravityFieldLayer } from './fx/gravityField';
import type { Layer } from './layer';
import type { Pipeline } from './pipeline';
import type { QualitySettings } from './quality';

export interface LayerDeps { world: World; quality: QualitySettings; rng: Rng; pipeline: Pipeline }
export interface BuiltLayers { layers: Layer[]; planetTypes: number; marks: DangerMarksLayer }

export function buildLayers(deps: LayerDeps): BuiltLayers {
  const sunPos = new Vector3();
  const planets = createPlanetsLayer(deps.world, deps.quality.planetSegments, deps.quality.planetOctaves, deps.rng, sunPos);
  const marks = createDangerMarksLayer(deps.world);
  // Relleno muy tenue (cielo frío arriba, casi nada abajo): el lado oscuro de las cosas no es negro absoluto.
  const ambient: Layer = { object: new HemisphereLight(0x3a4866, 0x0c0907, 0.35), update() {} };
  return {
    layers: [
      createSky(deps.quality, deps.rng),
      createSunLayer(sunPos),
      createPlayerPlanetLayer(sunPos),
      createMapStarsLayer(deps.world),
      createArtifactsLayer(deps.world),
      planets,
      createPlanetScarsLayer(deps.world, sunPos, new Vector3(1.25, 1.02, 0.8), planets.spinOf),
      createBrokenPlanetsLayer(deps.world, sunPos),
      createAsteroidLayer(deps.world, deps.rng),
      ambient,
      createGravityFieldLayer(),
      createBlackHoleLayer(deps.pipeline),
      createBlackHoleLayer(deps.pipeline, 'player'),
      createBoltLayer(),
      createCometsLayer(),
      createImpactLayer(),
      createHitSparksLayer(),
      createIgnitionLayer(),
      createAimGuideLayer(),
      createBreakBurstLayer(),
      marks,
    ],
    planetTypes: planets.typesShown,
    marks,
  };
}
