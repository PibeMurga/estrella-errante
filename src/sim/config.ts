export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;

export interface SimConfig {
  arenaHalfWidth: number;
  arenaHalfHeight: number;
  asteroidCount: number;
  asteroidBelts: number;
  asteroidVoids: number;         // zonas grandes casi sin asteroides         // cinturones de asteroides sueltos por el mapa (0: ninguno)
  planetCount: number;
  planetMaxRadius: number;
  mapStars: number;
  upgrades: boolean;
  respawn: boolean;              // el espacio se repuebla fuera de cuadro
  spawnPool: number;             // planetas de reserva para repoblar
  respawnPlanets: number;        // si quedan menos planetas sueltos cerca, aparece uno nuevo
  respawnAsteroids: number;      // ídem con los asteroides (aparece un cúmulo)             // al subir de etapa se elige una mejora entre tres
  artifacts: boolean;            // restos artificiales muy raros (0 a 2 por mapa)              // estrellas del mapa (chicas y grandes, algunas con planetas)       // el planeta más grande del mapa (muchos medianos, pocos inmensos)
  spawnClearRadius: number;
  starStartMass: number;
  starMaxSpeed: number;          // unidades por segundo
  starAccel: number;             // aceleración con masa inicial (unidades/s²)
  starMassInertia: number;       // cuánto frena la masa: aceleración = starAccel / (1 + starMassInertia·masa)
  starSlowRadius: number;        // distancia a la que empieza a frenar para llegar
  starBrake: number;             // fracción de la aceleración para frenar cuando no hay objetivo
  starBaseCaptureRadius: number;
  captureRadiusPerSqrtMass: number;
  starPullReach: number;         // tu gravedad atrae lo suelto hasta esta cantidad de radios de captura
  starPullAccel: number;         // aceleración con que lo atrae (en el borde es cero, crece hacia vos)
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
  boltReachK: number;
  boltPlowMin: number;           // desde este tamaño, el bólido se abre paso rompiendo asteroides y lunas            // un bólido grande pega en un área mayor: radio extra = esto × √(cuerpos)
  boltSpeed: number;             // velocidad del bólido
  boltLife: number;              // segundos de vuelo; después queda suelto
  boltLoseSlow: number;          // al terminar el vuelo conserva esta fracción de la velocidad
  boltNoCatch: number;           // segundos sin poder recapturar lo que quedó suelto
  boltGatherDist: number;        // a cuánto por fuera de la superficie de la estrella se arma el bólido
  boltBhFeed: number;            // masa física que suma el agujero negro por unidad de masa del bólido
  boltBhSlow: number;            // segundos que lo frena un bólido
  boltBhSlowFactor: number;      // fracción de su velocidad mientras está frenado
  planetOrbitGap: number;        // la órbita de los planetas empieza esto por fuera de la de los asteroides
  planetOrbitSpan: number;       // ancho de la franja de órbitas de los planetas
  planetHpPerRadius: number;     // golpes para partir un planeta = esto × su radio
  hurtHpMul: number;             // los que dañan aguantan esto más veces
  ability1: number;              // fracción de los planetas de la pantalla en órbita para la habilidad 1
  ability2: number;
  ability3: number;
  abilityGravityMul: number;     // gravedad ampliada: el radio de captura se multiplica por esto
  abilityBoltBonus: number;      // bólido mayor: cuerpos extra en el tope del bólido
  cometStealMin: number;         // cuerpos que roba un cometa por pasada (mínimo y máximo)
  cometStealMax: number;
  cometPlanetChance: number;
  planetStart: boolean;          // la partida arranca como planeta (sin disparo, agujero dormido y sin cometas hasta la ignición)
  ignitionTime: number;
  planetPhaseGain: number;
  starPhaseGain: number;         // ídem siendo estrella: la etapa de estrella dura más
  planetPullMul: number;
  orbitSpinGrowth: number;
  planetGravity: number;
  lethalRatio: number;           // chocar contra algo más grande que esto por tu tamaño te hace pedazos
  starGravity: number;
  starCouple: number;
  coastPullMul: number;          // al soltar el clic izquierdo, las fuerzas de alrededor te tiran esto más            // qué tan fuerte te acopla una estrella a su órbita (por segundo, de cerca)           // cuánto te tira una estrella del mapa: a = esto × radio³ / distancia²
  planetStrip: number;           // cuerpos por segundo que te roba un planeta grande de cerca (escala con √ de tu órbita)         // cuánto te tira un planeta suelto: a = esto × radio³ / distancia²       // cuánto más rápido gira tu sistema siendo hipergigante (0,8 = 80 % más)
  integrityRegen: number;
  lossIntegrity: number;
  smallHitIntegrity: number;     // resistencia que te cuesta partir un planeta más chico al chocarlo
  moonTransfer: number;          // por segundo: probabilidad de que una luna o un escombro de un planeta tuyo pase a ser tuyo         // resistencia que baja por cada fracción de tu masa que perdés (0,1 de la masa = 0,1 × esto)        // resistencia que recuperás por segundo
  integrityAfterFracture: number; // con cuánta resistencia quedás después de fracturarte
  fractureMassLoss: number;      // fracción de la masa que perdés al fracturarte
  fractureOrbitLoss: number;     // fracción de lo que tenés en órbita que sale despedido al fracturarte
  hitIntegrity: number;          // resistencia que baja un choque contra un planeta (×1 a ×2 según su tamaño y el tuyo)
  rockIntegrity: number;         // ídem un asteroide que te golpea         // siendo planeta, tu gravedad atrae esto respecto de la de una estrella       // siendo planeta, la masa que suma (o resta) cada cuerpo se multiplica por esto          // segundos de la cinemática de la ignición
  halfSplitSpeed: number;
  splitNoCatch: number;          // segundos que derivan los pedazos de un planeta recién partido antes de poder entrar a tu órbita
  bhDiskR: number;
  bhTidalR: number;              // zona de marea, en radios del horizonte: arranca la órbita y, sin órbita, deshace la estrella
  bhTidalDrain: number;          // fracción de la masa que perdés por segundo sin órbita, en lo más hondo de la marea               // radio del disco de acreción, en radios del horizonte (lo que se ve)
  bhSwallowR: number;            // te traga a esta distancia, en radios del horizonte (la esfera de fotones)
  bhDiskStrip: number;           // fracción de tu órbita que te arranca por segundo en lo más hondo del disco
  bhDiskDrain: number;           // fracción de tu masa que perdés por segundo en lo más hondo del disco
  bhDiskDrag: number;            // frenado por el gas del disco (por segundo, en lo más hondo)
  rockHitSpeed: number;          // un asteroide suelto más rápido que esto no se suma a tu órbita: te golpea
  rockHitSize: number;           // ídem si es más grande que esto
  rockHitIntegrity: number;      // resistencia que te cuesta el golpe de una roca
  rockBounceChance: number;      // un asteroide suelto que choca contra un planeta rebota (si no, se deshace)
  rockShatterChance: number;     // probabilidad de que un asteroide lanzado se deshaga al chocar contra un planeta
  rockRestitution: number;       // rebote contra la superficie (0 = se queda pegado, 1 = pelota)
  rockFriction: number;          // velocidad a lo largo de la superficie que conserva al rozarla
  slingBrake: number;            // al tirar con la honda, la estrella pierde esta fracción de su velocidad
  boltBrake: number;             // ídem al soltar un bólido (más pesado: frena más)
  fireRecover: number;           // segundos en que recupera la marcha después de disparar        // velocidad con que se separan los dos pedazos de un planeta partido     // probabilidad de que, además, se lleve el planeta más chico de tu órbita
  planetMassGain: number;        // fracción de la masa de un planeta que suma (o resta) a tu estrella
  bodyMassGain: number;          // fracción de la masa de un asteroide o luna que suma (o resta): la masa crece más lento que el enjambre
  boltPlanetDmg: number;         // daño a un planeta de cada cuerpo de un bólido (un bólido entero parte uno mediano)
  breakFragments: number;        // fragmentos rocosos (más grandes que un asteroide) que salen al partir un planeta
  orbitWidenK: number;           // la franja de órbita se ensancha esto por cada unidad de radio de la estrella
  huntStartMinDist: number;      // al empezar la caza, el rival nunca queda más cerca que esto
  huntPullRange: number;         // tu agujero negro aspira lo que está a menos de (su radio × esto)
  huntPullAccel: number;         // intensidad de la aspiración: a = esto × (radio / distancia)²
  huntPullMax: number;           // tope de esa aceleración
  huntPullDrag: number;          // frenado de lo aspirado (para que caiga en espiral y no quede orbitando)
  planetJoinTime: number;        // segundos en que un planeta capturado acomoda su giro al de la órbita (se imanta)
  bodyJoinTime: number;          // lo mismo para asteroides y lunas
  planetInfallSpeed: number;     // velocidad radial máxima de un planeta al acomodarse en su órbita
  huntOrbitFall: number;         // en la caza, lo que tenías en órbita cae hacia tu agujero negro a esta velocidad (radial, media)
  hurtLossMin: number;           // un choque que daña te saca de esta fracción de tu órbita (planeta apenas más grande)…
  hurtLossMax: number;           // …hasta esta (planeta 1,5 veces tu tamaño)
  hurtMassMin: number;           // y de tu masa, entre esto…
  hurtMassMax: number;           // …y esto
  hurtStun: number;              // segundos que quedás aturdido después del choque (marcha reducida)
  hurtStunK: number;             // cuánto se reduce la marcha al principio del aturdimiento
  autoCollapse: boolean;         // colapsar solo al superar al rival siendo hipergigante (las pruebas lo pueden apagar)
  rivalMassScale: number;        // masa del rival en la carrera = esto × la masa física del agujero negro
  collapseTime: number;          // segundos de la cinemática del colapso (supernova y nacimiento)
  mergeTime: number;             // segundos de la cinemática de la fusión
  huntTimeLimit: number;         // segundos para alcanzar al rival en la caza; si no, se escapa
  huntFleeSpeed: number;         // velocidad del rival cuando huye
  huntSwallowFactor: number;     // tu agujero negro traga lo que pasa a menos de (su radio × esto)
  huntStartMaxDist: number;      // al empezar la caza, el rival nunca queda más lejos que esto
}

export const DEFAULT_CONFIG: SimConfig = {
  arenaHalfWidth: 1240,
  arenaHalfHeight: 800,
  asteroidCount: 5000,
  asteroidBelts: 0,
  asteroidVoids: 0,
  planetCount: 90,
  planetMaxRadius: 16,
  mapStars: 0,
  upgrades: false,
  respawn: false,
  spawnPool: 60,
  respawnPlanets: 16,
  respawnAsteroids: 500,
  artifacts: false,
  spawnClearRadius: 15,
  starStartMass: 1,
  starMaxSpeed: 32,
  starAccel: 24,
  starMassInertia: 0.014,
  starSlowRadius: 30,
  starBrake: 0.5,
  starBaseCaptureRadius: 6,
  captureRadiusPerSqrtMass: 1.45,
  starPullReach: 3,
  starPullAccel: 22,
  maxCaptureSize: 1.5,
  stealSizeRatio: 1.5,
  orbitMin: 4,
  orbitMax: 18,
  orbitCapacity: 400,
  orbitEase: 0.08,
  orbitInfallSpeed: 12,
  orbitClearance: 1.5,
  orbitSpeedK: 2.2,
  blackHole: true,
  bhStartRadius: 5,
  bhStartSpeed: 1.5,
  bhAccel: 0.08,
  bhMaxSpeed: 16,
  bhPull: 22000,
  bhMaxAccel: 160,
  bhRange: 200,
  bhMassGain: 0.003,
  bhStarPull: 1.3,
  hurtWorldsLost: 3,
  hurtInvuln: 1.5,
  hurtBounce: 3,
  lostSpeed: 7,
  noCatchTime: 1.5,
  slingCooldown: 0.35,
  slingSpeed: 70,
  slingLife: 2.2,
  slingReturnSpeed: 50,
  slingLoseDist: 220,
  cometFirst: 25,
  cometEvery: 24,
  cometSpeed: 28,
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
  boltGatherRate: 14,
  boltMax: 50,
  boltReachK: 0.55,
  boltPlowMin: 8,
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
  hurtHpMul: 2.5,
  ability1: 0.15,
  ability2: 0.30,
  ability3: 0.45,
  abilityGravityMul: 1.3,
  abilityBoltBonus: 12,
  cometStealMin: 5,
  cometStealMax: 9,
  cometPlanetChance: 0.65,
  planetStart: false,
  ignitionTime: 4,
  planetPhaseGain: 0.6,
  starPhaseGain: 1,
  planetPullMul: 0.35,
  orbitSpinGrowth: 0.8,
  planetGravity: 2.2,
  lethalRatio: 2,
  starGravity: 5,
  starCouple: 1.6,
  coastPullMul: 3,
  planetStrip: 1.4,
  integrityRegen: 0.045,
  lossIntegrity: 1.6,
  smallHitIntegrity: 0.1,
  moonTransfer: 0.08,
  integrityAfterFracture: 0.35,
  fractureMassLoss: 0.3,
  fractureOrbitLoss: 0.5,
  hitIntegrity: 0.32,
  rockIntegrity: 0.1,
  halfSplitSpeed: 0.3,
  splitNoCatch: 3.5,
  bhDiskR: 4.5,
  bhTidalR: 9,
  bhTidalDrain: 0.5,
  bhSwallowR: 1.5,
  bhDiskStrip: 1.2,
  bhDiskDrain: 0.25,
  bhDiskDrag: 1.6,
  rockHitSpeed: 22,
  rockHitSize: 1.25,
  rockHitIntegrity: 0.035,
  rockBounceChance: 0.05,
  rockShatterChance: 0.9,
  rockRestitution: 0.18,
  rockFriction: 0.45,
  slingBrake: 0.2,
  boltBrake: 0.45,
  fireRecover: 0.7,
  planetMassGain: 0.03,
  bodyMassGain: 0.75,
  boltPlanetDmg: 3,
  breakFragments: 6,
  orbitWidenK: 0.8,
  huntStartMinDist: 120,
  huntPullRange: 8,
  huntPullAccel: 900,
  huntPullMax: 300,
  huntPullDrag: 1.2,
  planetJoinTime: 4.5,
  bodyJoinTime: 1.2,
  planetInfallSpeed: 5,
  huntOrbitFall: 1.6,
  hurtLossMin: 0.25,
  hurtLossMax: 0.55,
  hurtMassMin: 0.08,
  hurtMassMax: 0.22,
  hurtStun: 1.5,
  hurtStunK: 0.55,
  autoCollapse: true,
};

// La partida de verdad: arranca como planeta gaseoso y se enciende con la ignición. (La base arranca como estrella, para
// las pruebas y los bancos que miden otras cosas.)
export const GAME_CONFIG: SimConfig = { ...DEFAULT_CONFIG, planetStart: true, mapStars: 3, artifacts: true, upgrades: true, respawn: true,
  planetCount: 140, respawnPlanets: 7, asteroidBelts: 6, asteroidVoids: 4, starPhaseGain: 0.82 };   // más planetas a la vista desde el principio
