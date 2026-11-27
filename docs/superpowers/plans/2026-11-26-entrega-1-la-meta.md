# Entrega 1: la meta — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que la partida tenga una meta que se pueda ganar:
1. crecer hasta hipergigante;
2. superar en masa al agujero negro rival;
3. colapsar (supernova) apretando una tecla;
4. cazar al rival siendo un agujero negro, con tiempo límite;
5. fusionarse y ganar.

**Arquitectura:**
- La partida gana fases en la simulación: `world.phase`, con los valores `PLAY`, `COLLAPSE`, `HUNT` y `MERGE`. Los finales siguen en `world.over`, que suma `OVER_ESCAPED` y `OVER_WON`.
- Las cinemáticas avanzan con un guion fijo dentro de la simulación, de modo que la partida sigue siendo determinista.
- El dibujo lee la fase y su tiempo (`phaseTime`):
  - la estrella late, tiene erupciones y se encoge al colapsar;
  - aparece un segundo agujero negro, el tuyo;
  - una capa DOM pone las bandas, el destello y las ondas.

**Tecnologías:** TypeScript, Three.js, Vitest y Playwright.

**Especificación:** `docs/superpowers/specs/2026-11-26-meta-colapso-pantallas-design.md`:
- §1 y §2: ciclo, barras y caza;
- §7: lo visual;
- §8: fases;
- §9: Entrega 1;
- §11: decisiones confirmadas.

## Restricciones globales

- Todo lo que ve el jugador, los comentarios y los commits van en español rioplatense.
- `src/sim/` sigue siendo puro y determinista. No se crean objetos dentro de `step`; los arrays tipados y los campos escalares se crean en `createWorld`.
- No se agregan dependencias.
- Decisiones de Lucas:
  - **el colapso lo disparás vos** (tecla ESPACIO o botón Y del mando);
  - **la caza tiene tiempo límite**;
  - si se acaba el tiempo, perdés porque el rival se escapó.
- Valores iniciales, todos en `SimConfig` (se ajustan con el bot en la Tarea 3):
  - `rivalMassScale: 50` (masa del rival en la carrera = 50 × `bh.mass`);
  - `collapseTime: 6`;
  - `mergeTime: 5`;
  - `huntTimeLimit: 60`;
  - `huntFleeSpeed: 14`;
  - `huntSwallowFactor: 1.2`;
  - `huntStartMaxDist: 260`.
- Nueva etapa: `{ name: 'HIPERGIGANTE', mass: 280 }`, la sexta. Se exporta `STAGE_HYPER = 5`.
- Valores de las fases: `PHASE_PLAY = 0`, `PHASE_COLLAPSE = 1`, `PHASE_HUNT = 2` y `PHASE_MERGE = 3`. Finales nuevos: `OVER_ESCAPED = 3` y `OVER_WON = 4`.
- Las cinemáticas arrancan simples; se pulen en otra entrega. El eclipse sigue como está, porque se elimina en la Entrega 2.
- Commits terminados con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VCDQYR4GnVKDakJf79PRaF
  ```

## Puntos a revisar

1. **Apretar ESPACIO cuando todavía no se puede colapsar no hace nada, y tampoco queda «guardado».** Si después se cumplen las condiciones, no colapsa solo. Se prueba en la Tarea 2.
2. **Colapsar con un cometa llevándose un cuerpo, o con proyectiles en vuelo.** Al empezar el colapso, los cometas se apagan y sueltan lo que llevaban, y los proyectiles quedan libres. Nada queda colgado durante la caza. Se prueba en la Tarea 2.
3. **Que el rival esté muy lejos cuando empieza la caza.** Con más de media arena de distancia, la vuelta del mapa lo haría ir y venir. Al empezar la caza se acerca, fuera de cámara, a `huntStartMaxDist`. Se prueba en la Tarea 2.
4. **El laboratorio y el banco tienen el agujero negro apagado.** Ahí no se muestran las barras ni el aviso, y no aparece tu agujero negro. Se prueba en la Tarea 4, con la prueba del laboratorio existente sin errores.
5. **Las teclas durante el fin de partida o la cinemática no hacen nada raro:** ESPACIO no reinicia ni vuelve a colapsar. Se prueba en la Tarea 2: un colapso repetido durante `COLLAPSE` no reinicia `phaseTime`.

---

### Tarea 1: la hipergigante, la masa del rival y la configuración

**Archivos:**
- Modificar: `src/sim/stages.ts`, `src/sim/config.ts`
- Crear: `src/sim/phase.ts`, con las funciones de consulta (las transiciones vienen en la Tarea 2)
- Prueba: `tests/unit/phase.test.ts` (primera parte), y una línea nueva en `tests/unit/stages.test.ts`

**Interfaces:**
- Produce:
  - `STAGE_HYPER = 5`;
  - `rivalMass(w: World): number`;
  - `playerHoleRadius(w: World): number`;
  - los campos nuevos de `SimConfig` listados en las restricciones globales.

- [ ] **Paso 1: escribir las pruebas que fallan**

Agregar a `tests/unit/stages.test.ts`, dentro de `describe('etapas de la estrella'`:
```ts
  it('la hipergigante es la última etapa, desde masa 280', () => {
    expect(STAGES[STAGE_HYPER]!.name).toBe('HIPERGIGANTE');
    expect(STAGES.length - 1).toBe(STAGE_HYPER);
    expect(stageFor(279.9)).toBe(4);
    expect(stageFor(280)).toBe(STAGE_HYPER);
  });
```
(Sumar `STAGE_HYPER` a la importación de `../../src/sim/stages`.)

Crear `tests/unit/phase.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { playerHoleRadius, rivalMass } from '../../src/sim/phase';
import { createWorld } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9 };

describe('la carrera de masa', () => {
  it('la masa del rival es la del agujero negro por la escala', () => {
    const w = createWorld(cfg, 3, 50);
    w.bh.mass = 4;
    expect(rivalMass(w)).toBe(4 * cfg.rivalMassScale);
  });
  it('tu agujero negro crece con tu masa y, con la misma masa en la carrera, mide como el rival', () => {
    const w = createWorld(cfg, 3, 50);
    w.star.mass = 300;
    const r1 = playerHoleRadius(w);
    w.star.mass = 600;
    expect(playerHoleRadius(w)).toBeGreaterThan(r1);
    w.bh.mass = 600 / cfg.rivalMassScale;
    expect(playerHoleRadius(w)).toBeCloseTo(cfg.bhStartRadius * Math.cbrt(w.bh.mass), 9);
  });
});
```

- [ ] **Paso 2: correrlas para verificar que fallan**

Correr: `npx vitest run tests/unit/stages.test.ts tests/unit/phase.test.ts`
Se espera que FALLEN: no existe `STAGE_HYPER` ni `src/sim/phase`.

- [ ] **Paso 3: implementar**

En `src/sim/stages.ts`:
- cambiar el comentario de cabecera a «Etapas de la estrella del jugador según su masa. La última es la hipergigante: desde ahí se puede colapsar»;
- agregar al final de `STAGES`: `  { name: 'HIPERGIGANTE', mass: 280 },`;
- después del arreglo, sumar:
```ts
// Índice de la hipergigante: la única etapa desde la que se puede colapsar.
export const STAGE_HYPER = 5;
```

En `src/sim/config.ts`, agregar a la interfaz `SimConfig`, después de `crashChance`:
```ts
  rivalMassScale: number;        // masa del rival en la carrera = esto × la masa física del agujero negro
  collapseTime: number;          // segundos de la cinemática del colapso (supernova y nacimiento)
  mergeTime: number;             // segundos de la cinemática de la fusión
  huntTimeLimit: number;         // segundos para alcanzar al rival en la caza; si no, se escapa
  huntFleeSpeed: number;         // velocidad del rival cuando huye
  huntSwallowFactor: number;     // tu agujero negro traga lo que pasa a menos de (su radio × esto)
  huntStartMaxDist: number;      // al empezar la caza, el rival nunca queda más lejos que esto
```
Y a `DEFAULT_CONFIG`, después de `crashChance: ...,`:
```ts
  rivalMassScale: 50,
  collapseTime: 6,
  mergeTime: 5,
  huntTimeLimit: 60,
  huntFleeSpeed: 14,
  huntSwallowFactor: 1.2,
  huntStartMaxDist: 260,
```

Crear `src/sim/phase.ts`:
```ts
import type { World } from './world';

// La meta de la pantalla: superar en masa al agujero negro rival, colapsar, cazarlo y fusionarse.
// Masa del rival en la misma escala que la tuya (la de las barras).
export function rivalMass(w: World): number {
  return w.config.rivalMassScale * w.bh.mass;
}

// Radio de tu agujero negro: la misma fórmula que el rival, con tu masa pasada a su escala.
export function playerHoleRadius(w: World): number {
  return w.config.bhStartRadius * Math.cbrt(Math.max(w.star.mass, 1e-6) / w.config.rivalMassScale);
}
```

- [ ] **Paso 4: correr las pruebas**

Correr: `npx vitest run`
Se espera que PASE todo. Si alguna prueba vieja asumía cinco etapas, adaptarla: `stageFor(1e9)` usa `STAGES.length - 1`, así que ya tiene que andar.

- [ ] **Paso 5: commit**

```bash
git add src/sim/stages.ts src/sim/config.ts src/sim/phase.ts tests/unit/stages.test.ts tests/unit/phase.test.ts
git commit -m "Meta: etapa hipergigante, masa del rival en la carrera y configuración de las fases"
```

---

### Tarea 2: las fases en la simulación (colapso, caza, fusión y finales)

**Archivos:**
- Modificar:
  - `src/sim/world.ts`: constantes y campos de fase;
  - `src/sim/step.ts`: `Intent.collapse`, cinemática, caza y extracción de `moveOrbiting`;
  - `src/sim/phase.ts`: transiciones.
- Prueba: `tests/unit/phase.test.ts` (segunda parte)

**Interfaces:**
- Consume: `rivalMass`, `playerHoleRadius` y `STAGE_HYPER` (Tarea 1).
- Produce:
  - en `world.ts`: `PHASE_PLAY = 0, PHASE_COLLAPSE = 1, PHASE_HUNT = 2, PHASE_MERGE = 3, OVER_ESCAPED = 3, OVER_WON = 4`;
  - campos de `World`: `phase: number; phaseTime: number; mergeR: number; mergeA: number`;
  - `Intent.collapse?: boolean`;
  - en `phase.ts`: `canCollapse(w): boolean`, `startCollapse(w): void`, `startHunt(w): void`, `startMerge(w): void` y `stepMerge(w): void`.

- [ ] **Paso 1: escribir las pruebas que fallan** (agregar al final de `tests/unit/phase.test.ts`; unir las importaciones con las de la Tarea 1 al principio del archivo)

```ts
import { canCollapse } from '../../src/sim/phase';
import { STAGE_HYPER } from '../../src/sim/stages';
import { type Intent, step } from '../../src/sim/step';
import { addBody, CARRIED, DEAD, FREE, hashWorld, KIND_ASTEROID, ORBITING, OVER_ESCAPED, OVER_NONE, OVER_WON, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, PHASE_PLAY, PROJECTILE, type World } from '../../src/sim/world';

const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
const press: Intent = { targetX: 0, targetY: 0, hasTarget: false, collapse: true };
const run = (w: World, secs: number, it: Intent = idle): void => { for (let k = 0; k < Math.round(secs * 60); k++) step(w, it); };
function hyperWorld(): World {
  const w = createWorld(cfg, 3, 50);
  w.star.mass = 1000; w.bh.mass = 2;
  w.bh.x = w.bh.prevX = 200; w.bh.y = w.bh.prevY = 0;
  step(w, idle);   // actualiza la etapa
  return w;
}
function huntWorld(): World {
  const w = hyperWorld();
  step(w, press);
  run(w, cfg.collapseTime + 0.05);
  return w;
}

describe('fases de la partida', () => {
  it('se puede colapsar siendo hipergigante y más pesado que el rival', () => {
    const w = hyperWorld();
    expect(w.stage).toBe(STAGE_HYPER);
    expect(canCollapse(w)).toBe(true);
    w.bh.mass = 1000 / cfg.rivalMassScale;   // empate: no alcanza
    expect(canCollapse(w)).toBe(false);
    const chica = createWorld(cfg, 3, 50);
    chica.star.mass = 200; chica.bh.mass = 1; step(chica, idle);
    expect(canCollapse(chica)).toBe(false);   // más pesada, pero no hipergigante
  });
  it('apretar antes de tiempo no hace nada ni queda guardado', () => {
    const w = createWorld(cfg, 3, 50);
    w.star.mass = 200; w.bh.mass = 1; step(w, press);
    expect(w.phase).toBe(PHASE_PLAY);
    w.star.mass = 1000; run(w, 0.5);
    expect(w.phase).toBe(PHASE_PLAY);
  });
  it('al apretar colapsa: la cinemática dura collapseTime, la estrella queda quieta y apretar de nuevo no la reinicia', () => {
    const w = hyperWorld();
    step(w, press);
    expect(w.phase).toBe(PHASE_COLLAPSE);
    const x0 = w.star.x, y0 = w.star.y;
    run(w, 2, press);
    expect(w.phaseTime).toBeGreaterThan(1.9);
    run(w, cfg.collapseTime - 2 - 0.1);
    expect(w.phase).toBe(PHASE_COLLAPSE);
    expect(w.star.x).toBe(x0); expect(w.star.y).toBe(y0);
    run(w, 0.2);
    expect(w.phase).toBe(PHASE_HUNT);
  });
  it('durante el colapso la órbita sigue girando, y los cometas y proyectiles sueltan todo', () => {
    const w = hyperWorld();
    const a = addBody(w, { x: 8, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    step(w, idle);
    expect(w.state[a]).toBe(ORBITING);
    const p = addBody(w, { x: 30, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[p] = PROJECTILE; w.life[p] = 2;
    const c = addBody(w, { x: 60, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    w.state[c] = CARRIED; w.comets.mode[0] = 1; w.comets.carry[0] = c;
    step(w, press);
    expect(w.state[p]).toBe(FREE);
    expect(w.state[c]).toBe(FREE);
    expect(w.comets.mode[0]).toBe(0);
    const ang = w.orbitAngle[a];
    run(w, 1);
    expect(w.state[a]).toBe(ORBITING);
    expect(w.orbitAngle[a]).not.toBe(ang);
  });
  it('en la caza el rival huye y tragás lo que tocás', () => {
    const w = huntWorld();
    expect(w.phase).toBe(PHASE_HUNT);
    const d0 = Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y);
    run(w, 1);
    expect(Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y)).toBeGreaterThan(d0);
    const m0 = w.star.mass;
    const b = addBody(w, { x: w.star.x + 1, y: w.star.y, vx: 0, vy: 0, radius: 0.8, kind: KIND_ASTEROID });
    step(w, idle);
    expect(w.state[b]).toBe(DEAD);
    expect(w.star.mass).toBeGreaterThan(m0);
  });
  it('al empezar la caza el rival nunca queda más lejos que huntStartMaxDist', () => {
    const w = hyperWorld();
    w.bh.x = w.bh.prevX = 500;
    step(w, press);
    run(w, cfg.collapseTime + 0.05);
    expect(Math.hypot(w.bh.x - w.star.x, w.bh.y - w.star.y)).toBeLessThanOrEqual(cfg.huntStartMaxDist + 1);
  });
  it('al alcanzarlo hay fusión y ganás', () => {
    const w = huntWorld();
    w.bh.x = w.bh.prevX = w.star.x + playerHoleRadius(w) * 0.5; w.bh.y = w.bh.prevY = w.star.y;
    step(w, idle);
    expect(w.phase).toBe(PHASE_MERGE);
    run(w, cfg.mergeTime - 0.1);
    expect(w.over).toBe(OVER_NONE);
    run(w, 0.2);
    expect(w.over).toBe(OVER_WON);
    expect(w.bh.active).toBe(false);
  });
  it('si no lo alcanzás a tiempo, se escapa', () => {
    const w = huntWorld();
    run(w, cfg.huntTimeLimit + 0.1);
    expect(w.over).toBe(OVER_ESCAPED);
  });
  it('todo el recorrido es determinista', () => {
    const play = (): number => {
      const w = hyperWorld();
      step(w, press);
      const chase: Intent = { targetX: 0, targetY: 0, hasTarget: true };
      for (let k = 0; k < 60 * 20; k++) { chase.targetX = w.bh.x; chase.targetY = w.bh.y; step(w, chase); }
      return hashWorld(w) ^ (w.phase * 7919) ^ (w.over * 104729);
    };
    expect(play()).toBe(play());
  });
});
```

- [ ] **Paso 2: correrlas para verificar que fallan**

Correr: `npx vitest run tests/unit/phase.test.ts`
Se espera que FALLEN: faltan las constantes y `canCollapse`.

- [ ] **Paso 3: campos y constantes en `src/sim/world.ts`**

Después de `export const OVER_DIMMED = 2; ...`:
```ts
export const OVER_ESCAPED = 3;   // en la caza, el rival se escapó (se acabó el tiempo)
export const OVER_WON = 4;       // te fusionaste con el rival: ganaste la pantalla
export const PHASE_PLAY = 0;     // crecer
export const PHASE_COLLAPSE = 1; // cinemática: supernova y nacimiento de tu agujero negro
export const PHASE_HUNT = 2;     // sos el agujero negro y cazás al rival
export const PHASE_MERGE = 3;    // cinemática: la fusión
```
En la interfaz `World`, después de `over: number; ...`:
```ts
  phase: number;       // PHASE_*: en qué parte de la pantalla estás
  phaseTime: number;   // segundos desde que empezó la fase
  mergeR: number; mergeA: number;   // espiral de la fusión: distancia y ángulo del rival
```
En `createWorld`, en el objeto, después de `over: OVER_NONE,`:
```ts
    phase: PHASE_PLAY, phaseTime: 0, mergeR: 0, mergeA: 0,
```
En `hashWorld`, después de `mix(w.bh.mass);`, agregar `mix(w.phase); mix(w.phaseTime);`.

- [ ] **Paso 4: transiciones en `src/sim/phase.ts`** (agregar)

```ts
import { DT } from './config';
import { STAGE_HYPER } from './stages';
import { CARRIED, FREE, OVER_NONE, OVER_WON, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, PHASE_PLAY, PROJECTILE, RETURNING } from './world';

// Se puede colapsar siendo hipergigante y con más masa que el rival. Lo decide el jugador.
export function canCollapse(w: World): boolean {
  return w.phase === PHASE_PLAY && w.over === OVER_NONE && w.bh.active && w.stage >= STAGE_HYPER && w.star.mass > rivalMass(w);
}

// Empieza la supernova: la estrella se detiene, los cometas se apagan y sueltan lo que llevaban, y lo lanzado queda libre.
export function startCollapse(w: World): void {
  w.phase = PHASE_COLLAPSE; w.phaseTime = 0;
  w.star.vx = 0; w.star.vy = 0;
  const cm = w.comets;
  for (let k = 0; k < cm.mode.length; k++) {
    const c = cm.carry[k]!;
    if (c >= 0 && w.state[c] === CARRIED) { w.state[c] = FREE; w.vx[c] = 0; w.vy[c] = 0; w.noCatch[c] = 0; }
    cm.carry[k] = -1; cm.mode[k] = 0;
  }
  for (let i = 0; i < w.count; i++) if (w.state[i] === PROJECTILE || w.state[i] === RETURNING) w.state[i] = FREE;
}

// Nace tu agujero negro y empieza la caza. Si el rival quedó demasiado lejos, se lo acerca fuera de cámara.
export function startHunt(w: World): void {
  w.phase = PHASE_HUNT; w.phaseTime = 0;
  const s = w.star, bh = w.bh, max = w.config.huntStartMaxDist;
  const dx = bh.x - s.x, dy = bh.y - s.y, d = Math.hypot(dx, dy);
  if (d > max) { bh.x = bh.prevX = s.x + (dx / d) * max; bh.y = bh.prevY = s.y + (dy / d) * max; }
}

// Lo alcanzaste: los dos agujeros giran uno alrededor del otro, cada vez más cerca y más rápido.
export function startMerge(w: World): void {
  w.phase = PHASE_MERGE; w.phaseTime = 0;
  const s = w.star, bh = w.bh;
  w.mergeR = Math.max(1, Math.hypot(bh.x - s.x, bh.y - s.y));
  w.mergeA = Math.atan2(bh.y - s.y, bh.x - s.x);
  s.vx = 0; s.vy = 0;
}

export function stepMerge(w: World): void {
  const s = w.star, bh = w.bh;
  const p = Math.min(1, w.phaseTime / w.config.mergeTime);
  w.mergeA += DT * (0.8 + 9 * p * p);
  const r = w.mergeR * (1 - p) ** 1.5;
  bh.x = s.x + Math.cos(w.mergeA) * r; bh.y = s.y + Math.sin(w.mergeA) * r;
  bh.vx = 0; bh.vy = 0;
  if (w.phaseTime >= w.config.mergeTime) {
    s.mass += rivalMass(w);
    bh.active = false;
    w.over = OVER_WON;
  }
}
```
(Unir los `import` con el `import type { World }` existente en un solo bloque al principio del archivo.)

- [ ] **Paso 5: la simulación en `src/sim/step.ts`**

5a. En `Intent`, sumar `collapse?: boolean;   // apretó la tecla de colapso`.

5b. Importaciones: sumar `canCollapse, playerHoleRadius, startCollapse, startHunt, startMerge, stepMerge` desde `./phase`, y `OVER_ESCAPED, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE` desde `./world`.

5c. Extraer el movimiento orbital. Reemplazar la rama final `} else { ... }` del bucle de cuerpos (la que empieza con `const absorbing = st === ABSORBING;`) por `} else moveOrbiting(w, i, st === ABSORBING, size);`, y agregar esta función antes de `step`, con el mismo cuerpo que esa rama:
```ts
// Se acomoda en su órbita (o cae a la estrella si la está absorbiendo) a velocidad limitada:
// se lo ve acercarse e imantarse, no saltar. La franja sigue el tamaño de la estrella.
function moveOrbiting(w: World, i: number, absorbing: boolean, size: number): void {
  const c = w.config, s = w.star;
  const target = absorbing ? size * 0.7 : clamp(w.orbitTarget[i], bandLo, bandHi);
  const maxDr = c.orbitInfallSpeed * (absorbing ? 1.6 : 1) * DT;
  const r = w.orbitR[i] + clamp((target - w.orbitR[i]) * c.orbitEase, -maxDr, maxDr);
  w.orbitR[i] = r;
  if (absorbing && r <= size * 0.8) { w.state[i] = DEAD; return; }
  const a = w.orbitAngle[i] + c.orbitSpeedK * Math.pow(c.orbitMin / Math.max(r, 1e-6), 1.5) * DT;
  w.orbitAngle[i] = a;
  w.x[i] = s.x + Math.cos(a) * r;
  w.y[i] = s.y + Math.sin(a) * r;
}

// Cinemáticas (colapso y fusión): guion fijo. Sólo gira lo que está en órbita; lo demás espera.
function cinematic(w: World): void {
  w.phaseTime += DT;
  setOrbitBand(w);
  const size = starSize(w.star.mass);
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st === ORBITING || st === ABSORBING) moveOrbiting(w, i, st === ABSORBING, size);
  }
  if (w.phase === PHASE_COLLAPSE) { if (w.phaseTime >= w.config.collapseTime) startHunt(w); }
  else stepMerge(w);
}
```

5d. En `step`, justo después de `if (w.over !== OVER_NONE) return;`:
```ts
  if (w.phase === PHASE_COLLAPSE || w.phase === PHASE_MERGE) { cinematic(w); w.tick++; return; }
  const hunting = w.phase === PHASE_HUNT;
```

5e. Agujero negro. Dentro de `if (bh.active) {`, reemplazar las dos líneas de persecución (`bh.speed = ...` y el bloque que calcula `bh.vx/bh.vy` hacia la estrella) por:
```ts
    const dx = s.x - bh.x, dy = s.y - bh.y;
    const d = Math.hypot(dx, dy);
    if (hunting) {
      // En la caza huye de vos, a velocidad fija.
      if (d > 1e-6) { bh.vx = (-dx / d) * c.huntFleeSpeed; bh.vy = (-dy / d) * c.huntFleeSpeed; }
    } else {
      bh.speed = Math.min(c.bhMaxSpeed, bh.speed + c.bhAccel * DT);
      if (d > 1e-6) { bh.vx = (dx / d) * bh.speed; bh.vy = (dy / d) * bh.speed; }
    }
```
Las líneas `bh.x += ...`, `bh.y += ...` y la vuelta del mapa quedan igual. La atracción sobre la estrella se envuelve en `if (!hunting && g2 < range2 && g2 > 1e-9) {`: en la caza, el agujero negro sos vos.

5f. Aceleración: `const acc = hunting ? c.starAccel : c.starAccel / (1 + c.starMassInertia * s.mass);`. Siendo agujero negro ya no cargás con la inercia de la estrella.

5g. Reemplazar el bloque `if (bh.active && Math.hypot(...) < bh.radius + starSize(s.mass) * 0.5) { ... }` por:
```ts
  const holeR = hunting ? playerHoleRadius(w) : 0;
  if (bh.active) {
    const dd = Math.hypot(s.x - bh.x, s.y - bh.y);
    if (hunting) {
      if (dd < holeR + bh.radius) { startMerge(w); w.tick++; return; }
    } else if (dd < bh.radius + starSize(s.mass) * 0.5) {
      w.over = OVER_SWALLOWED;
      w.tick++;
      return;
    }
  }
```

5h. En el bucle de cuerpos, rama `FREE`/`ORBIT_PLANET`, justo después de `const d = Math.hypot(x - s.x, y - s.y);`:
```ts
      if (hunting) {
        // Tu agujero negro traga lo que toca; no hay capturas ni choques.
        if (d < holeR * c.huntSwallowFactor) { w.state[i] = DEAD; s.mass += w.mass[i]; }
        continue;
      }
```

5i. Después del bucle, cambiar:
- `stepStarFlybys(w);` por `if (!hunting) stepStarFlybys(w);`;
- la línea del eclipse por `if (!hunting && w.eclipseCd <= 0 && w.orbitingCount >= c.eclipseMin) eclipse(w);`;
- `stepComets(w);` por `if (!hunting) stepComets(w);`;
- el `if (intent.fire && ...)` de la honda: agregar `!hunting &&` al principio de la condición.

5j. Justo antes de `w.tick++;` al final de `step`:
```ts
  if (hunting) {
    w.phaseTime += DT;
    if (w.phaseTime >= c.huntTimeLimit) w.over = OVER_ESCAPED;
  } else if (intent.collapse && canCollapse(w)) startCollapse(w);
```

- [ ] **Paso 6: correr las pruebas**

Correr: `npx vitest run`
Se espera que PASE todo: las nuevas y las viejas. `step.test`, `hurt.test` y `eclipse.test` no cambian su comportamiento en `PHASE_PLAY`.

- [ ] **Paso 7: commit**

```bash
git add src/sim/world.ts src/sim/step.ts src/sim/phase.ts tests/unit/phase.test.ts
git commit -m "Meta: colapso disparado por el jugador, caza con tiempo límite, fusión y victoria"
```

---

### Tarea 3: el bot juega para ganar, y se ajusta la escala del rival

**Archivos:**
- Modificar: `tests/balance/bot.test.ts`; `src/sim/config.ts` (sólo `rivalMassScale`, si hace falta)

**Interfaces:**
- Consume: `canCollapse` y los valores `PHASE_*` y `OVER_*`.

- [ ] **Paso 1: el bot colapsa cuando puede y caza**

En `tests/balance/bot.test.ts`:
- importar `canCollapse` desde `../../src/sim/phase`, y `PHASE_HUNT` y `OVER_WON` desde `../../src/sim/world`;
- cambiar el tope del bucle a `60 * 900` (15 minutos);
- al principio del cuerpo del bucle, antes de `const dbh = ...`, agregar:
```ts
      if (w.phase === PHASE_HUNT) {
        intent.targetX = w.bh.x; intent.targetY = w.bh.y; intent.fire = false; intent.collapse = false;
        step(w, intent);
        continue;
      }
```
- justo antes de `const a = performance.now();`, agregar `intent.collapse = canCollapse(w);`;
- en el `console.log`, agregar al principio `${w.over === OVER_WON ? 'GANÓ' : 'perdió'} ` y sumar `fase=${w.phase}`.

- [ ] **Paso 2: correr el bot**

Correr: `npm run balance`
Anotar, para cada semilla: si ganó, en cuántos segundos y con qué final (`fin`).

- [ ] **Paso 3: ajustar `rivalMassScale`**

**Objetivo para la pantalla 1:** el bot simple gana entre 1 y 3 de las 5 partidas, y la victoria llega después de los 5 minutos. Lucas pidió «no tiene que ser tan fácil».
- Si gana 4 o 5, subir `rivalMassScale` de a 10.
- Si no gana ninguna, bajarlo de a 10.

Repetir el Paso 2 hasta cumplir el objetivo, o hasta 4 intentos. Si no se logra, dejar el valor más cercano y anotarlo para Lucas.

- [ ] **Paso 4: correr las pruebas unitarias** (usan `cfg.rivalMassScale`, así que no dependen del valor)

Correr: `npx vitest run`
Se espera que PASE.

- [ ] **Paso 5: commit**

```bash
git add tests/balance/bot.test.ts src/sim/config.ts
git commit -m "Bot: juega para ganar (colapsa y caza); ajuste de la escala del rival"
```
En el cuerpo del commit, poner la tabla de resultados del bot.

---

### Tarea 4: el visor (barras de masa, aviso de colapso, caza) y la tecla de colapso

**Archivos:**
- Modificar: `src/input/controller.ts`, `src/ui/hud.ts`, `src/ui/hud.css`, `src/renderer/game.ts`
- Prueba: `tests/e2e/meta.spec.ts` (parte del visor)

**Interfaces:**
- Consume: `rivalMass`, `canCollapse`, `STAGE_HYPER` y los valores `PHASE_*`.
- Produce: `Intent.collapse` lo llena `InputController.poll` (ESPACIO o la tecla C; botón 3 del mando).

- [ ] **Paso 1: escribir la prueba que falla**

```ts
// tests/e2e/meta.spec.ts
import { expect, test } from '@playwright/test';

test('las barras de masa y el aviso de colapso; ESPACIO colapsa', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.locator('.hud .race')).toBeVisible();
  await page.evaluate(() => { const w = window.__GAME__!.world; w.star.mass = 2000; w.bh.mass = 1; });
  await expect(page.locator('.hud .note')).toContainText('COLAPSO DISPONIBLE', { timeout: 5_000 });
  await page.screenshot({ path: 'artifacts/e2e/colapso-disponible.png' });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__GAME__!.world.phase === 1, undefined, { timeout: 5_000 });
});
```

- [ ] **Paso 2: correrla para verificar que falla**

Correr: `npx playwright test tests/e2e/meta.spec.ts --project=web`
Se espera que FALLE porque no existe `.hud .race`.

- [ ] **Paso 3: la tecla de colapso en `src/input/controller.ts`**

Agregar los campos `private collapsePending = false;` y `private yHeld = false;`.

Al final del constructor:
```ts
    // ESPACIO o C: colapsar (sólo hace algo cuando se puede; la simulación lo decide).
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'c' || e.key === 'C') { this.collapsePending = true; e.preventDefault(); }
    });
```
En `poll`, después del bloque del gatillo:
```ts
    let y = false;
    for (let k = 0; k < pads.length; k++) if (pads[k]?.buttons?.[3]?.pressed) y = true;
    if (y && !this.yHeld) this.collapsePending = true;
    this.yHeld = y;
    this.intent.collapse = this.intent.collapse === true || this.collapsePending;
    this.collapsePending = false;
```
En `src/renderer/game.ts`, en el bucle de pasos, cambiar `step(world, intent); intent.fire = false;` por `step(world, intent); intent.fire = false; intent.collapse = false;`.

- [ ] **Paso 4: el visor en `src/ui/hud.ts`**

4a. Importaciones: `rivalMass` y `canCollapse` desde `../sim/phase`; `STAGE_HYPER` desde `../sim/stages`; `PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE` desde `../sim/world`.

4b. En el `innerHTML`, después del `<div class="stage">…</div>`:
```html
    <div class="race"><span class="me">VOS <b class="mv">0000</b></span><div class="bar"><i class="mb"></i><i class="rb"></i></div><span class="rv"><b class="rvv">0000</b> RIVAL</span></div>
    <div class="note am"></div>
```

4c. Referencias, junto a las otras:
```ts
  const race = q<HTMLElement>('.race'), mvEl = q<HTMLElement>('.mv'), rvEl = q<HTMLElement>('.rvv');
  const mb = q<HTMLElement>('.mb'), rb = q<HTMLElement>('.rb'), note = q<HTMLElement>('.note');
  let lastRace = -1, lastNote = '';
```
En `seen`, sumar `phase: 0`, tanto en la declaración como en `reset`: `phase: w.phase`.

4d. En la parte de texto (10 Hz), después de `massEl.textContent = …`:
```ts
      // La carrera: tu masa contra la del rival (en la caza, tu ventaja).
      race.style.display = bh.active || w.phase === PHASE_MERGE ? '' : 'none';
      const me = s.mass, rv = rivalMass(w);
      const f = Math.round((me / Math.max(1e-6, me + rv)) * 1000) / 10;
      if (f !== lastRace) { mb.style.width = `${f}%`; rb.style.width = `${100 - f}%`; lastRace = f; }
      mvEl.textContent = pad(me, 4); rvEl.textContent = pad(rv, 4);
      let nt = '';
      if (w.phase === PHASE_HUNT) {
        const left = Math.max(0, w.config.huntTimeLimit - w.phaseTime);
        nt = `CAZA · ALCANZALO ANTES DE ${pad(left / 60, 2)}:${pad(left % 60, 2)}`;
      } else if (canCollapse(w)) nt = 'COLAPSO DISPONIBLE · [ESPACIO]';
      else if (w.phase === 0 && w.stage >= STAGE_HYPER) nt = 'HIPERGIGANTE · SUPERÁ AL RIVAL PARA COLAPSAR';
      if (nt !== lastNote) { note.textContent = nt; note.className = nt.startsWith('COLAPSO') ? 'note am blink' : 'note am'; lastNote = nt; }
      if (w.phase >= PHASE_HUNT) nameEl.textContent = 'AGUJERO NEGRO';
```
`nameEl` ya se escribió antes con la etapa; esta última línea lo pisa en la caza.

4e. En el registro de sucesos, antes de `seen.stageUps = …`:
```ts
      if (w.phase !== seen.phase) {
        if (w.phase === PHASE_COLLAPSE) log('SUPERNOVA');
        if (w.phase === PHASE_HUNT) log('NACISTE COMO AGUJERO NEGRO · ALCANZÁ AL RIVAL');
        if (w.phase === PHASE_MERGE) log('FUSIÓN');
        seen.phase = w.phase;
      }
```

4f. En `src/ui/hud.css`, agregar:
```css
.hud .race { position: absolute; left: 50%; top: 74px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; font-size: 11px; }
.hud .race .bar { display: flex; width: 340px; height: 7px; gap: 2px; }
.hud .race .mb { background: var(--ph); box-shadow: 0 0 5px #7af5c9aa; transition: width .3s; }
.hud .race .rb { background: var(--am); box-shadow: 0 0 5px #ffb000aa; transition: width .3s; }
.hud .race .rv { color: var(--am); text-shadow: 0 0 6px #ffb000aa; }
.hud .note { position: absolute; left: 50%; top: 96px; transform: translateX(-50%); font-size: 11px; letter-spacing: 3px; white-space: nowrap; }
.hud .note.blink { animation: blink 1.2s steps(2, start) infinite; }
```

4g. En `src/renderer/game.ts`, el visor se oculta durante las cinemáticas: `hud.setVisible(world.over === 0 && world.phase !== PHASE_COLLAPSE && world.phase !== PHASE_MERGE);`, importando esos dos valores de `../sim/world`.

- [ ] **Paso 5: correr la prueba y todo lo demás**

Correr: `npx playwright test --project=web && npx vitest run && npm run typecheck`
Se espera que PASE, incluida `lab.spec`: en el laboratorio el agujero negro está apagado y `.race` queda oculta.

- [ ] **Paso 6: commit**

```bash
git add src/input/controller.ts src/ui/hud.ts src/ui/hud.css src/renderer/game.ts tests/e2e/meta.spec.ts
git commit -m "Visor: barras de masa contra el rival, aviso de colapso, cuenta regresiva de la caza y tecla ESPACIO"
```

---

### Tarea 5: lo visual (hipergigante, supernova, tu agujero negro, fusión) y el cartel de victoria

**Archivos:**
- Modificar: `src/render/bodies/sun.ts`, `src/render/blackhole/blackHole.ts`, `src/render/layers.ts`, `src/ui/gameOver.ts`, `src/ui/gameOver.css`, `src/renderer/game.ts`
- Crear: `src/ui/cinematic.ts`, `src/ui/cinematic.css`
- Prueba: `tests/e2e/meta.spec.ts` (recorrido completo)

**Interfaces:**
- Consume: `playerHoleRadius`, `STAGE_HYPER`, los valores `PHASE_*`, `OVER_WON` y `OVER_ESCAPED`.
- Produce:
  - `createBlackHoleLayer(pipeline, role: 'rival' | 'player' = 'rival')`;
  - `createCinematic(parent): { update(w: World, dt: number): void }`.

- [ ] **Paso 1: escribir la prueba de punta a punta que falla** (agregar a `tests/e2e/meta.spec.ts`)

```ts
test('supernova, caza, fusión y cartel de victoria', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => { const w = window.__GAME__!.world; w.star.mass = 2000; w.bh.mass = 1; });
  await expect(page.locator('.hud .note')).toContainText('COLAPSO DISPONIBLE', { timeout: 5_000 });
  await page.screenshot({ path: 'artifacts/e2e/hipergigante.png' });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__GAME__!.world.phaseTime > 2.15, undefined, { timeout: 8_000 });
  await page.screenshot({ path: 'artifacts/e2e/supernova.png' });
  await page.waitForFunction(() => window.__GAME__!.world.phaseTime > 4.5, undefined, { timeout: 8_000 });
  await page.screenshot({ path: 'artifacts/e2e/nacimiento.png' });
  await page.waitForFunction(() => window.__GAME__!.world.phase === 2, undefined, { timeout: 8_000 });
  await expect(page.locator('.hud .note')).toContainText('CAZA');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/e2e/caza.png' });
  await page.evaluate(() => { const w = window.__GAME__!.world; w.bh.x = w.bh.prevX = w.star.x + 3; w.bh.y = w.bh.prevY = w.star.y; });
  await page.waitForFunction(() => window.__GAME__!.world.phaseTime > 3, undefined, { timeout: 8_000 });
  await page.screenshot({ path: 'artifacts/e2e/fusion.png' });
  await page.waitForFunction(() => window.__GAME__!.world.over === 4, undefined, { timeout: 8_000 });
  await expect(page.locator('.gameover.on .title')).toHaveText('FUSIÓN', { timeout: 6_000 });
  await page.screenshot({ path: 'artifacts/e2e/victoria.png' });
  expect(errors).toEqual([]);
});
```

- [ ] **Paso 2: correrla para verificar que falla**

Correr: `npx playwright test tests/e2e/meta.spec.ts --project=web`
Se espera que FALLE en el título «FUSIÓN»: el cartel todavía no conoce `OVER_WON`.

- [ ] **Paso 3: la estrella en `src/render/bodies/sun.ts`**

3a. Agregar una sexta paleta a `PALETTES`, para la hipergigante amarilla, muy luminosa y rojiza en el borde. Cambiar el comentario a «… → supergigante → hipergigante».
```ts
  [1.0, 0.86, 0.55, 1.0, 0.62, 0.25, 0.80, 0.30, 0.08],
```

3b. Erupciones: una cáscara de gas que sale despedida y se expande en un anillo, como en Eta Carinae. Va en una lámina aditiva que mira a la cámara. Agregar después de `HALO_FRAG`:
```ts
const SHELL_FRAG = /* glsl */ `uniform float uT; uniform vec3 uTint; varying vec2 vUv;
void main(){
  vec2 d = (vUv*2.-1.)*6.; float r = length(d); float a = atan(d.y, d.x);
  float R = 1.2 + 3.8*(1. - exp(-uT*.6));
  float n = fbm(vec3(cos(a)*2.5, sin(a)*2.5, uT*.2), 4)*.5+.5;
  float ring = exp(-pow((r - R)/(.25 + .35*n), 2.)) * (1. - smoothstep(2., 5., uT)) * smoothstep(0., .3, uT) * (.4 + .8*n);
  gl_FragColor = vec4(uTint * ring * .6, 1.);
}`;
const ERUPTION_EVERY = 13, ERUPTION_LAST = 5, PULSE_PERIOD = 5.5;
const smooth01 = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
```

3c. En `createSunLayer`, después de crear `halo`:
```ts
  const shellMat = new ShaderMaterial({
    uniforms: { uT: { value: 0 }, uTint: { value: tint } }, vertexShader: HALO_VERT, fragmentShader: NOISE_GLSL + SHELL_FRAG,
    depthWrite: false, transparent: true, blending: AdditiveBlending,
  });
  const shell = new Mesh(new PlaneGeometry(12, 12), shellMat);
  shell.visible = false;
  let baseIntensity = 1.45, baseLight = 2.4;
```
Y `group.add(sun, halo, light);` pasa a `group.add(sun, halo, shell, light);`.

3d. En `update`, reemplazar desde `const swallowed = …` hasta `light.position.copy(sunPos);` por:
```ts
      const w = ctx.world;
      // Tragada por el agujero negro, o ya convertida en agujero negro: no hay estrella.
      const swallowed = w.over === OVER_SWALLOWED;
      const gone = w.phase === PHASE_HUNT || w.phase === PHASE_MERGE;
      const target = swallowed || gone ? 0 : starRenderRadius(w.star.mass);
      shownR = gone ? 0 : shownR < 0 ? target : smoothToward(shownR, target, swallowed ? 2.5 : 1.2, ctx.dt);
      // La hipergigante late: se hincha y se contrae despacio, y el brillo acompaña cada pulso.
      const hyper = w.stage >= STAGE_HYPER && w.phase === PHASE_PLAY && w.over === 0;
      const pulse = hyper ? Math.sin(ctx.time * ((Math.PI * 2) / PULSE_PERIOD)) : 0;
      let k = 1 + 0.035 * pulse, bright = 1 + 0.12 * pulse;
      // Colapso: se encoge de golpe y se apaga (2 s); después estalla y desaparece.
      if (w.phase === PHASE_COLLAPSE) {
        const t = w.phaseTime;
        if (t < 2) { k = 1 - 0.65 * smooth01(t / 2); bright = 1 - 0.5 * smooth01(t / 2); }
        else { k = Math.max(0, 0.35 * (1 - (t - 2) / 0.25)); bright = 3; }
      }
      const r = Math.max(shownR * k, 1e-3);
      sun.visible = halo.visible = shownR * k > 0.05;
      sun.position.copy(sunPos); sun.scale.setScalar(r); sun.rotation.y = ctx.time * 0.03;
      halo.position.copy(sunPos); halo.scale.setScalar(r); halo.quaternion.copy(ctx.camera.quaternion);
      // Erupciones de la hipergigante: cada tanto sale una cáscara de gas.
      const et = ctx.time % ERUPTION_EVERY;
      shell.visible = hyper && et < ERUPTION_LAST;
      if (shell.visible) { shell.position.copy(sunPos); shell.scale.setScalar(r); shell.quaternion.copy(ctx.camera.quaternion); shellMat.uniforms['uT']!.value = et; }
      sunMat.uniforms['uIntensity']!.value = baseIntensity * bright;
      light.intensity = baseLight * (gone ? 0.35 : 1);
      light.position.copy(sunPos);
```
En `applyParams`, cambiar las dos líneas por `baseIntensity = p.sunIntensity;` y `baseLight = p.lightIntensity;`.

Importar `PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, PHASE_PLAY` desde `../../sim/world` (junto a `OVER_SWALLOWED` y `starSize`), y `STAGE_HYPER` desde `../../sim/stages`.

- [ ] **Paso 4: tu agujero negro en `src/render/blackhole/blackHole.ts`**

4a. Firma: `export function createBlackHoleLayer(pipeline: Pipeline, role: 'rival' | 'player' = 'rival'): Layer`. Importar `playerHoleRadius` desde `../../sim/phase`, y `OVER_WON, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, type World` desde `../../sim/world`.

4b. Funciones auxiliares, antes de la función principal:
```ts
const smoothStep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Tu agujero negro nace en el colapso (después del estallido) y ya está entero en la caza y la fusión.
function playerGrowth(w: World): number {
  if (w.phase === PHASE_HUNT || w.phase === PHASE_MERGE) return 1;
  if (w.phase === PHASE_COLLAPSE) return smoothStep(2.3, 4.5, w.phaseTime);
  return 0;
}
// Su disco de acreción se enciende de a poco.
const ignition = (w: World): number => (w.phase === PHASE_COLLAPSE ? smoothStep(2.6, 5.5, w.phaseTime) : 1);
```

4c. Dentro de la función, `let diskBase = 4;`. En `applyParams`: `diskBase = p.diskIntensity;`.

4d. En `update`, reemplazar desde `const bh = ctx.world.bh;` hasta `diskMat.uniforms['uTime']!.value = ctx.time;` por:
```ts
      const w = ctx.world, bh = w.bh;
      const mine = playerGrowth(w);
      let radius: number;
      if (role === 'player') {
        group.visible = mine > 0.001;
        if (!group.visible) return;
        toWorld(ctx.starX, ctx.starY, center);
        radius = playerHoleRadius(w) * mine;
      } else {
        group.visible = w.over !== OVER_WON;   // después de la fusión queda uno solo: el tuyo
        if (!group.visible) return;
        radius = bh.active ? bh.radius : p.blackHoleRadius;
        if (bh.active) toWorld(bh.prevX + (bh.x - bh.prevX) * ctx.alpha, bh.prevY + (bh.y - bh.prevY) * ctx.alpha, center);
        else toWorld(p.blackHoleX, p.blackHoleY, center);
      }
      group.position.copy(center);
      group.scale.setScalar(radius / HORIZON);
      diskMat.uniforms['uTime']!.value = ctx.time;
      diskMat.uniforms['uIntensity']!.value = diskBase * (role === 'player' ? ignition(w) : 1);
      // Hay una sola lente: cuando existe tu agujero negro, la maneja él (está en el centro de la pantalla).
      if (role === 'rival' && mine > 0.001) return;
```
La línea `const p = ctx.params, cam = ctx.camera, rig = ctx.rig;` queda al principio, como está. Lo que sigue (la lente) queda igual. `applyParams` ya no escribe `uIntensity` directamente: ahora sólo guarda `diskBase`.

4e. En `src/render/layers.ts`, después de `createBlackHoleLayer(deps.pipeline),` agregar `createBlackHoleLayer(deps.pipeline, 'player'),`.

- [ ] **Paso 5: la capa de cinemática (DOM)**

```ts
// src/ui/cinematic.ts
import { OVER_WON, PHASE_COLLAPSE, PHASE_MERGE, type World } from '../sim/world';
import './cinematic.css';

// Encima de la escena, durante las cinemáticas: bandas de cine, el destello de la supernova,
// su onda de choque y, al fusionarse, la onda gravitatoria (una deformación del fondo, no luz).
export interface Cinematic { update(w: World, dt: number): void }

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createCinematic(parent: HTMLElement): Cinematic {
  const root = document.createElement('div');
  root.className = 'cine';
  root.innerHTML = '<i class="bar t"></i><i class="bar b"></i><div class="flash"></div><div class="nova"></div><div class="gw"></div>';
  parent.appendChild(root);
  const flash = root.querySelector('.flash') as HTMLElement, nova = root.querySelector('.nova') as HTMLElement, gw = root.querySelector('.gw') as HTMLElement;
  let wonT = -1, lastOn = false;
  const set = (el: HTMLElement, op: number, sc: number): void => { el.style.opacity = op.toFixed(3); el.style.transform = `scale(${sc.toFixed(3)})`; };
  return {
    update(w, dt) {
      const t = w.phaseTime;
      if (w.over === OVER_WON) wonT = wonT < 0 ? 0 : wonT + dt; else wonT = -1;
      const on = (w.over === 0 && (w.phase === PHASE_COLLAPSE || w.phase === PHASE_MERGE)) || (wonT >= 0 && wonT < 2.5);
      if (on !== lastOn) { root.classList.toggle('on', on); lastOn = on; }
      if (w.phase === PHASE_COLLAPSE && w.over === 0) {
        set(flash, t < 2 ? 0 : t < 2.25 ? (t - 2) / 0.25 : Math.exp(-(t - 2.25) * 1.6), 1);
        const p = smooth(2.1, 5.1, t);
        set(nova, t > 2.1 ? 1 - p : 0, 0.05 + p * 2.2);
      } else { set(flash, 0, 1); set(nova, 0, 0); }
      if (wonT >= 0 && wonT < 2.2) { const p = wonT / 2.2; set(gw, 1 - p, 0.05 + p * 2.5); } else set(gw, 0, 0);
    },
  };
}
```

```css
/* src/ui/cinematic.css — bandas, destello y ondas de las cinemáticas. */
.cine { position: fixed; inset: 0; pointer-events: none; z-index: 15; overflow: hidden; }
.cine .bar { position: absolute; left: 0; right: 0; height: 9vh; background: #000; transform: scaleY(0); transition: transform .8s ease; }
.cine .bar.t { top: 0; transform-origin: top; }
.cine .bar.b { bottom: 0; transform-origin: bottom; }
.cine.on .bar { transform: scaleY(1); }
.cine .flash { position: absolute; inset: 0; opacity: 0; background: radial-gradient(circle at 50% 50%, #fffaf0 0%, #fff3d8 35%, #ffe2b0 100%); }
.cine .nova, .cine .gw { position: absolute; left: 50%; top: 50%; width: 100vmax; height: 100vmax; margin: -50vmax 0 0 -50vmax; border-radius: 50%; opacity: 0; transform: scale(0); }
.cine .nova { mix-blend-mode: screen; background: radial-gradient(circle, transparent 60%, #ffe9c255 66%, #fff6e0cc 69%, #ffc27a44 72%, transparent 76%); }
.cine .gw { backdrop-filter: blur(2.5px) brightness(1.25) saturate(1.2);
  -webkit-mask-image: radial-gradient(circle, transparent 62%, #000 68%, #000 71%, transparent 77%);
  mask-image: radial-gradient(circle, transparent 62%, #000 68%, #000 71%, transparent 77%); }
```

En `src/renderer/game.ts`:
- importar `createCinematic` desde `../ui/cinematic`;
- crear `const cine = createCinematic(document.body);` después de `createHud`;
- en el bucle, después de `gameOver.update(world, elapsed);`, agregar `cine.update(world, elapsed);`.

- [ ] **Paso 6: el cartel final conoce la victoria y la huida**

En `src/ui/gameOver.ts`:
- importar `OVER_ESCAPED` y `OVER_WON`;
- la espera pasa a depender del final: reemplazar `wait -= dt; if (wait > 0) return;` por:
```ts
      wait -= dt;
      if (wait > (w.over === OVER_WON ? 0 : 2.6)) return;   // la victoria espera a que termine la onda gravitatoria
```
- inicializar `wait` en `DELAY + 2.6`, es decir 3,8. Una derrota se muestra cuando `wait` baja a 2,6 (sigue esperando 1,2 s) y la victoria cuando llega a 0 (3,8 s);
- reemplazar las líneas de `title` y `why` por:
```ts
      const titles: Record<number, [string, string]> = {
        [OVER_SWALLOWED]: ['ESTRELLA TRAGADA', 'EL AGUJERO NEGRO TE ALCANZÓ'],
        [OVER_ESCAPED]: ['EL RIVAL SE ESCAPÓ', 'NO LO ALCANZASTE A TIEMPO'],
        [OVER_WON]: ['FUSIÓN', 'TE COMISTE AL AGUJERO NEGRO RIVAL · GANASTE LA PANTALLA'],
      };
      const [tt, wy] = titles[w.over] ?? ['ESTRELLA APAGADA', 'CHOCASTE CONTRA UN PLANETA SIN NADA EN ÓRBITA QUE TE PROTEJA'];
      title.textContent = tt; why.textContent = wy;
      root.classList.toggle('won', w.over === OVER_WON);
```
(El objeto se crea una sola vez, al mostrar el cartel: no corre por cuadro.)

En `src/ui/gameOver.css`, agregar:
```css
.gameover.won .title { color: #7af5c9; text-shadow: 0 0 8px #7af5c9aa, 0 0 20px #7af5c944; }
```

- [ ] **Paso 7: correr todo**

Correr: `npx vitest run && npm run typecheck && npx playwright test --project=web`
Se espera que PASE todo. Mirar las capturas `artifacts/e2e/hipergigante.png`, `supernova.png`, `nacimiento.png`, `caza.png`, `fusion.png` y `victoria.png`, y puntuarlas con el scorecard de `threejs-aaa-graphics-builder`. Si alguna sale negra, vacía o con errores, corregir antes de hacer el commit.

- [ ] **Paso 8: commit**

```bash
git add src/render src/ui src/renderer/game.ts tests/e2e/meta.spec.ts
git commit -m "Meta visual: hipergigante que late, supernova, tu agujero negro, fusión con onda gravitatoria y cartel de victoria"
```

---

### Tarea 6: verificación final y entrega a Lucas

- [ ] **Paso 1: el banco** — correr `npm run bench`. El p99 tiene que quedar cerca de 5,8 ms. La capa del agujero negro propio está oculta en el banco, así que no debería cambiar. Anotar el valor.
- [ ] **Paso 2: el bot** — correr `npm run balance` y anotar las victorias y los tiempos.
- [ ] **Paso 3: probar en Electron** — correr `npm run test:electron`.
- [ ] **Paso 4: bitácora en Notion** (MCP `notion-juego`; primero verificar con `notion-get-self` que la cuenta sea lfigueiraduarte@gmail.com). Agregar una entrada que diga:
  - qué se construyó;
  - el p99;
  - los resultados del bot y el valor de `rivalMassScale`;
  - que queda pendiente pulir las cinemáticas.
- [ ] **Paso 5: subir la rama** (`git push`) y pedirle a Lucas que juegue. Para probar el final rápido, hay un atajo en la consola del navegador: `__GAME__.world.star.mass = 2000` y después ESPACIO.
