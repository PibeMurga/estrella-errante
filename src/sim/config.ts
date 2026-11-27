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
  tapTime: number;               // apretado menos que esto es un toque: un asteroide que vuelve
  boltGatherRate: number;        // cuerpos por segundo que se suman al bólido mientras se mantiene
  boltMax: number;               // tope de cuerpos de un bólido
  boltSpeed: number;             // velocidad del bólido
  boltLife: number;              // segundos de vuelo; después queda suelto
  boltLoseSlow: number;          // al terminar el vuelo conserva esta fracción de la velocidad
  boltNoCatch: number;           // segundos sin poder recapturar lo que quedó suelto
  boltGatherDist: number;        // a cuánto por fuera de la órbita se arma el bólido
  boltBhFeed: number;            // masa física que suma el agujero negro por unidad de masa del bólido
  boltBhSlow: number;            // segundos que lo frena un bólido
  boltBhSlowFactor: number;      // fracción de su velocidad mientras está frenado
  planetOrbitGap: number;        // la órbita de los planetas empieza esto por fuera de la de los asteroides
  planetOrbitSpan: number;       // ancho de la franja de órbitas de los planetas
  planetHpPerRadius: number;     // golpes para partir un planeta = esto × su radio
  planetBreakKeep: number;       // al partirlo, el pedazo que queda mide esto de su radio (entra solo)
  ability1: number;              // fracción de los planetas de la pantalla en órbita para la habilidad 1
  ability2: number;
  ability3: number;
  abilityGravityMul: number;     // gravedad ampliada: el radio de captura se multiplica por esto
  abilityBoltBonus: number;      // bólido mayor: cuerpos extra en el tope del bólido
  cometStealMin: number;         // cuerpos que roba un cometa por pasada (mínimo y máximo)
  cometStealMax: number;
  planetMassGain: number;        // fracción de la masa de un planeta que suma (o resta) a tu estrella
  bodyMassGain: number;          // fracción de la masa de un asteroide o luna que suma (o resta): la masa crece más lento que el enjambre
  boltPlanetDmg: number;         // daño a un planeta de cada cuerpo de un bólido (un bólido entero parte uno mediano)
  breakFragments: number;        // fragmentos rocosos (más grandes que un asteroide) que salen al partir un planeta
  orbitWidenK: number;           // la franja de órbita se ensancha esto por cada unidad de radio de la estrella
  huntStartMinDist: number;      // al empezar la caza, el rival nunca queda más cerca que esto
  rivalMassScale: number;        // masa del rival en la carrera = esto × la masa física del agujero negro
  collapseTime: number;          // segundos de la cinemática del colapso (supernova y nacimiento)
  mergeTime: number;             // segundos de la cinemática de la fusión
  huntTimeLimit: number;         // segundos para alcanzar al rival en la caza; si no, se escapa
  huntFleeSpeed: number;         // velocidad del rival cuando huye
  huntSwallowFactor: number;     // tu agujero negro traga lo que pasa a menos de (su radio × esto)
  huntStartMaxDist: number;      // al empezar la caza, el rival nunca queda más lejos que esto
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
  orbitCapacity: 400,
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
  preBrokenChance: 0.008,
  encounterGap: 1.12,
  crashSizeRatio: 1.35,
  crashChance: 0.8,
  rivalMassScale: 55,
  collapseTime: 6,
  mergeTime: 5,
  huntTimeLimit: 60,
  huntFleeSpeed: 18,
  huntSwallowFactor: 1.2,
  huntStartMaxDist: 260,
  tapTime: 0.22,
  boltGatherRate: 6,
  boltMax: 12,
  boltSpeed: 55,
  boltLife: 2.4,
  boltLoseSlow: 0.15,
  boltNoCatch: 2.5,
  boltGatherDist: 3,
  boltBhFeed: 0.02,
  boltBhSlow: 3,
  boltBhSlowFactor: 0.6,
  planetOrbitGap: 6,
  planetOrbitSpan: 14,
  planetHpPerRadius: 2.5,
  planetBreakKeep: 0.5,
  ability1: 0.15,
  ability2: 0.30,
  ability3: 0.45,
  abilityGravityMul: 1.3,
  abilityBoltBonus: 6,
  cometStealMin: 3,
  cometStealMax: 5,
  planetMassGain: 0.1,
  bodyMassGain: 0.75,
  boltPlanetDmg: 3,
  breakFragments: 6,
  orbitWidenK: 0.8,
  huntStartMinDist: 120,
};
