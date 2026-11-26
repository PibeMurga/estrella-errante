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
  orbitInfallSpeed: number;      // velocidad radial máxima al acomodarse en la órbita (para que se vea llegar, no saltar)
  orbitClearance: number;        // la órbita más baja queda a (radio de la estrella × esto): nunca adentro de la estrella
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
  bhStarPull: number;            // fracción de la gravedad que siente la estrella (0..1)
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
  eclipseMin: number;            // mundos alineados que hacen falta para un eclipse
  eclipseWindowDeg: number;      // ancho de la alineación, en grados
  eclipseDensity: number;        // hace falta esto veces lo que cabría por azar en la ventana (con muchos mundos)
  eclipseCooldown: number;       // segundos entre eclipses
  beamDuration: number;          // segundos que dura el rayo
  beamLength: number;            // largo del rayo
  beamHalfWidth: number;         // medio ancho del rayo para el daño
  cometFirst: number;            // segundos hasta el primer cometa
  cometEvery: number;            // segundos entre cometas
  cometSpeed: number;            // al cazar (la estrella llega a starMaxSpeed)
  cometFleeSpeed: number;
  cometTurn: number;             // giro máximo, rad/s
  cometHp: number;
  cometFleeTime: number;         // segundos que huye después de robar
  cometRadius: number;
  cometDebris: number;           // asteroides que deja al morir
  debrisReserve: number;         // cuerpos de reserva para los escombros (se crean muertos al armar el mapa)
  rocheFactor: number;           // un planeta rocoso o helado se parte a menos de (radio del agujero × esto + su radio)
  tidalDebris: number;           // escombros que suelta al partirse
  preBrokenChance: number;       // probabilidad de que un planeta rocoso o helado arranque ya partido
  encounterGap: number;          // dos planetas libres no se acercan a menos de (suma de radios × esto): el chico bordea al grande
  crashSizeRatio: number;        // sólo pueden chocar planetas rocosos o helados casi iguales (cociente de radios hasta esto)
  crashChance: number;           // y de esos pares, sólo esta parte choca de verdad (el resto se esquiva)
}

export const DEFAULT_CONFIG: SimConfig = {
  arenaHalfWidth: 560,
  arenaHalfHeight: 360,
  asteroidCount: 3200,
  planetCount: 40,
  spawnClearRadius: 15,
  starStartMass: 1,
  starMaxSpeed: 28,
  starAccel: 20,
  starMassInertia: 0.014,
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
  orbitInfallSpeed: 12,
  orbitClearance: 1.3,
  orbitSpeedK: 2.2,
  blackHole: true,
  bhStartRadius: 5,
  bhStartSpeed: 1.5,
  bhAccel: 0.08,
  bhMaxSpeed: 16,
  bhPull: 9000,
  bhMaxAccel: 80,
  bhRange: 140,
  bhMassGain: 0.003,
  bhStarPull: 0.6,
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
  eclipseMin: 4,
  eclipseWindowDeg: 7,
  eclipseDensity: 2.5,
  eclipseCooldown: 2.5,
  beamDuration: 0.6,
  beamLength: 150,
  beamHalfWidth: 4,
  cometFirst: 60,
  cometEvery: 40,
  cometSpeed: 24,
  cometFleeSpeed: 30,
  cometTurn: 1.6,
  cometHp: 3,
  cometFleeTime: 6,
  cometRadius: 2.5,
  cometDebris: 5,
  debrisReserve: 120,
  rocheFactor: 6,
  tidalDebris: 14,
  preBrokenChance: 0.015,
  encounterGap: 1.3,
  crashSizeRatio: 1.35,
  crashChance: 0.8,
};
