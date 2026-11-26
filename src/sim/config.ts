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
  starAccel: number;             // aceleración con masa inicial (unidades/s²)
  starMassInertia: number;       // cuánto frena la masa: aceleración = starAccel / (1 + starMassInertia·masa)
  starSlowRadius: number;        // distancia a la que empieza a frenar para llegar
  starBrake: number;             // fracción de la aceleración para frenar cuando no hay objetivo
  starBaseCaptureRadius: number;
  captureRadiusPerSqrtMass: number;
  maxCaptureSize: number;        // radio máximo que se puede capturar
  stealSizeRatio: number;        // la estrella tiene que medir esto veces el planeta para robarle lunas y escombros
  orbitMin: number;
  orbitMax: number;
  orbitCapacity: number;
  orbitEase: number;             // 0..1 por paso: qué tan rápido llega a su radio de órbita
  orbitSpeedK: number;           // rad/s en orbitMin
  blackHole: boolean;            // se puede apagar para pruebas y laboratorio
  bhStartRadius: number;
  bhStartSpeed: number;          // unidades por segundo al aparecer
  bhAccel: number;               // cuánto sube la velocidad por segundo
  bhMaxSpeed: number;
  bhPull: number;                // gravedad: a = bhPull·masa / d²
  bhMaxAccel: number;            // tope de la aceleración (cerca del centro)
  bhRange: number;               // más allá de esta distancia no atrae
  bhMassGain: number;            // fracción de la masa tragada que suma el agujero negro
  hurtWorldsLost: number;        // mundos que se pierden al chocar con un planeta más grande
  hurtInvuln: number;            // segundos sin recibir daño después de un choque
  hurtBounce: number;            // velocidad del rebote
  lostSpeed: number;             // velocidad con que salen despedidos los mundos perdidos
  noCatchTime: number;           // segundos en que un mundo perdido no se puede volver a capturar
  slingCooldown: number;         // segundos entre disparos de honda
  slingSpeed: number;            // velocidad del mundo lanzado
  slingLife: number;             // segundos de vuelo antes de volver
  slingReturnSpeed: number;      // velocidad de vuelta (se suma la de la estrella)
  slingLoseDist: number;         // si al empezar a volver está más lejos que esto, se pierde
}

export const DEFAULT_CONFIG: SimConfig = {
  arenaHalfWidth: 450,
  arenaHalfHeight: 280,
  asteroidCount: 3200,
  planetCount: 40,
  spawnClearRadius: 15,
  starStartMass: 1,
  starMaxSpeed: 28,
  starAccel: 20,
  starMassInertia: 0.025,
  starSlowRadius: 30,
  starBrake: 0.5,
  starBaseCaptureRadius: 6,
  captureRadiusPerSqrtMass: 1.2,
  maxCaptureSize: 1.5,
  stealSizeRatio: 1.5,
  orbitMin: 4,
  orbitMax: 18,
  orbitCapacity: 240,
  orbitEase: 0.08,
  orbitSpeedK: 2.2,
  blackHole: true,
  bhStartRadius: 5,
  bhStartSpeed: 1.5,
  bhAccel: 0.02,
  bhMaxSpeed: 6,
  bhPull: 9000,
  bhMaxAccel: 80,
  bhRange: 140,
  bhMassGain: 0.004,
  hurtWorldsLost: 3,
  hurtInvuln: 1.5,
  hurtBounce: 24,
  lostSpeed: 18,
  noCatchTime: 1.5,
  slingCooldown: 0.35,
  slingSpeed: 70,
  slingLife: 2.2,
  slingReturnSpeed: 50,
  slingLoseDist: 220,
};
