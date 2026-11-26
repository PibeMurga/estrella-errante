export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;

export interface SimConfig {
  arenaHalfWidth: number;
  arenaHalfHeight: number;
  asteroidCount: number;
  planetCount: number;
  spawnClearRadius: number;
  starStartMass: number;
  starMaxSpeed: number;          // unidades por segundo
  starBaseCaptureRadius: number;
  captureRadiusPerSqrtMass: number;
  maxCaptureSize: number;        // radio máximo que se puede capturar
  orbitMin: number;
  orbitMax: number;
  orbitCapacity: number;
  orbitEase: number;             // 0..1 por paso: qué tan rápido llega a su radio de órbita
  orbitSpeedK: number;           // rad/s en orbitMin
}

export const DEFAULT_CONFIG: SimConfig = {
  arenaHalfWidth: 160,
  arenaHalfHeight: 90,
  asteroidCount: 450,
  planetCount: 9,
  spawnClearRadius: 15,
  starStartMass: 1,
  starMaxSpeed: 60,
  starBaseCaptureRadius: 6,
  captureRadiusPerSqrtMass: 1.2,
  maxCaptureSize: 1.5,
  orbitMin: 4,
  orbitMax: 18,
  orbitCapacity: 240,
  orbitEase: 0.08,
  orbitSpeedK: 2.2,
};
