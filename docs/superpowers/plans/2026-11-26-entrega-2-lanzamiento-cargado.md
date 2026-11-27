# Entrega 2: lanzamiento cargado — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** un solo botón de lanzamiento:
- un **toque** lanza un asteroide que vuelve;
- **mantenido**, junta asteroides de tu órbita en un **bólido** que crece hasta un límite. Al soltarlo, el bólido sale y esos asteroides se pierden.

El bólido mata un cometa de un golpe, y al agujero negro lo alimenta y lo frena unos segundos. El eclipse automático y su rayo desaparecen.

**Arquitectura:**
- Módulo nuevo `src/sim/launch.ts`, con la honda, la carga, el bólido y su vuelo.
- Dos estados nuevos para los cuerpos: `GATHERING`, que se está juntando, y `BOLT`, que es parte de un bólido lanzado.
- La simulación lee `Intent.hold` (el botón mantenido) y detecta ella misma cuándo se suelta, así que sigue siendo determinista.
- El eclipse se borra de punta a punta: simulación, configuración, dibujo, visor, cartel y pruebas.

**Tecnologías:** TypeScript, Vitest y Playwright.

**Especificación:** `docs/superpowers/specs/2026-11-26-meta-colapso-pantallas-design.md`:
- §4: lanzamiento;
- §2: el bólido contra el agujero negro;
- §3: cometas, que se matan con 3 golpes de honda o 1 bólido;
- §9: Entrega 2.

## Restricciones globales

- Todo lo que ve el jugador, los comentarios y los commits van en español rioplatense.
- `src/sim/` sigue siendo pura y determinista, sin objetos nuevos dentro de `step`.
- **Nunca se lanzan planetas:** sólo cuerpos en órbita de tipo `KIND_ASTEROID` o `KIND_MOON`.
- Valores iniciales en `SimConfig`, que se ajustan jugando:
  - `tapTime: 0.22`;
  - `boltGatherRate: 6`;
  - `boltMax: 12`;
  - `boltSpeed: 55`;
  - `boltLife: 2.4`;
  - `boltLoseSlow: 0.15`;
  - `boltNoCatch: 2.5`;
  - `boltGatherDist: 3`;
  - `boltBhFeed: 0.02`;
  - `boltBhSlow: 3`;
  - `boltBhSlowFactor: 0.6`.
- Estados nuevos: `GATHERING = 8` y `BOLT = 9`.
- Commits terminados con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VCDQYR4GnVKDakJf79PRaF
  ```

## Puntos a revisar

1. **Soltar el botón sin asteroides en órbita, o con la honda recargando.** No pasa nada, y no queda carga colgada. Se prueba en la Tarea 2.
2. **Colapsar mientras se carga o con un bólido en vuelo.** Lo que se juntaba vuelve a la órbita y lo que vuela queda suelto. Se prueba en la Tarea 2.
3. **Un clic muy rápido,** que baja y sube entre dos cuadros, igual cuenta como toque. Se prueba en la Tarea 3, con la prueba de navegador del clic.
4. **Soltar fuera del canvas.** El botón no puede quedar «trabado» apretado. Se resuelve con `setPointerCapture`, y se prueba en la Tarea 3 soltando fuera.
5. **Un choque o un cometa mientras se carga.** Los cuerpos que se juntan no están `ORBITING`, así que nadie los roba ni los pierde dos veces. Se prueba en la Tarea 2.

---

### Tarea 1: quitar el eclipse

**Archivos:**
- Modificar:
  - `src/sim/world.ts`: borrar `eclipses`, `eclipseAngle`, `eclipseStrength`, `eclipseCd`, `beamTime` y `comets.beamId`;
  - `src/sim/config.ts`: borrar `eclipse*` y `beam*`;
  - `src/sim/step.ts`: borrar la función `eclipse`, sus casillas y las líneas que la llaman o descuentan;
  - `src/sim/comets.ts`: borrar el daño del rayo y `beamId`;
  - `src/sim/phase.ts`: borrar `w.beamTime = 0`;
  - `src/render/layers.ts`: quitar `createBeamLayer`;
  - `src/ui/hud.ts`: quitar el `span.ecl`, su texto, su registro y `seen.eclipses`;
  - `src/ui/gameOver.ts`: la fila `ECLIPSES` pasa a `BÓLIDOS`, que en esta tarea muestra `0` fijo y se conecta en la Tarea 2;
  - `tests/balance/bot.test.ts`: quitar `eclipses=` del registro.
- Borrar:
  - `src/render/fx/beam.ts`;
  - `tests/unit/eclipse.test.ts`;
  - en `tests/e2e/lab.spec.ts`, la prueba «el eclipse dibuja el rayo»;
  - en `tests/unit/comets.test.ts`, la prueba «el rayo del eclipse lo destruye…», que se reemplaza en la Tarea 2;
  - en `tests/unit/phase.test.ts`, la prueba «al colapsar se apaga el rayo del eclipse», que se reemplaza en la Tarea 2.

- [ ] **Paso 1:** borrar todo lo de la lista. Correr `npm run typecheck` y seguir los errores hasta que no quede ninguna referencia. Después correr `grep -rn "eclipse\|beam" src tests`: tiene que quedar vacío. En `phase.ts` no queda ninguna mención.
- [ ] **Paso 2:** correr `npx vitest run && npx playwright test --project=web`. Se espera que PASE todo, con 4 pruebas unitarias y 1 de navegador menos.
- [ ] **Paso 3:** hacer commit con el mensaje «Se elimina el eclipse automático y su rayo: el lanzamiento pasa a ser una jugada».

---

### Tarea 2: el lanzamiento cargado en la simulación

**Archivos:**
- Crear: `src/sim/launch.ts`
- Modificar:
  - `src/sim/world.ts`: estados nuevos y campos `charge`, `gathered`, `boltAngle`, `bolts`, `lastBoltSize`, `boltHitsBh` y `bhSlow`;
  - `src/sim/config.ts`: los valores nuevos;
  - `src/sim/step.ts`: mover allí `slingAngle` y `sling`, sumar `Intent.hold`, llamar a la carga y al vuelo, y frenar al agujero negro;
  - `src/sim/comets.ts`: un bólido mata al cometa;
  - `src/sim/phase.ts`: el colapso suelta la carga.
- Prueba: `tests/unit/launch.test.ts`; una prueba en `tests/unit/comets.test.ts`; una en `tests/unit/phase.test.ts`.

**Interfaces:**
- Produce:
  - `GATHERING = 8, BOLT = 9`;
  - `Intent.hold?: boolean`;
  - `stepLaunch(w: World, intent: Intent): void`, que maneja carga, toque y lanzamiento;
  - `stepBolts(w: World, bandHi: number): void`, que mueve lo que se junta y lo que vuela;
  - `releaseLaunch(w: World): void`, que usa el colapso;
  - `slingAngle(w, intent): number` y `sling(w, aim): void`, movidos desde `step.ts`;
  - en `World`: `charge`, `gathered`, `boltAngle`, `bolts`, `lastBoltSize`, `boltHitsBh` y `bhSlow`.

- [ ] **Paso 1: escribir las pruebas que fallan**

```ts
// tests/unit/launch.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { addBody, BOLT, createWorld, FREE, GATHERING, KIND_ASTEROID, KIND_ROCKY, ORBITING, PROJECTILE, type World } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, cometFirst: 1e9, blackHole: false };
const count = (w: World, st: number): number => { let n = 0; for (let i = 0; i < w.count; i++) if (w.state[i] === st) n++; return n; };
function orbitWorld(n = 20, config = cfg): World {
  const w = createWorld(config, 5, 60);
  w.star.mass = 50;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; addBody(w, { x: Math.cos(a) * 9, y: Math.sin(a) * 9, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID }); }
  const idle: Intent = { targetX: 0, targetY: 0, hasTarget: false };
  for (let k = 0; k < 120; k++) step(w, idle);
  return w;
}
const hold = (aimX = 100, aimY = 0): Intent => ({ targetX: 0, targetY: 0, hasTarget: false, hold: true, aimX, aimY, hasAim: true });
const free = (aimX = 100, aimY = 0): Intent => ({ targetX: 0, targetY: 0, hasTarget: false, hold: false, aimX, aimY, hasAim: true });
const run = (w: World, secs: number, it: Intent): void => { for (let k = 0; k < Math.round(secs * 60); k++) step(w, it); };

describe('lanzamiento cargado', () => {
  it('un toque lanza un asteroide que vuelve', () => {
    const w = orbitWorld();
    const n0 = w.orbitingCount;
    step(w, hold()); step(w, free());
    expect(w.shots).toBe(1);
    expect(count(w, PROJECTILE)).toBe(1);
    expect(w.orbitingCount).toBe(n0 - 1);
    expect(count(w, BOLT)).toBe(0);
  });
  it('mantener junta asteroides; al soltar sale el bólido y perdés su masa', () => {
    const w = orbitWorld();
    const n0 = w.orbitingCount;
    run(w, 1, hold());
    const g = w.gathered;
    expect(g).toBe(1 + Math.floor((1 - cfg.tapTime) * cfg.boltGatherRate));
    expect(count(w, GATHERING)).toBe(g);
    expect(w.orbitingCount).toBe(n0 - g);
    const m0 = w.star.mass;
    step(w, free());
    expect(count(w, BOLT)).toBe(g);
    expect(w.bolts).toBe(1);
    expect(w.lastBoltSize).toBe(g);
    expect(w.star.mass).toBeLessThan(m0);
    expect(w.gathered).toBe(0);
  });
  it('el bólido tiene un límite', () => {
    const w = orbitWorld();
    run(w, 6, hold());
    expect(w.gathered).toBe(cfg.boltMax);
  });
  it('lo que se junta se compacta adelante de la estrella, hacia donde apuntás', () => {
    const w = orbitWorld();
    run(w, 3.5, hold(100, 0));   // tiempo para que lleguen hasta los últimos que se sumaron
    for (let i = 0; i < w.count; i++) if (w.state[i] === GATHERING) {
      expect(w.x[i] - w.star.x).toBeGreaterThan(0);
      expect(Math.abs(w.y[i] - w.star.y)).toBeLessThan(4);
    }
  });
  it('el bólido sale hacia la mira y al terminar el vuelo queda suelto, lento y sin recapturarse enseguida', () => {
    const w = orbitWorld();
    run(w, 1, hold(0, 100));
    step(w, free(0, 100));
    for (let i = 0; i < w.count; i++) if (w.state[i] === BOLT) expect(w.vy[i]).toBeGreaterThan(cfg.boltSpeed * 0.8);
    run(w, cfg.boltLife + 0.05, free(0, 100));
    expect(count(w, BOLT)).toBe(0);
    let lost = 0;
    for (let i = 0; i < w.count; i++) if (w.state[i] === FREE && w.noCatch[i]! > 0) { lost++; expect(Math.hypot(w.vx[i], w.vy[i])).toBeLessThan(cfg.boltSpeed * 0.3); }
    expect(lost).toBeGreaterThan(0);
  });
  it('nunca se lanza un planeta', () => {
    const w = orbitWorld(3);
    const p = addBody(w, { x: 12, y: 0, vx: 0, vy: 0, radius: 2, kind: KIND_ROCKY });
    w.state[p] = ORBITING; w.orbitR[p] = 12; w.orbitTarget[p] = 12; w.orbitingCount++;
    run(w, 3, hold());
    expect(w.state[p]).toBe(ORBITING);
    step(w, free());
    expect(w.state[p]).toBe(ORBITING);
  });
  it('sin asteroides o con la honda recargando no carga nada ni queda colgado', () => {
    const w = orbitWorld(0);
    run(w, 1, hold()); step(w, free());
    expect(w.charge).toBe(0); expect(w.bolts).toBe(0); expect(w.shots).toBe(0);
    const v = orbitWorld();
    v.slingCd = 5;
    run(v, 1, hold()); step(v, free());
    expect(v.charge).toBe(0); expect(v.bolts).toBe(0);
  });
  it('lo que se está juntando no lo pierde un choque ni lo roba nadie (no está en órbita)', () => {
    const w = orbitWorld();
    run(w, 1, hold());
    for (let i = 0; i < w.count; i++) if (w.state[i] === GATHERING) expect(w.state[i]).not.toBe(ORBITING);
    expect(w.orbitingCount + w.gathered).toBe(20);
  });
  it('contra el agujero negro: lo alimenta y lo frena', () => {
    const w = orbitWorld(20, { ...cfg, blackHole: true });
    w.bh.x = w.bh.prevX = 40; w.bh.y = w.bh.prevY = 0; w.bh.speed = 0;
    const m0 = w.bh.mass;
    run(w, 1, hold(100, 0));
    step(w, free(100, 0));
    run(w, 1, free(100, 0));
    expect(w.boltHitsBh).toBeGreaterThan(0);
    expect(w.bh.mass).toBeGreaterThan(m0);
    expect(w.bhSlow).toBeGreaterThan(0);
  });
});
```

Agregar a `tests/unit/comets.test.ts`, en lugar de la prueba borrada del rayo:
```ts
  it('un bólido lo destruye de un golpe: suelta lo robado y deja asteroides', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 }, 1, 40);
    const k = spawnComet(w, 30, 0);
    const b = addBody(w, { x: 30, y: 0, vx: 0, vy: 0, radius: 0.6, kind: KIND_ASTEROID });
    w.state[b] = BOLT; w.life[b] = 1;
    step(w, { targetX: 0, targetY: 0, hasTarget: false });
    expect(w.comets.mode[k]).toBe(0);
    expect(w.cometKills).toBe(1);
  });
```
Importar `BOLT` y `addBody`/`KIND_ASTEROID` si faltan, y `spawnComet` si no está.

Agregar a `tests/unit/phase.test.ts`, dentro de `describe('correcciones de la revisión'`:
```ts
  it('al colapsar, lo que se juntaba vuelve a la órbita y el bólido en vuelo queda suelto', () => {
    const w = hyperWorld();
    const a = addBody(w, { x: 9, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    const b = addBody(w, { x: 40, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    step(w, idle);
    w.state[a] = GATHERING; w.orbitingCount--; w.gathered = 1; w.charge = 1;
    w.state[b] = BOLT; w.life[b] = 1;
    step(w, { ...press, hold: true });   // sigue apretado: si lo suelta, el bólido sale antes de colapsar
    expect(w.state[a]).toBe(ORBITING);
    expect(w.state[b]).toBe(FREE);
    expect(w.charge).toBe(0); expect(w.gathered).toBe(0);
  });
```
(Importar `BOLT` y `GATHERING`.)

- [ ] **Paso 2: correrlas para verificar que fallan**

Correr: `npx vitest run tests/unit/launch.test.ts tests/unit/comets.test.ts tests/unit/phase.test.ts`
Se espera que FALLEN porque no existen `GATHERING`, `BOLT` ni `hold`.

- [ ] **Paso 3: mundo y configuración**

En `src/sim/world.ts`, después de `ABSORBING = 7`:
```ts
export const GATHERING = 8;      // se está juntando en el bólido mientras se mantiene el botón
export const BOLT = 9;           // parte de un bólido lanzado: dejó la órbita y se pierde
```
En `World`, después de `shots`:
```ts
  charge: number;        // segundos que se viene manteniendo el botón de lanzar (0 = suelto)
  gathered: number;      // cuerpos juntados en el bólido que se está cargando
  boltAngle: number;     // hacia dónde sale el bólido
  bolts: number;         // bólidos lanzados (evento)
  lastBoltSize: number;  // cuántos cuerpos tenía el último
  boltHitsBh: number;    // bólidos que le pegaron al agujero negro (evento)
  bhSlow: number;        // segundos que el agujero negro sigue frenado por un bólido
```
En `createWorld`: `charge: 0, gathered: 0, boltAngle: 0, bolts: 0, lastBoltSize: 0, boltHitsBh: 0, bhSlow: 0,`.

En `src/sim/config.ts`, agregar a la interfaz:
```ts
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
```
Y a `DEFAULT_CONFIG` los valores de las restricciones globales.

- [ ] **Paso 4: `src/sim/launch.ts`**

```ts
import { DT } from './config';
import type { Intent } from './step';
import { BOLT, DEAD, FREE, GATHERING, KIND_ASTEROID, KIND_MOON, ORBITING, PROJECTILE, RETURNING, type World } from './world';

// Lanzamiento con un solo botón. Un toque lanza un asteroide que vuelve (la honda).
// Mantenido, junta asteroides de la órbita en un bólido adelante de la estrella; al soltar sale, y esos asteroides se pierden.
// Nunca se lanzan planetas: sólo asteroides y lunas chicas.

const launchable = (w: World, i: number): boolean => w.state[i] === ORBITING && (w.kind[i] === KIND_ASTEROID || w.kind[i] === KIND_MOON);

// (Pegar acá `slingAngle` tal como está hoy en step.ts.)

// Honda: lanza el cuerpo lanzable cuyo ángulo está más cerca de la mira.
export function sling(w: World, aim: number): void {
  const c = w.config, s = w.star;
  let best = -1, bestDiff = Infinity;
  for (let i = 0; i < w.count; i++) {
    if (!launchable(w, i)) continue;
    let d = Math.abs(w.orbitAngle[i] - aim) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  if (best < 0) return;
  w.state[best] = PROJECTILE;
  w.vx[best] = Math.cos(aim) * c.slingSpeed + s.vx;
  w.vy[best] = Math.sin(aim) * c.slingSpeed + s.vy;
  w.life[best] = c.slingLife;
  w.orbitingCount--;
  w.slingCd = c.slingCooldown;
  w.shots++;
}

// Suma al bólido el cuerpo lanzable más cercano a la mira. false si no queda ninguno.
function gatherOne(w: World): boolean {
  let best = -1, bestDiff = Infinity;
  for (let i = 0; i < w.count; i++) {
    if (!launchable(w, i)) continue;
    let d = Math.abs(w.orbitAngle[i] - w.boltAngle) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  if (best < 0) return false;
  w.state[best] = GATHERING;
  w.orbitingCount--;
  w.gathered++;
  return true;
}

function launchBolt(w: World): void {
  const c = w.config, s = w.star;
  if (w.gathered === 0) return;
  const ax = Math.cos(w.boltAngle), ay = Math.sin(w.boltAngle);
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== GATHERING) continue;
    w.state[i] = BOLT;
    w.vx[i] = ax * c.boltSpeed + s.vx; w.vy[i] = ay * c.boltSpeed + s.vy;
    w.life[i] = c.boltLife;
    s.mass = Math.max(c.starStartMass, s.mass - w.mass[i]);   // se pierde: un golpe fuerte te deja más liviano
  }
  w.lastBoltSize = w.gathered;
  w.gathered = 0;
  w.bolts++;
  w.slingCd = c.slingCooldown;
}

// Lee el botón: mientras se mantiene, carga; al soltarlo, toque o bólido.
export function stepLaunch(w: World, intent: Intent): void {
  const c = w.config;
  if (intent.hold === true) {
    if (w.charge === 0 && (w.slingCd > 0 || w.orbitingCount === 0)) return;   // no arranca a cargar
    w.charge += DT;
    const a = slingAngle(w, intent);
    if (Number.isFinite(a)) w.boltAngle = a;
    if (w.charge >= c.tapTime) {
      const want = Math.min(c.boltMax, 1 + Math.floor((w.charge - c.tapTime) * c.boltGatherRate));
      while (w.gathered < want && gatherOne(w)) { /* suma de a uno */ }
    }
    return;
  }
  if (w.charge <= 0) return;
  const tap = w.charge < c.tapTime;
  w.charge = 0;
  if (tap) { if (w.orbitingCount > 0) sling(w, w.boltAngle); return; }
  launchBolt(w);
}

// Lo que se junta se compacta adelante de la estrella; lo que vuela sigue derecho, le pega al agujero negro o se pierde.
export function stepBolts(w: World, bandHi: number): void {
  const c = w.config, s = w.star, bh = w.bh;
  const px = s.x + Math.cos(w.boltAngle) * (bandHi + c.boltGatherDist);
  const py = s.y + Math.sin(w.boltAngle) * (bandHi + c.boltGatherDist);
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st === GATHERING) {
      // Cada uno tiene su lugarcito en el montón (según su índice), para que no queden encimados.
      const off = ((i * 0.618034) % 1) * Math.PI * 2, rr = 0.6 + ((i * 0.381966) % 1) * 1.2;
      const tx = px + Math.cos(off) * rr - w.x[i], ty = py + Math.sin(off) * rr - w.y[i];
      const d = Math.hypot(tx, ty), step = Math.min(d, 40 * DT);
      if (d > 1e-6) { w.x[i] += (tx / d) * step; w.y[i] += (ty / d) * step; }
      w.vx[i] = s.vx; w.vy[i] = s.vy;
    } else if (st === BOLT) {
      w.x[i] += w.vx[i] * DT; w.y[i] += w.vy[i] * DT;
      if (bh.active) {
        const gx = bh.x - w.x[i], gy = bh.y - w.y[i];
        if (gx * gx + gy * gy < bh.radius * bh.radius * 1.44) {
          // Le pegó al agujero negro: lo alimenta y lo frena un poco. No lo empuja.
          w.state[i] = DEAD;
          bh.mass += w.mass[i] * c.boltBhFeed;
          if (w.bhSlow <= 0) w.boltHitsBh++;
          w.bhSlow = c.boltBhSlow;
          continue;
        }
      }
      w.life[i] = w.life[i]! - DT;
      if (w.life[i]! <= 0) {
        w.state[i] = FREE;
        w.vx[i] *= c.boltLoseSlow; w.vy[i] *= c.boltLoseSlow;
        w.noCatch[i] = c.boltNoCatch;
      }
    }
  }
}

// Colapso: lo que se juntaba vuelve a la órbita y lo que vuela (bólido u honda) queda suelto.
export function releaseLaunch(w: World): void {
  for (let i = 0; i < w.count; i++) {
    const st = w.state[i];
    if (st === GATHERING) { w.state[i] = ORBITING; w.orbitingCount++; }
    else if (st === BOLT || st === PROJECTILE || st === RETURNING) w.state[i] = FREE;
  }
  w.charge = 0; w.gathered = 0;
}
```

- [ ] **Paso 5: conectarlo en `step.ts`, `comets.ts` y `phase.ts`**

En `step.ts`:
- borrar `slingAngle` y `sling`, que ahora viven en `launch.ts`, e importar desde allí `sling, slingAngle, stepBolts, stepLaunch`;
- sumar a `Intent` la línea `hold?: boolean;   // el botón de lanzar está apretado (mantener carga el bólido)`;
- en el bucle de cuerpos, cambiar `if (st === DEAD || st === CARRIED) continue;` por `if (st === DEAD || st === CARRIED || st === GATHERING || st === BOLT) continue;` e importar `GATHERING` y `BOLT`;
- al principio, junto a los otros descuentos: `if (w.bhSlow > 0) w.bhSlow = Math.max(0, w.bhSlow - DT);`;
- en la persecución, sin caza, cambiar `bh.vx = (dx / d) * bh.speed; bh.vy = (dy / d) * bh.speed;` por:
  ```ts
  const v = w.bhSlow > 0 ? bh.speed * c.boltBhSlowFactor : bh.speed;   // un bólido lo frena unos segundos
  bh.vx = (dx / d) * v; bh.vy = (dy / d) * v;
  ```
- después de `if (!hunting) stepComets(w);`, reemplazar el bloque de la honda por:
  ```ts
  if (!hunting) {
    stepBolts(w, bandHi);
    if (intent.fire && w.slingCd <= 0 && w.orbitingCount > 0) {   // disparo directo (bot y pruebas)
      const a = slingAngle(w, intent);
      if (Number.isFinite(a)) sling(w, a);
    }
    stepLaunch(w, intent);
  }
  ```

En `comets.ts`, en el bucle de «Golpes de honda», agregar el bólido:
```ts
    if (w.state[i] !== PROJECTILE && w.state[i] !== BOLT) continue;
    ...
      if (... < r * r) {
        if (w.state[i] === BOLT) { damage(w, k, c.cometHp); break; }   // un bólido lo destruye de un golpe y sigue de largo
        w.state[i] = RETURNING;
        damage(w, k, 1);
        break;
      }
```
Actualizar el comentario a «Golpes de honda (3 lo matan) y de bólido (1 lo mata)».

En `phase.ts`, en `startCollapse`, reemplazar el bucle que suelta proyectiles por `releaseLaunch(w);`, importado desde `./launch`.

- [ ] **Paso 6: correr las pruebas**

Correr: `npx vitest run && npm run typecheck`
Se espera que PASE todo. `sling.test.ts` sigue andando con `fire`.

- [ ] **Paso 7: commit** con el mensaje «Lanzamiento cargado: toque (asteroide que vuelve) o mantenido (bólido que se pierde, mata cometas y frena al agujero negro alimentándolo)».

---

### Tarea 3: el control (mantener), el visor y el cartel

**Archivos:**
- Modificar: `src/input/controller.ts`, `src/ui/hud.ts`, `src/ui/gameOver.ts` y `src/dev/visual-lab/main.ts` (limpiar `intent.collapse`, que quedó como menor pendiente)
- Prueba: `tests/e2e/launch.spec.ts`

- [ ] **Paso 1: escribir la prueba que falla**

```ts
// tests/e2e/launch.spec.ts
import { expect, test } from '@playwright/test';

test('mantener el clic arma un bólido y al soltar sale', async ({ page }) => {
  // Para que capture rápido: la estrella se mueve en círculo por zonas con asteroides.
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  for (let k = 0; k < 160 && (await page.evaluate(() => window.__GAME__!.world.orbitingCount)) < 15; k++) {
    const a = k * 0.15; await page.mouse.move(640 + Math.cos(a) * 420, 360 + Math.sin(a) * 220); await page.waitForTimeout(50);
  }
  await page.mouse.move(900, 360);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await expect(page.locator('.hud .sling')).toContainText('BÓLIDO');
  await page.screenshot({ path: 'artifacts/e2e/bolido-cargando.png' });
  await page.mouse.up();
  await page.waitForFunction(() => window.__GAME__!.world.bolts === 1, undefined, { timeout: 3_000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/e2e/bolido-sale.png' });
  expect(await page.evaluate(() => window.__GAME__!.world.lastBoltSize)).toBeGreaterThan(3);
});

test('un clic rápido es un toque (honda), y soltar fuera de la ventana no deja el botón trabado', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  for (let k = 0; k < 160 && (await page.evaluate(() => window.__GAME__!.world.orbitingCount)) < 5; k++) {
    const a = k * 0.15; await page.mouse.move(640 + Math.cos(a) * 420, 360 + Math.sin(a) * 220); await page.waitForTimeout(50);
  }
  await page.mouse.click(900, 360);
  await page.waitForFunction(() => window.__GAME__!.world.shots >= 1, undefined, { timeout: 3_000 });
  await page.mouse.move(900, 360); await page.mouse.down(); await page.mouse.move(1500, 900); await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__GAME__!.world.charge)).toBe(0);
});
```

- [ ] **Paso 2: correrla para verificar que falla.** Correr `npx playwright test tests/e2e/launch.spec.ts --project=web`. Se espera que FALLE, porque el control todavía no envía `hold`.

- [ ] **Paso 3: el control**

En `src/input/controller.ts`:
- reemplazar `firePending` por `pointerHeld` y `pressPending`. En `pointerdown`, botón 0: `this.pointerHeld = true; this.pressPending = true; (el as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);`;
- agregar el oyente `el.addEventListener('pointerup', (e) => { if (e.button === 0) this.pointerHeld = false; });` y `pointercancel`, que también pone `pointerHeld = false`;
- en `poll`, reemplazar el bloque del gatillo y `intent.fire` por:
  ```ts
  let trigger = false;
  for (let k = 0; k < pads.length; k++) if (pads[k]?.buttons?.[7]?.pressed) trigger = true;
  // Botón de lanzar: mantenido carga el bólido. Un clic más rápido que un cuadro igual cuenta (pressPending).
  this.intent.hold = this.pointerHeld || this.pressPending || trigger;
  this.pressPending = false;
  this.intent.fire = false;
  ```
- quitar `triggerHeld` si queda sin usar.

En `src/dev/visual-lab/main.ts`, en el bucle de pasos, sumar `intent.collapse = false;`.

- [ ] **Paso 4: el visor y el cartel**

En `src/ui/hud.ts`:
- el texto de `.sling` pasa a `w.charge >= w.config.tapTime ? \`BÓLIDO ×${w.gathered}\` : w.slingCd > 0 ? 'HONDA ○' : 'HONDA ●'`;
- en `seen`, sumar `bolts` y `bh` (con `w.bolts` y `w.boltHitsBh`), tanto en la declaración como en `reset`;
- en el registro:
  ```ts
  if (w.bolts > seen.bolts) log(`BÓLIDO: SALIERON ${w.lastBoltSize} ASTEROIDES DE TU ÓRBITA`);
  if (w.boltHitsBh > seen.bh) log('EL BÓLIDO FRENÓ AL AGUJERO NEGRO, PERO LO ALIMENTÓ');
  seen.bolts = w.bolts; seen.bh = w.boltHitsBh;
  ```

En `src/ui/gameOver.ts`, la fila `BÓLIDOS` muestra `${w.bolts}`.

- [ ] **Paso 5: correr todo.** Correr `npx vitest run && npm run typecheck && npx playwright test --project=web`. Se espera que PASE. Mirar las capturas `bolido-cargando.png` y `bolido-sale.png`: el montón tiene que verse adelante de la estrella.

- [ ] **Paso 6: commit** con el mensaje «Control: mantener el clic o el gatillo carga el bólido; visor y cartel con los bólidos».

---

### Tarea 4: verificación final

- [ ] `npm run bench`: el p99 tiene que quedar cerca de 5,7 ms. Anotarlo.
- [ ] `npm run balance`: el bot sigue usando el disparo directo. Anotar las victorias: sin el eclipse puede cambiar la dificultad, porque el eclipse mataba cometas solo.
- [ ] `npm run test:electron`.
- [ ] Revisión final de la rama con un revisor nuevo, y una sola pasada de correcciones.
- [ ] Bitácora en Notion y `git push`.
