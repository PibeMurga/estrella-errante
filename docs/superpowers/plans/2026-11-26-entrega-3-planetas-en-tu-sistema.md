# Entrega 3: planetas en tu sistema — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:**
- Los planetas se suman a tu sistema en **escalones según su tamaño (T) comparado con el de tu estrella (E):**

  | Tamaño | Qué pasa |
  |---|---|
  | T ≤ 0,5·E | Entra solo, a una órbita exterior lenta. |
  | 0,5·E < T ≤ E | Se parte a golpes de honda o con un bólido, y el pedazo que queda entra solo. |
  | E < T ≤ 1,5·E | Te daña. |
  | T > 1,5·E | Golpe grave: perdés una etapa. |

- **Marcas de peligro minimalistas** alrededor de los planetas cercanos.
- **Habilidades** según la cantidad de planetas en órbita (15 %, 30 % y 45 % de los planetas de la pantalla).
- **Cometas que roban de 3 a 5 cuerpos,** y desde el segundo escalón también un planeta chico. Al destruirlos, sueltan todo.

**Arquitectura:**
- `src/sim/planetCapture.ts`: escalones, golpes a planetas y golpe grave.
- `src/sim/abilities.ts`: nivel de habilidad.
- `World.planets`: lista fija de índices de planetas, armada en `createWorld`.
- Lo robado por un cometa se marca con `parent = índice del cometa`; `comets.carry[k]` pasa a ser una cantidad.
- Render: capa nueva `fx/dangerMarks.ts`.

**Tecnologías:** TypeScript, Three.js, Vitest y Playwright.

**Especificación:** `docs/superpowers/specs/2026-11-26-meta-colapso-pantallas-design.md`:
- §3: escalones, habilidades y cometas;
- §2: marcas de peligro;
- §11: decisiones confirmadas (golpe grave = una etapa; las habilidades se pierden al bajar del umbral).

## Restricciones globales

- Todo en español rioplatense, sin dependencias nuevas.
- La simulación sigue pura y determinista, sin objetos dentro de `step`.
- Escalones exactos: `T ≤ 0,5·E` captura, `≤ E` se parte, `≤ 1,5·E` daña y `> 1,5·E` es grave. E es `starSize(masa)`.
- Valores iniciales en `SimConfig`:
  - `planetOrbitGap: 6`;
  - `planetOrbitSpan: 14`;
  - `planetHpPerRadius: 2.5`;
  - `planetBreakKeep: 0.5`;
  - `ability1: 0.15`, `ability2: 0.30`, `ability3: 0.45`;
  - `abilityGravityMul: 1.3`;
  - `abilityBoltBonus: 6`;
  - `cometStealMin: 3`, `cometStealMax: 5`.
- Habilidades, en este orden:
  - **1: GRAVEDAD AMPLIADA**, el radio de captura × 1,3;
  - **2: ESCUDO DE ÓRBITA**, que ante un golpe que daña suelta un planeta exterior en lugar de asteroides;
  - **3: BÓLIDO MAYOR**, que agrega 6 cuerpos al tope del bólido.
- Marcas de peligro:
  - **trazos verde fósforo:** se puede partir;
  - **ámbar:** daña;
  - **rojo:** golpe grave;
  - **sin marca:** entra solo.

  Sólo cerca: el borde del planeta a menos de 35 unidades del borde de tu estrella. Aparecen y se apagan de a poco.
- Commits terminados con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VCDQYR4GnVKDakJf79PRaF
  ```

## Puntos a revisar

1. **Un planeta capturado con lunas.** Las lunas siguen girando alrededor de su planeta, que ahora orbita tu estrella, y se pueden robar. Se prueba en la Tarea 1.
2. **Partir un planeta gaseoso.** No tiene dibujo de planeta partido: se achica y suelta escombros, y no desaparece. Se prueba en la Tarea 2.
3. **Golpe grave estando en la primera etapa.** La masa no baja del mínimo y la etapa queda en 0. Se prueba en la Tarea 1.
4. **Perder la habilidad 3 mientras se carga un bólido más grande que el tope nuevo.** El bólido sale con lo que juntó, sin recortar. Se prueba en la Tarea 3.
5. **Colapsar con un cometa que lleva varios cuerpos.** Todos quedan libres. Se prueba en la Tarea 4.

---

### Tarea 1: escalones de captura, órbita de planetas y golpe grave

**Archivos:**
- Crear: `src/sim/planetCapture.ts`
- Modificar:
  - `src/sim/world.ts`: `planets: Int32Array`, `planetCaptures`, `graveHits` y `planetDmg: Float32Array`;
  - `src/sim/config.ts`;
  - `src/sim/step.ts`: captura, choque por escalón y franja de planetas en `moveOrbiting`;
  - `src/sim/encounters.ts`: el esquive pasa a valer para `0,5·E < T ≤ E`.
- Prueba: `tests/unit/planetCapture.test.ts`

**Interfaces:**
- Produce:
  - `TIER_CAPTURE = 0, TIER_BREAK = 1, TIER_HURT = 2, TIER_GRAVE = 3`;
  - `planetTier(radius: number, starMass: number): number`;
  - `isPlanetKind(k: number): boolean`;
  - `graveHit(w: World, p: number): void`;
  - en `World`: `planets`, `planetCaptures`, `graveHits` y `planetDmg`.

- [ ] **Paso 1: pruebas que fallan** (`tests/unit/planetCapture.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { planetTier, TIER_BREAK, TIER_CAPTURE, TIER_GRAVE, TIER_HURT } from '../../src/sim/planetCapture';
import { STAGES } from '../../src/sim/stages';
import { type Intent, step } from '../../src/sim/step';
import { addBody, addSatellite, createWorld, FREE, KIND_ASTEROID, KIND_MOON, KIND_ROCKY, ORBIT_PLANET, ORBITING, OVER_NONE, starSize, type World } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 };
const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const run = (w: World, s: number): void => { for (let k = 0; k < Math.round(s * 60); k++) step(w, idle); };
function guarded(mass: number, n = 6): World {
  const w = createWorld(cfg, 9, 80);
  w.star.mass = mass;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; addBody(w, { x: Math.cos(a) * 8, y: Math.sin(a) * 8, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); }
  step(w, idle);
  return w;
}

describe('escalones de los planetas', () => {
  it('el escalón depende del tamaño del planeta comparado con el de la estrella', () => {
    const E = starSize(100);
    expect(planetTier(E * 0.5, 100)).toBe(TIER_CAPTURE);
    expect(planetTier(E * 0.51, 100)).toBe(TIER_BREAK);
    expect(planetTier(E, 100)).toBe(TIER_BREAK);
    expect(planetTier(E * 1.2, 100)).toBe(TIER_HURT);
    expect(planetTier(E * 1.5, 100)).toBe(TIER_HURT);
    expect(planetTier(E * 1.51, 100)).toBe(TIER_GRAVE);
  });
  it('un planeta chico entra solo a una órbita exterior, más afuera que los asteroides', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.4, kind: KIND_ROCKY });
    step(w, idle);
    expect(w.state[p]).toBe(ORBITING);
    expect(w.planetCaptures).toBe(1);
    run(w, 6);
    let maxAst = 0;
    for (let i = 0; i < w.count; i++) if (w.state[i] === ORBITING && w.kind[i] === KIND_ASTEROID) maxAst = Math.max(maxAst, w.orbitR[i]);
    expect(w.orbitR[p]).toBeGreaterThan(maxAst + cfg.planetOrbitGap * 0.5);
  });
  it('sus lunas lo siguen y se pueden robar', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.4, kind: KIND_ROCKY });
    const m = addSatellite(w, p, E * 0.4 * 2.5, 0, 0.6, KIND_MOON, 1);
    run(w, 3);
    expect(w.state[p]).toBe(ORBITING);
    expect(w.state[m] === ORBIT_PLANET || w.state[m] === ORBITING).toBe(true);
  });
  it('un planeta mediano no entra: hay que partirlo', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 14, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_ROCKY });
    run(w, 1);
    expect(w.state[p]).toBe(FREE);
  });
  it('un planeta un poco más grande te daña; uno mucho más grande es un golpe grave y perdés una etapa', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    addBody(w, { x: w.star.x + E, y: 0, vx: 0, vy: 0, radius: E * 1.3, kind: KIND_ROCKY });
    step(w, idle);
    expect(w.hits).toBe(1); expect(w.graveHits).toBe(0);
    const g = guarded(STAGES[3]!.mass + 10);
    const E2 = starSize(g.star.mass);
    addBody(g, { x: g.star.x + E2, y: 0, vx: 0, vy: 0, radius: E2 * 1.8, kind: KIND_ROCKY });
    const st0 = g.stage;
    step(g, idle);
    expect(g.graveHits).toBe(1);
    expect(g.stage).toBe(st0 - 1);
    expect(g.over).toBe(OVER_NONE);
  });
  it('un golpe grave en la primera etapa no baja la masa del mínimo', () => {
    const g = guarded(5);
    const E = starSize(g.star.mass);
    addBody(g, { x: g.star.x + E, y: 0, vx: 0, vy: 0, radius: E * 1.8, kind: KIND_ROCKY });
    step(g, idle);
    expect(g.stage).toBe(0);
    expect(g.star.mass).toBeGreaterThanOrEqual(cfg.starStartMass);
  });
});
```

- [ ] **Paso 2: correrlas para ver que fallan**

Correr `npx vitest run tests/unit/planetCapture.test.ts`. Se espera que FALLEN porque no existe el módulo.

- [ ] **Paso 3: implementar**

En `world.ts`, agregar a `World`:
```ts
  readonly planets: Int32Array;    // índices de los planetas de la pantalla (fijo desde que se arma el mapa)
  readonly planetDmg: Float32Array;   // daño acumulado de cada planeta (para partirlo a golpes)
  planetCaptures: number;          // planetas que entraron a tu órbita (evento)
  graveHits: number;               // golpes graves (evento)
```
En `createWorld`:
- `planetDmg: new Float32Array(capacity), planetCaptures: 0, graveHits: 0, planets: new Int32Array(0)`. Como `planets` es `readonly`, declararlo en la interfaz como `planets: Int32Array`;
- al final, antes de `return w`, llenar la lista: `w.planets = Int32Array.from(lista de i con kind entre KIND_ROCKY y KIND_GAS)`. Esto crea objetos, pero sólo al armar el mapa.

En `config.ts`, agregar los campos y valores de las restricciones globales (`planetOrbitGap` … `cometStealMax`), cada uno con su comentario.

```ts
// src/sim/planetCapture.ts
import { STAGES, stageFor } from './stages';
import { returnGathered } from './launch';
import { KIND_GAS, KIND_ROCKY, OVER_DIMMED, starSize, type World } from './world';

// Escalones de los planetas según su tamaño comparado con el de tu estrella (E):
// hasta la mitad entran solos; hasta E hay que partirlos; hasta 1,5·E dañan; más grandes, golpe grave.
export const TIER_CAPTURE = 0, TIER_BREAK = 1, TIER_HURT = 2, TIER_GRAVE = 3;

export const isPlanetKind = (k: number): boolean => k >= KIND_ROCKY && k <= KIND_GAS;

export function planetTier(radius: number, starMass: number): number {
  const E = starSize(starMass);
  if (radius <= 0.5 * E) return TIER_CAPTURE;
  if (radius <= E) return TIER_BREAK;
  if (radius <= 1.5 * E) return TIER_HURT;
  return TIER_GRAVE;
}

// Golpe grave: perdés una etapa entera de masa y rebotás. Sin nada en órbita, la estrella se apaga.
export function graveHit(w: World, p: number): void {
  const c = w.config, s = w.star;
  returnGathered(w);
  if (w.orbitingCount === 0) { w.over = OVER_DIMMED; return; }
  w.graveHits++;
  w.invuln = c.hurtInvuln;
  let nx = s.x - w.x[p], ny = s.y - w.y[p];
  const nd = Math.hypot(nx, ny) || 1;
  s.vx = (nx / nd) * c.hurtBounce * 1.4; s.vy = (ny / nd) * c.hurtBounce * 1.4;
  const st = stageFor(s.mass);
  const width = st > 0 ? STAGES[st]!.mass - STAGES[st - 1]!.mass : s.mass * 0.5;
  s.mass = Math.max(c.starStartMass, s.mass - width);
  w.stage = stageFor(s.mass);
}
```

En `step.ts`:
- importar `graveHit`, `isPlanetKind`, `planetTier`, `TIER_CAPTURE`, `TIER_GRAVE` y `TIER_HURT`;
- en `moveOrbiting`, la franja depende del tipo:
  ```ts
  const planet = isPlanetKind(w.kind[i]!);
  const lo = planet ? bandHi + c.planetOrbitGap : bandLo, hi = planet ? lo + c.planetOrbitSpan : bandHi;
  const target = absorbing ? size * 0.7 : clamp(w.orbitTarget[i], lo, hi);
  ```
- reemplazar la línea del choque (`if (st === FREE && k >= KIND_ROCKY && k <= KIND_GAS && w.radius[i] > size && …) hit = i;`) por:
  ```ts
  const tier = st === FREE && isPlanetKind(k) ? planetTier(w.radius[i], s.mass) : -1;
  if (tier >= TIER_HURT && d < size + w.radius[i] && hit < 0 && w.invuln <= 0) hit = i;
  ```
- en la captura, la condición de tamaño `w.radius[i] <= c.maxCaptureSize` pasa a `(w.radius[i] <= c.maxCaptureSize || tier === TIER_CAPTURE)`, en sus dos lugares. Si lo capturado es un planeta (`tier === TIER_CAPTURE`):
  - `orbitTarget` pasa a `bandHi + c.planetOrbitGap + ((i * 0.618034) % 1) * c.planetOrbitSpan`;
  - se suma `w.planetCaptures++`;
- cambiar `if (hit >= 0) hurt(w, hit);` por `if (hit >= 0) { if (planetTier(w.radius[hit], s.mass) === TIER_GRAVE) graveHit(w, hit); else hurt(w, hit); }`;
- en `hurt`, los cuerpos que se pierden son sólo asteroides y lunas (no planetas): en el bucle, `if (w.state[i] !== ORBITING || isPlanetKind(w.kind[i]!)) continue;`.

En `encounters.ts`, `stepStarFlybys`: cambiar `if (r <= c.maxCaptureSize || r > size) continue;` por `if (r <= Math.max(c.maxCaptureSize, size * 0.5) || r > size) continue;`. Los que entran solos no se esquivan.

- [ ] **Paso 4:** correr `npx vitest run && npm run typecheck`. Se espera que PASE todo; `hurt.test` sigue valiendo (radio 6 contra E 4,5 cae en el escalón que daña). Commit: «Planetas: escalones de captura (entran solos, se parten, dañan o golpe grave) y órbita exterior para los planetas».

---

### Tarea 2: partir planetas a golpes

**Archivos:**
- Modificar:
  - `src/sim/planetCapture.ts`: `hitPlanet` y `stepPlanetHits`;
  - `src/sim/tidal.ts`: extraer `spawnDebris` de `breakPlanet`;
  - `src/sim/world.ts`: `planetBreaks`;
  - `src/sim/step.ts`: llamar a `stepPlanetHits` después de `stepBolts`.
- Prueba: agregar a `tests/unit/planetCapture.test.ts`.

**Interfaces:**
- Produce:
  - `hitPlanet(w, p, dmg): boolean`, que devuelve true si lo partió;
  - `stepPlanetHits(w): void`;
  - `spawnDebris(w, x, y, R, ax, ay, n): void`;
  - `World.planetBreaks`.

- [ ] **Paso 1: pruebas que fallan**

```ts
import { hitPlanet } from '../../src/sim/planetCapture';
import { BOLT, KIND_GAS, PROJECTILE, RETURNING } from '../../src/sim/world';

describe('partir planetas a golpes', () => {
  it('un planeta mediano aguanta golpes según su tamaño y al partirse queda un pedazo que entra solo', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_ROCKY });
    const hp = Math.ceil(cfg.planetHpPerRadius * E * 0.8);
    for (let k = 0; k < hp - 1; k++) expect(hitPlanet(w, p, 1)).toBe(false);
    expect(hitPlanet(w, p, 1)).toBe(true);
    expect(w.planetBreaks).toBe(1);
    expect(w.broken[p]).toBeGreaterThan(0);
    expect(planetTier(w.radius[p], w.star.mass)).toBe(TIER_CAPTURE);
  });
  it('a los que dañan no se los puede partir', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 1.3, kind: KIND_ROCKY });
    for (let k = 0; k < 100; k++) hitPlanet(w, p, 1);
    expect(w.planetBreaks).toBe(0);
  });
  it('un gaseoso partido se achica y suelta escombros, pero no desaparece', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_GAS });
    for (let i = 0; i < 20; i++) { const d = addBody(w, { x: 0, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[d] = 3; }   // reserva de escombros
    hitPlanet(w, p, 1000);
    expect(w.state[p]).toBe(FREE);
    expect(w.broken[p]).toBe(0);
    expect(w.radius[p]).toBeCloseTo(E * 0.8 * cfg.planetBreakKeep, 6);
  });
  it('la honda golpea y rebota; el bólido golpea y queda suelto', () => {
    const w = guarded(100);
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: E * 0.8, kind: KIND_ROCKY });
    const a = addBody(w, { x: 40 - E * 0.8, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[a] = PROJECTILE; w.life[a] = 1;
    const b = addBody(w, { x: 40, y: E * 0.8, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[b] = BOLT; w.life[b] = 1;
    step(w, idle);
    expect(w.state[a]).toBe(RETURNING);
    expect(w.state[b]).toBe(FREE);
    expect(w.planetDmg[p]).toBe(2);
  });
});
```
Unir las importaciones con las de la Tarea 1.

- [ ] **Paso 2: verlas fallar.**

- [ ] **Paso 3: implementar**

En `tidal.ts`:
- extraer el bucle de escombros de `breakPlanet` a `export function spawnDebris(w: World, x: number, y: number, R: number, ax: number, ay: number, n: number): void`, con el mismo cuerpo, usando `x`, `y`, `R` y `n` en lugar de `w.x[i]`, `w.y[i]`, `w.radius[i]` y `c.tidalDebris`. Las velocidades parten de 0 en lugar de `w.vx[i]`/`w.vy[i]`: hay que pasarlas como parámetros `vx` y `vy` para que la marea no cambie;
- la firma final es `spawnDebris(w, x, y, vx, vy, R, ax, ay, n)`;
- `breakPlanet` la llama con `(w, w.x[i], w.y[i], w.vx[i], w.vy[i], R, ax, ay, c.tidalDebris)`. Su comportamiento no cambia, así que `tidal.test` tiene que seguir en verde.

En `planetCapture.ts`:
```ts
// Golpe a un planeta: sólo los que se pueden partir acumulan daño. Al llegar a su aguante se parte:
// los rocosos y helados, en dos pedazos (el dibujo de planeta partido); los gaseosos pierden su envoltura.
// Lo que queda mide la mitad: entra solo a tu órbita. Devuelve true si lo partió.
export function hitPlanet(w: World, p: number, dmg: number): boolean {
  const c = w.config;
  if (w.state[p] !== FREE || planetTier(w.radius[p], w.star.mass) !== TIER_BREAK) return false;
  w.planetDmg[p] = w.planetDmg[p]! + dmg;
  if (w.planetDmg[p]! < Math.ceil(c.planetHpPerRadius * w.radius[p])) return false;
  const R = w.radius[p];
  let ax = w.x[p] - w.star.x, ay = w.y[p] - w.star.y;
  const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
  if (w.kind[p] === KIND_GAS) spawnDebris(w, w.x[p], w.y[p], w.vx[p], w.vy[p], R, ax, ay, c.tidalDebris);
  else breakPlanet(w, p, ax, ay, false);
  w.radius[p] = R * c.planetBreakKeep;
  w.mass[p] = w.radius[p] ** 3;
  w.planetDmg[p] = 0;
  w.planetBreaks++;
  return true;
}

// Honda y bólido contra planetas sueltos: la honda rebota (vuelve) y el bólido queda suelto donde pegó.
export function stepPlanetHits(w: World): void {
  const c = w.config, P = w.planets;
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st !== PROJECTILE && st !== BOLT) continue;
    for (let k = 0; k < P.length; k++) {
      const p = P[k]!;
      if (w.state[p] !== FREE) continue;
      const r = w.radius[p] + w.radius[i];
      const dx = w.x[i] - w.x[p], dy = w.y[i] - w.y[p];
      if (dx * dx + dy * dy >= r * r) continue;
      if (st === PROJECTILE) { w.state[i] = RETURNING; hitPlanet(w, p, 1); }
      else { w.state[i] = FREE; w.vx[i] *= 0.2; w.vy[i] *= 0.2; w.noCatch[i] = c.boltNoCatch; hitPlanet(w, p, 1); }
      break;
    }
  }
}
```
Importar `breakPlanet` y `spawnDebris` desde `./tidal`, y `BOLT, FREE, PROJECTILE, RETURNING` desde `./world`. Sumar `planetBreaks: number` a `World` (en `createWorld`, `planetBreaks: 0`). En `step.ts`, dentro del bloque `if (!hunting) {`, después de `stepBolts(w, bandHi);`, agregar `stepPlanetHits(w);`.

- [ ] **Paso 4:** correr `npx vitest run && npm run typecheck`. Se espera que PASE. Commit: «Planetas: se parten a golpes de honda o con el bólido, y el pedazo que queda entra solo».

---

### Tarea 3: habilidades por cantidad de planetas

**Archivos:**
- Crear: `src/sim/abilities.ts`
- Modificar:
  - `src/sim/world.ts`: `ability`, `planetsHeld`, `abilityUps` y `abilityDowns`;
  - `src/sim/step.ts`: nivel al final del paso; radio de captura; escudo en `hurt`;
  - `src/sim/launch.ts`: tope del bólido.
- Prueba: `tests/unit/abilities.test.ts`

**Interfaces:**
- Produce:
  - `planetsInOrbit(w): number`;
  - `abilityLevel(w): number`, de 0 a 3;
  - `stepAbilities(w): void`;
  - `ABILITY_NAMES: readonly string[]`, con `['', 'GRAVEDAD AMPLIADA', 'ESCUDO DE ÓRBITA', 'BÓLIDO MAYOR']`.

- [ ] **Paso 1: pruebas que fallan**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { abilityLevel, planetsInOrbit } from '../../src/sim/abilities';
import { type Intent, step } from '../../src/sim/step';
import { addBody, captureRadiusFor, createWorld, FREE, GATHERING, KIND_ASTEROID, KIND_ROCKY, ORBITING, type World } from '../../src/sim/world';

const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
// Mundo con 20 planetas lejanos (la pantalla) y N de ellos en tu órbita.
function system(held: number): World {
  const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 20, blackHole: false, cometFirst: 1e9 }, 4, 80);
  w.star.mass = 200;
  for (let k = 0; k < held; k++) { const p = w.planets[k]!; w.state[p] = ORBITING; w.orbitR[p] = 30; w.orbitTarget[p] = 30; w.orbitAngle[p] = k; w.orbitingCount++; }
  for (let k = 0; k < 6; k++) { const a = addBody(w, { x: 8, y: k, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[a] = ORBITING; w.orbitR[a] = 9; w.orbitTarget[a] = 9; w.orbitAngle[a] = k; w.orbitingCount++; }
  step(w, idle);
  return w;
}

describe('habilidades por cantidad de planetas', () => {
  it('el nivel sale del porcentaje de planetas de la pantalla en tu órbita', () => {
    expect(abilityLevel(system(2))).toBe(0);    // 10 %
    expect(abilityLevel(system(3))).toBe(1);    // 15 %
    expect(abilityLevel(system(6))).toBe(2);    // 30 %
    expect(abilityLevel(system(9))).toBe(3);    // 45 %
    expect(planetsInOrbit(system(6))).toBe(6);
  });
  it('gravedad ampliada: el radio de captura crece', () => {
    const w = system(3);
    expect(w.star.captureRadius).toBeCloseTo(captureRadiusFor(w.config, w.star.mass) * w.config.abilityGravityMul, 6);
  });
  it('escudo de órbita: un golpe que daña suelta un planeta exterior en lugar de asteroides', () => {
    const w = system(6);
    const ast0 = 6;
    const big = addBody(w, { x: w.star.x + 15, y: 0, vx: 0, vy: 0, radius: 15, kind: KIND_ROCKY });
    w.radius[big] = 13;   // daña (E de masa 200 ≈ 11) pero no es grave
    step(w, idle);
    expect(w.hits).toBe(1);
    let ast = 0;
    for (let i = 0; i < w.count; i++) if (w.state[i] === ORBITING && w.kind[i] === KIND_ASTEROID) ast++;
    expect(ast).toBe(ast0);
    expect(planetsInOrbit(w)).toBe(5);
  });
  it('bólido mayor: el tope sube; al perder la habilidad, lo ya juntado sale igual', () => {
    const w = system(9);
    for (let k = 0; k < 30; k++) { const a = addBody(w, { x: 8, y: k * 0.1, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[a] = ORBITING; w.orbitR[a] = 9; w.orbitTarget[a] = 9; w.orbitAngle[a] = k * 0.2; w.orbitingCount++; }
    const hold: Intent = { targetX: 0, targetY: 0, hasTarget: false, hold: true, aimX: 100, aimY: 0, hasAim: true };
    for (let k = 0; k < 60 * 5; k++) step(w, hold);
    expect(w.gathered).toBe(w.config.boltMax + w.config.abilityBoltBonus);
    for (let k = 0; k < 5; k++) { const p = w.planets[k]!; w.state[p] = FREE; w.orbitingCount--; }
    step(w, hold);
    const g = w.gathered;
    expect(g).toBe(w.config.boltMax + w.config.abilityBoltBonus);
    step(w, { ...hold, hold: false });
    expect(w.lastBoltSize).toBe(g);
    let left = 0; for (let i = 0; i < w.count; i++) if (w.state[i] === GATHERING) left++;
    expect(left).toBe(0);
  });
  it('las habilidades se pierden al bajar del umbral', () => {
    const w = system(3);
    expect(w.ability).toBe(1);
    const p = w.planets[0]!; w.state[p] = FREE; w.orbitingCount--;
    step(w, idle);
    expect(w.ability).toBe(0);
    expect(w.abilityDowns).toBe(1);
  });
});
```

- [ ] **Paso 2: verlas fallar.**

- [ ] **Paso 3: implementar**

```ts
// src/sim/abilities.ts
import { isPlanetKind } from './planetCapture';
import { ORBITING, type World } from './world';

// Habilidades por cantidad de planetas en tu órbita, sobre el total de planetas de la pantalla.
// Se pierden si bajás del umbral (por ejemplo, si un cometa te roba un planeta).
export const ABILITY_NAMES: readonly string[] = ['', 'GRAVEDAD AMPLIADA', 'ESCUDO DE ÓRBITA', 'BÓLIDO MAYOR'];

export function planetsInOrbit(w: World): number {
  let n = 0;
  for (let k = 0; k < w.planets.length; k++) { const p = w.planets[k]!; if (w.state[p] === ORBITING && isPlanetKind(w.kind[p]!)) n++; }
  return n;
}

export function abilityLevel(w: World): number {
  const total = w.planets.length;
  if (total === 0) return 0;
  const f = planetsInOrbit(w) / total, c = w.config;
  return f >= c.ability3 - 1e-9 ? 3 : f >= c.ability2 - 1e-9 ? 2 : f >= c.ability1 - 1e-9 ? 1 : 0;
}

export function stepAbilities(w: World): void {
  w.planetsHeld = planetsInOrbit(w);
  const lvl = abilityLevel(w);
  if (lvl > w.ability) w.abilityUps++; else if (lvl < w.ability) w.abilityDowns++;
  w.ability = lvl;
}
```
(`abilityLevel` vuelve a contar; con 40 planetas no pesa.)

En `World`: `ability: number; planetsHeld: number; abilityUps: number; abilityDowns: number;`, con 0 en `createWorld`.

En `step.ts`:
- antes de `s.captureRadius = …`, llamar a `stepAbilities(w);`;
- la línea del radio pasa a `s.captureRadius = captureRadiusFor(c, s.mass) * (w.ability >= 1 ? c.abilityGravityMul : 1);`;
- en `hurt`, después de `w.hits++; w.invuln = …;` y del rebote, si `w.ability >= 2` y hay un planeta en órbita:
  - soltar el de mayor `orbitR` (estado FREE, velocidad hacia afuera `lostSpeed`, `noCatch`, `orbitingCount--`, restar su masa a la estrella);
  - hacer `return` sin perder asteroides.

En `launch.ts`, el tope pasa a `const max = c.boltMax + (w.ability >= 3 ? c.abilityBoltBonus : 0);` y se usa en lugar de `c.boltMax`. `launchBolt` no recorta: lanza todos los que están juntados.

- [ ] **Paso 4:** correr `npx vitest run && npm run typecheck`. Commit: «Habilidades por planetas en órbita: gravedad ampliada, escudo de órbita y bólido mayor».

---

### Tarea 4: cometas que roban más y sueltan todo

**Archivos:**
- Modificar:
  - `src/sim/comets.ts`: robo múltiple, arrastre en fila y liberación;
  - `src/sim/phase.ts`: el colapso suelta todo lo arrastrado;
  - `src/sim/world.ts`: `lastStealCount` y el comentario de `carry`, que ahora es una cantidad.
- Prueba: actualizar en `tests/unit/comets.test.ts` las pruebas «al tocarla le roba…» y «un bólido lo destruye…», y agregar una de planetas en `tests/unit/abilities.test.ts`.

- [ ] **Paso 1: pruebas que fallan**

En `comets.test.ts`, reemplazar la prueba «al tocarla le roba un mundo…» por:
```ts
  it('al tocarla le roba de 3 a 5 cuerpos, los arrastra en fila y huye; después vuelve a cazar', () => {
    const w = createWorld(cfg(), 2, 20);
    withOrbit(w, 8);
    const k = spawnComet(w, 3, 0);
    step(w, IDLE);
    const n = w.comets.carry[k]!;
    expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(5);
    expect(w.lastStealCount).toBe(n);
    expect(w.orbitingCount).toBe(8 - n);
    expect(w.cometSteals).toBe(1);
    expect(w.comets.mode[k]).toBe(2);
    for (let s = 0; s < 60; s++) step(w, IDLE);
    for (let i = 0; i < w.count; i++) if (w.state[i] === CARRIED) expect(Math.hypot(w.x[i] - w.comets.x[k]!, w.y[i] - w.comets.y[k]!)).toBeLessThan(14);
    for (let s = 0; s < DEFAULT_CONFIG.cometFleeTime * 60; s++) step(w, IDLE);
    expect(w.comets.mode[k]).toBe(1);
  });
```
En la prueba del bólido: después del golpe, ningún cuerpo queda en `CARRIED`.

En `abilities.test.ts`:
```ts
  it('desde el segundo escalón, un cometa también puede llevarse un planeta, y al morir suelta todo', () => {
    let stolePlanet = false;
    for (let seed = 1; seed <= 6 && !stolePlanet; seed++) {
      const w = system(6);
      const k = spawnComet(w, w.star.x + 2, w.star.y);
      step(w, idle);
      for (let i = 0; i < w.count; i++) if (w.state[i] === CARRIED && w.kind[i] === KIND_ROCKY) stolePlanet = true;
      w.comets.hp[k] = 0.5;
      const b = addBody(w, { x: w.comets.x[k]!, y: w.comets.y[k]!, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID }); w.state[b] = BOLT; w.life[b] = 1;
      step(w, idle);
      for (let i = 0; i < w.count; i++) expect(w.state[i]).not.toBe(CARRIED);
      w.rng.next(); // otra tirada en la próxima vuelta
    }
    expect(stolePlanet).toBe(true);
  });
```
Importar `spawnComet`, `BOLT` y `CARRIED`. Sumar una prueba en `phase.test.ts`: colapsar con un cometa que lleva 3 cuerpos deja los 3 libres.

- [ ] **Paso 2: verlas fallar.**

- [ ] **Paso 3: implementar en `comets.ts`**
- `spawnComet`: `cm.carry[k] = 0`.
- **Robo:** reemplazar el bloque que roba un mundo por esto. La condición es `cm.carry[k] === 0` y `orbitingCount > 0`. Se roban `n = cometStealMin + floor(rng.next() × (cometStealMax − cometStealMin + 1))` cuerpos: asteroides y lunas en órbita (no planetas), siempre el más cercano al cometa. Por cada uno: `state = CARRIED`, `parent = k`, `orbitingCount--` y restar su masa a la estrella. Si `w.ability >= 2` y `rng.next() < 0.5`, roba además el planeta en órbita de menor radio. Al final: `cm.carry[k] = robados`, `w.lastStealCount = robados` y, si se robó algo, `w.cometSteals++`.
- **Arrastre:** reemplazar el bloque «Lo robado va arrastrado…» por un recorrido de los `CARRIED` con `parent === k`. El cuerpo j-ésimo va a `x − dir·(4 + 1,6·j)`, con un corrimiento lateral de `((j % 2) ? 1 : −1)·0,6`, y se mantiene la corrección de la vuelta del mapa.
- **`damage`, al morir:** soltar todos los `CARRIED` con `parent === k` (estado FREE, `parent = −1`, velocidad 0,4 × la del cometa y `noCatch` de 0,3). Después, `cm.carry[k] = 0`.

En `phase.ts`, `startCollapse` suelta todos los `CARRIED` (FREE, `parent = −1`, velocidad 0 y `noCatch` 0) y pone `carry` en 0.

- [ ] **Paso 4:** correr `npx vitest run && npm run typecheck`. Commit: «Cometas: roban de 3 a 5 cuerpos (y un planeta desde el segundo escalón) y al destruirlos sueltan todo».

---

### Tarea 5: marcas de peligro y visor

**Archivos:**
- Crear: `src/render/fx/dangerMarks.ts`
- Modificar: `src/render/layers.ts`, `src/ui/hud.ts` y `src/ui/hud.css`
- Prueba: `tests/e2e/planets.spec.ts`

- [ ] **Paso 1: prueba de navegador que falla**

```ts
// tests/e2e/planets.spec.ts
import { expect, test } from '@playwright/test';

test('marcas de peligro alrededor de los planetas cercanos, y el visor del sistema', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.locator('.hud .sys')).toContainText('PLANETAS');
  // Acercar a la estrella un planeta de cada escalón (sin que la toquen).
  await page.evaluate(() => {
    const w = window.__GAME__!.world; const s = w.star; const E = 4 + 0.5 * Math.sqrt(s.mass);
    const set = (k: number, dx: number, dy: number, r: number): void => { const p = w.planets[k]!; w.x[p] = w.prevX[p] = s.x + dx; w.y[p] = w.prevY[p] = s.y + dy; w.vx[p] = 0; w.vy[p] = 0; w.radius[p] = r; w.mass[p] = r ** 3; };
    set(0, 22, 0, E * 0.8); set(1, -24, 0, E * 1.3); set(2, 0, 26, E * 1.8);
  });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.__GAME__!.diagnostics.dangerMarks)).toBe(3);
  await page.screenshot({ path: 'artifacts/e2e/marcas-de-peligro.png' });
});
```
Sumar `dangerMarks: number` a `Diagnostics` (en `spaceView.ts`) y a su objeto inicial. La capa de marcas lo escribe a través de `ctx`, que agrega el campo opcional `marks?: { count: number }`, compartido con `diagnostics` en `spaceView`. Si queda más limpio, `buildLayers` puede devolver una referencia a la capa y `spaceView` copiar `layer.shown` a `diagnostics.dangerMarks` después de `update`.

- [ ] **Paso 2: verla fallar.**

- [ ] **Paso 3: la capa de marcas**

```ts
// src/render/fx/dangerMarks.ts
// Marcas de peligro minimalistas: un arco fino alrededor de los planetas cercanos que podrías chocar.
// Trazos verde fósforo: se puede partir. Ámbar: daña. Rojo: golpe grave. Lo que entra solo no lleva marca.
// Aparecen y se apagan de a poco (la opacidad de cada planeta sigue a su objetivo).
```
Implementación:
- **12 mallas** (`PlaneGeometry(2, 2)`), cada una con su `ShaderMaterial`. Uniformes: `uColor` (`Vector3`), `uDash` (0 o 1) y `uAlpha`.
- **Fragment shader:**
  ```glsl
  float r = length(vUv);
  float ring = exp(-pow((r - .86) / .02, 2.));
  float a = atan(vUv.y, vUv.x);
  float dash = uDash > .5 ? step(.5, fract(a * 6. / 3.14159)) : 1.;
  gl_FragColor = vec4(uColor * ring * dash * uAlpha, 1.);
  ```
  Es aditivo, sin `depthWrite`.
- **Estado:** un `Float32Array(world.capacity)` con la opacidad de cada planeta.
- **En `update`,** para cada `p` de `world.planets` con estado FREE:
  - calcular `tier = planetTier(r, masa)` y `gap = dist − E − r`;
  - el objetivo es 1 si `tier >= TIER_BREAK && gap < 35`; si no, 0;
  - suavizar con `alpha += (objetivo − alpha)·min(1, dt·4)`.
- **Asignación:** los que tienen `alpha > 0,01` se asignan a las mallas en orden, hasta 12.
- **Cada malla usada:**
  - posición en el planeta (la interpolada, como en `brokenPlanets`) y escala `r·1,45`;
  - la `quaternion` de la cámara;
  - color según el escalón: `(0,48, 0,96, 0,79)`, `(1, 0,69, 0)` y `(1, 0,23, 0,18)`;
  - `uDash` en 1 sólo para los que se pueden partir.
- **Las sobrantes** se ocultan.
- **`shown`** (la cantidad de marcas visibles) se expone para el diagnóstico.

Agregarla en `layers.ts` después de `createImpactLayer()`.

- [ ] **Paso 4: el visor**

En `hud.ts`:
- en la fila de abajo, `<span class="sys">PLANETAS 00/00</span>`;
- a 10 Hz:
  - `PLANETAS ${pad(w.planetsHeld,2)}/${pad(next,2)}`, donde `next` es el próximo umbral (`ceil(total × ability{n+1})`), o `MÁX`;
  - si `w.ability > 0`, sumar ` · ${ABILITY_NAMES[w.ability]}`.

Registro (con `seen` para cada contador):
- `planetCaptures`: 'PLANETA CAPTURADO: ENTRÓ A TU ÓRBITA';
- `planetBreaks`: 'PARTISTE UN PLANETA: EL PEDAZO ES TUYO';
- `graveHits`: 'GOLPE GRAVE: PERDISTE UNA ETAPA', en ámbar;
- `abilityUps`: `HABILIDAD: ${ABILITY_NAMES[w.ability]}`;
- `abilityDowns`: 'PERDISTE UNA HABILIDAD';
- el aviso de robo de cometas pasa a `UN COMETA SE LLEVÓ ${w.lastStealCount} CUERPOS DE TU ÓRBITA`.

En `hud.css`, `.hud .sys` toma el mismo estilo que los otros elementos de `.bottom`.

- [ ] **Paso 5:** correr `npx vitest run && npm run typecheck && npx playwright test --project=web`. Mirar `marcas-de-peligro.png`: tienen que verse tres arcos finos con sus tres colores, sin tapar los planetas. Commit: «Marcas de peligro alrededor de los planetas cercanos y visor del sistema (planetas, habilidades y avisos)».

---

### Tarea 6: verificación final

- [ ] `npm run bench`: el p99 cerca de 5,7 ms. El banco tiene 300 cuerpos, así que la capa de marcas y `stepPlanetHits` se notan si son caros.
- [ ] `npm run balance`: anotar las victorias. Los planetas suman mucha masa, así que puede facilitar ganar; si el bot gana más de 3 de 5, anotarlo para ajustar en la Entrega 6.
- [ ] `npm run test:electron`.
- [ ] Revisión final de la rama con un revisor nuevo y una sola pasada de correcciones.
- [ ] Bitácora en Notion y `git push`.
