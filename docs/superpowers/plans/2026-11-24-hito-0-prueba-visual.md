# Hito 0 — Prueba visual y técnica: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** demostrar que con código llegamos al estilo cinemático. La escena tiene:
- una estrella que el jugador mueve y que captura asteroides, que quedan orbitando;
- planetas con luz y atmósfera;
- una nebulosa;
- un agujero negro con lente gravitatoria.

Además se entregan un laboratorio visual para ajustar todo en vivo y un banco de estrés de 2.000 asteroides y 300 cuerpos que mide si llegamos a 60 FPS.

**Arquitectura:**
- La simulación (`src/sim/`) es TypeScript puro y determinista, con paso fijo de 60 Hz y semilla, sin dependencias.
- El dibujo (`src/render/`) lee el estado de la simulación e interpola entre pasos. Se arma como una lista de capas (`Layer`) sobre un único pipeline de Three.js + postprocessing.
- El juego, el laboratorio y el banco son tres páginas (`index.html`, `lab.html`, `bench.html`) que comparten la misma vista.
- Electron sólo envuelve `index.html`; el laboratorio y el banco no entran en el ejecutable.

**Stack:** TypeScript 7, Three.js 0.187, postprocessing 6.39, Vite 8, electron-vite 6, Electron 45, Vitest 5, Playwright 1.65, Tweakpane 4, stats-gl 4.

**Diseño:** `docs/superpowers/specs/2026-11-24-enjambre-gravitatorio-design.md` (secciones 7, 8, 9 y 10, hito 0). Las reglas del proyecto están en `CLAUDE.md`.

## Restricciones globales

- **Versiones exactas:** `three@0.187.0` (postprocessing 6.39.6 exige `three >= 0.168 < 0.188`), `postprocessing@6.39.6`, `electron@45.5.0`, `electron-vite@6.0.0`, `vite@8.3.8`, `typescript@7.0.2`, `vitest@5.1.1`, `@playwright/test@1.65.1`, `tweakpane@4.0.5`, `stats-gl@4.2.3`, `@types/three@0.187.0`. Node ≥ 22.12 (en la máquina hay v24.18).
- **No se agregan otras dependencias** en este hito. `@three.ez/instanced-mesh` y `three.quarks` quedan para el hito 1: alcanza con el `InstancedMesh` de Three.js y todavía no hay partículas.
- **Electron:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. El preload sólo expone `window.platform = { kind: 'electron' }`.
- **Simulación:** no importa nada de `three` ni del DOM. Todo el azar sale de `createRng(seed)`; está prohibido `Math.random` en `src/sim/`.
- **Bucles por cuadro:** no se crean objetos (`new`, literales `{}` o `[]`, closures) dentro de `update`, `render` ni `step`. Los temporales se crean una vez, a nivel de módulo o de fábrica.
- **Cámara:** ortográfica mirando hacia −Z desde z = 100. El mundo es el plano XY con la arena de ±160 × ±90 unidades. Profundidades: nebulosa z = −300, estrellas de fondo z = −250, cuerpos z = 0.
- **Colores:** se escriben en sRGB (`'#rrggbb'`) y se cargan con `Color.set()`, que los convierte a lineal. El tone mapping lo hace `ToneMappingEffect(ACES_FILMIC)` de postprocessing, con `renderer.toneMapping = NoToneMapping`.
- **Rendimiento:** 60 FPS en el banco (2.000 asteroides y 300 cuerpos), con promedio ≤ 16,9 ms y p99 ≤ 20 ms en la máquina de Lucas. Presupuesto por cuadro: simulación ≤ 3 ms de CPU, render ≤ 8 ms de GPU y postproceso ≤ 3 ms de GPU.
- **Idioma:** todo texto visible, cada mensaje de commit y cada comentario de código va en español rioplatense. Los identificadores quedan en inglés.
- **Licencias:** las referencias de shaders (space-3d, threejs-procedural-planets) se usan sólo para leer. El ruido simplex 3D es de Ashima Arts e Ian McEwan (MIT) y va con su atribución.
- **Commits:** cada uno termina con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Registro:** al cerrar cada tarea se actualiza su fila en la base "Tareas" de Notion (MCP `notion-juego`, que se crea en la Tarea 0), con estado "Hecha" y el hash del commit.

## Foco de revisión

Son casos que el diseño implica y que la prueba normal no ejercitaría. Cada uno tiene su prueba en la tarea indicada:

1. **Pestaña dormida o pico enorme de tiempo:** la simulación da como máximo 5 pasos y no arrastra atraso. Prueba en la Tarea 4.
2. **Ventana redimensionada o DPR distinto:** el canvas, el composer y la cámara se ajustan, sin estirar la imagen. Prueba e2e en la Tarea 6.
3. **Sin WebGL2:** se muestra un aviso en español en lugar de una pantalla negra. Prueba e2e en la Tarea 6.
4. **El mouse sale de la ventana, se suelta el joystick o llegan ejes NaN:** la estrella mantiene su objetivo o se queda quieta, nunca da NaN. Pruebas en las Tareas 3 y 5.
5. **Más capturas que la capacidad de la órbita:** lo que sobra queda libre y no se desborda ningún array. Prueba en la Tarea 3.

---

## Mapa de archivos

```
package.json, tsconfig.json, electron.vite.config.ts, vitest.config.ts, playwright.config.ts, .gitignore
src/main/index.ts               Proceso principal de Electron (ventana segura)
src/preload/index.ts            Puente mínimo: window.platform
src/renderer/index.html|lab.html|bench.html   Entradas (juego, laboratorio, banco)
src/renderer/style.css          Estilos base y aviso de error
src/renderer/game.ts|lab.ts|bench.ts           Arranque de cada página
src/renderer/globals.d.ts       Tipos de window.__GAME__, __LAB__, __BENCH_RESULT__ y platform
src/sim/config.ts               SimConfig, DEFAULT_CONFIG, DT
src/sim/rng.ts                  createRng (mulberry32)
src/sim/world.ts                World (arrays tipados), createWorld, addBody, hashWorld
src/sim/step.ts                 Intent, step()
src/sim/loop.ts                 FixedStepper
src/perf/frameTimes.ts          FrameTimeRecorder (promedio y percentiles)
src/perf/qualityGovernor.ts     QualityGovernor (baja la calidad si no da)
src/input/gamepad.ts            applyDeadzone
src/input/controller.ts         InputController (mouse + joystick → Intent)
src/render/quality.ts           Presets de calidad
src/render/camera.ts            fitView, screenToWorld
src/render/context.ts           getWebGL2, showFatal y mensajes
src/render/params.ts            ViewParams, DEFAULT_PARAMS
src/render/layer.ts             Layer, FrameContext
src/render/pipeline.ts          WebGLRenderer + EffectComposer (lente, bloom, viñeta, ACES)
src/render/spaceView.ts         createSpaceView: arma todo y expone update, render y diagnostics
src/render/layers.ts            buildLayers: lista de capas
src/render/shaders/noise.ts     Simplex 3D + fbm (GLSL)
src/render/shaders/common.ts    Vertex shaders compartidos
src/render/background/nebula.ts     Capa nebulosa (render a textura en baja resolución)
src/render/background/starfield.ts  Capa estrellas de fondo (3 planos de paralaje)
src/render/bodies/star.ts       Capa estrella del jugador (núcleo, corona, anillo de captura)
src/render/bodies/planets.ts    Capa planetas instanciados (roca, hielo, gas) + atmósfera
src/render/bodies/asteroids.ts  Capa asteroides instanciados
src/render/blackhole/lensPass.ts    Pasada de lente gravitatoria
src/render/blackhole/blackHole.ts   Capa agujero negro (horizonte, disco, anillo de fotones)
src/dev/visual-lab/main.ts      Laboratorio (Tweakpane + stats-gl)
src/dev/benchmarks/main.ts      Banco de estrés
src/dev/benchmarks/result.ts    Tipo BenchResult
tests/unit/*.test.ts            Vitest (sim, perf, input, cámara)
tests/e2e/*.spec.ts             Playwright (web, electron, bench, shots)
```

---

### Tarea 0: Base de tareas en Notion

Esta tarea no lleva código.

- [ ] **Paso 1:** con `notion-get-self` (MCP `notion-juego`), confirmar que la cuenta es `lfigueiraduarte@gmail.com` y el espacio "Estudio Game".
- [ ] **Paso 2:** crear la base de datos "Tareas" dentro de la página "Juego propio — Bitácora del proyecto" (`422f21dea7dd8187b19efe7974cd9afc`) con estas propiedades:
  - Tarea (título)
  - Hito (selección: "Hito 0" … "Hito 4")
  - Estado (selección: Pendiente, En curso, Hecha)
  - Fecha (fecha)
  - Commit (texto)
- [ ] **Paso 3:** cargar una fila por cada tarea de este plan (1 a 11), con Hito "Hito 0" y Estado "Pendiente".

---

### Tarea 1: Base del proyecto (Electron + Vite + pruebas)

**Archivos:**
- Crear: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- Crear: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/style.css`, `src/renderer/game.ts`, `src/renderer/globals.d.ts`
- Modificar: `.gitignore`
- Pruebas: `tests/unit/sanity.test.ts`, `tests/e2e/boot.spec.ts`, `tests/e2e/electron.spec.ts`

**Interfaces:**
- Produce:
  - `npm run dev` (Electron), `npm run dev:web` (navegador en el puerto 5174), `npm test`, `npm run test:e2e`, `npm run test:electron` y `npm run typecheck`.
  - `window.platform?.kind === 'electron'` dentro de Electron.

- [ ] **Paso 1: Crear `package.json`**

```json
{
  "name": "enjambre-gravitatorio",
  "version": "0.0.1",
  "private": true,
  "description": "Enjambre gravitatorio",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "dev:web": "vite src/renderer --port 5174 --strictPort",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test --project=web",
    "test:electron": "npm run build && playwright test --project=electron",
    "bench": "playwright test --project=bench --headed",
    "shots": "playwright test --project=shots"
  }
}
```

- [ ] **Paso 2: Instalar las dependencias exactas**

```bash
npm install three@0.187.0 postprocessing@6.39.6 tweakpane@4.0.5 stats-gl@4.2.3
npm install -D electron@45.5.0 electron-vite@6.0.0 vite@8.3.8 typescript@7.0.2 vitest@5.1.1 @playwright/test@1.65.1 @types/three@0.187.0 @types/node@24
npx playwright install chromium
```

Esperado: termina sin errores. Si npm se queja de la dependencia peer `@swc/core` de electron-vite, ignorar el aviso: es opcional. Sólo si falla de verdad, instalar `npm install -D @swc/core`.

- [ ] **Paso 3: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node", "vite/client"]
  },
  "include": ["src", "tests", "electron.vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

Si `typescript@7.0.2` rechaza alguna opción al correr `npm run typecheck`, se sacan sólo las opciones que rechaza (mirar el mensaje). Si el problema persiste, se fija `typescript@5.9` y se anota en Notion.

- [ ] **Paso 4: Crear `electron.vite.config.ts`, `vitest.config.ts` y `playwright.config.ts`**

```ts
// electron.vite.config.ts
import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    server: { port: 5173, strictPort: true },
  },
});
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const gpuArgs = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:5174' },
  webServer: {
    command: 'npm run dev:web',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'web',
      testIgnore: /(bench|electron|shots)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, launchOptions: { args: gpuArgs } },
    },
    {
      name: 'shots',
      testMatch: /shots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, launchOptions: { args: gpuArgs } },
    },
    {
      name: 'bench',
      testMatch: /bench\.spec\.ts/,
      timeout: 150_000,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, launchOptions: { args: gpuArgs } },
    },
    { name: 'electron', testMatch: /electron\.spec\.ts/ },
  ],
});
```

- [ ] **Paso 5: Crear Electron (principal y preload)**

```ts
// src/main/index.ts
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#000000',
    show: false,
    autoHideMenuBar: true,
    title: 'Enjambre gravitatorio',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
}

void app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

```ts
// src/preload/index.ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('platform', { kind: 'electron' });
```

Nota: el `package.json` **no** lleva `"type": "module"`. Así electron-vite genera `out/preload/index.js` en CommonJS, que es lo que exige `sandbox: true`.

- [ ] **Paso 6: Crear la página del juego**

```html
<!-- src/renderer/index.html -->
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:" />
    <title>Enjambre gravitatorio</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="./game.ts"></script>
  </body>
</html>
```

```css
/* src/renderer/style.css */
html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
canvas#game { display: block; width: 100vw; height: 100vh; cursor: crosshair; }
.fatal {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 2rem; color: #e8e8f0; font: 16px/1.5 system-ui, sans-serif; text-align: center; background: #05060a;
}
```

```ts
// src/renderer/game.ts  (en la Tarea 6 se reemplaza por el juego real)
const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Falta el canvas #game');
```

```ts
// src/renderer/globals.d.ts
declare global {
  interface Window {
    platform?: { kind: 'electron' };
  }
}
export {};
```

- [ ] **Paso 7: Agregar al `.gitignore`**

Sumar estas líneas al final:

```
test-results/
playwright-report/
artifacts/
```

- [ ] **Paso 8: Escribir las pruebas mínimas**

```ts
// tests/unit/sanity.test.ts
import { expect, it } from 'vitest';

it('vitest corre', () => {
  expect(1 + 1).toBe(2);
});
```

```ts
// tests/e2e/boot.spec.ts
import { expect, test } from '@playwright/test';

test('la página del juego carga con su título y su canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Enjambre gravitatorio');
  await expect(page.locator('canvas#game')).toBeVisible();
});
```

```ts
// tests/e2e/electron.spec.ts
import { _electron as electron, expect, test } from '@playwright/test';

test('la ventana de Electron abre aislada de Node', async () => {
  const app = await electron.launch({ args: ['.'] });
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('Enjambre gravitatorio');
  const isolated = await win.evaluate(
    () => typeof (window as unknown as { require?: unknown }).require === 'undefined'
      && typeof (window as unknown as { process?: unknown }).process === 'undefined',
  );
  expect(isolated).toBe(true);
  expect(await win.evaluate(() => window.platform?.kind)).toBe('electron');
  await app.close();
});
```

- [ ] **Paso 9: Correr todo**

```bash
npm run typecheck
npm test
npm run test:e2e
npm run test:electron
```

Esperado: typecheck sin errores; Vitest "1 passed"; Playwright web "1 passed"; Playwright electron "1 passed".

- [ ] **Paso 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json electron.vite.config.ts vitest.config.ts playwright.config.ts .gitignore src tests
git commit -m "Armar la base del proyecto con Electron, Vite y pruebas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 2: Simulación — azar con semilla, configuración y mundo

**Archivos:**
- Crear: `src/sim/rng.ts`, `src/sim/config.ts`, `src/sim/world.ts`
- Pruebas: `tests/unit/rng.test.ts`, `tests/unit/world.test.ts`

**Interfaces:**
- Produce:
  - `createRng(seed: number): Rng`, con `Rng = { next(): number; range(min: number, max: number): number }`.
  - `SimConfig`, `DEFAULT_CONFIG: SimConfig`, `SIM_HZ = 60`, `DT = 1 / 60`.
  - `World`, `Star`, `BodySpec`.
  - `createWorld(config: SimConfig, seed: number, extraCapacity?: number): World`.
  - `addBody(world: World, body: BodySpec): number` (devuelve −1 si no hay lugar).
  - `hashWorld(world: World): number`.
  - `captureRadiusFor(config: SimConfig, mass: number): number`.
  - Constantes `FREE = 0`, `ORBITING = 1`, `KIND_ASTEROID = 0`, `KIND_ROCKY = 1`, `KIND_ICE = 2`, `KIND_GAS = 3`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// tests/unit/rng.test.ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('createRng', () => {
  it('repite la misma secuencia con la misma semilla', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('da otra secuencia con otra semilla', () => {
    const a = createRng(1);
    const b = createRng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
    expect(same).toBeLessThan(5);
  });

  it('devuelve valores en [0, 1) y range respeta los límites', () => {
    const r = createRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v >= 0 && v < 1).toBe(true);
      const w = r.range(-3, 5);
      expect(w >= -3 && w < 5).toBe(true);
    }
  });
});
```

```ts
// tests/unit/world.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type SimConfig } from '../../src/sim/config';
import {
  addBody, captureRadiusFor, createWorld, FREE, hashWorld, KIND_ASTEROID, KIND_GAS, KIND_ROCKY,
} from '../../src/sim/world';

const cfg: SimConfig = { ...DEFAULT_CONFIG, asteroidCount: 200, planetCount: 6 };

describe('createWorld', () => {
  it('crea los cuerpos pedidos, dentro de la arena y lejos del centro', () => {
    const w = createWorld(cfg, 5);
    expect(w.count).toBe(206);
    let asteroids = 0;
    let planets = 0;
    for (let i = 0; i < w.count; i++) {
      expect(Math.abs(w.x[i])).toBeLessThanOrEqual(cfg.arenaHalfWidth);
      expect(Math.abs(w.y[i])).toBeLessThanOrEqual(cfg.arenaHalfHeight);
      expect(Math.hypot(w.x[i], w.y[i])).toBeGreaterThanOrEqual(cfg.spawnClearRadius);
      expect(w.state[i]).toBe(FREE);
      if (w.kind[i] === KIND_ASTEROID) asteroids++;
      else if (w.kind[i] >= KIND_ROCKY && w.kind[i] <= KIND_GAS) planets++;
    }
    expect(asteroids).toBe(200);
    expect(planets).toBe(6);
  });

  it('es determinista para la misma semilla y cambia con otra', () => {
    expect(hashWorld(createWorld(cfg, 5))).toBe(hashWorld(createWorld(cfg, 5)));
    expect(hashWorld(createWorld(cfg, 5))).not.toBe(hashWorld(createWorld(cfg, 6)));
  });

  it('arranca con la estrella en el centro y el radio de captura según su masa', () => {
    const w = createWorld(cfg, 1);
    expect(w.star.x).toBe(0);
    expect(w.star.y).toBe(0);
    expect(w.star.mass).toBe(cfg.starStartMass);
    expect(w.star.captureRadius).toBe(captureRadiusFor(cfg, cfg.starStartMass));
  });
});

describe('addBody', () => {
  it('devuelve -1 cuando no queda lugar', () => {
    const w = createWorld({ ...cfg, asteroidCount: 0, planetCount: 0 }, 1, 1);
    const body = { x: 0, y: 0, vx: 0, vy: 0, radius: 1, kind: KIND_ASTEROID };
    expect(addBody(w, body)).toBe(0);
    expect(addBody(w, body)).toBe(-1);
    expect(w.count).toBe(1);
  });

  it('la masa es el radio al cubo', () => {
    const w = createWorld({ ...cfg, asteroidCount: 0, planetCount: 0 }, 1, 1);
    const i = addBody(w, { x: 1, y: 2, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    expect(w.mass[i]).toBeCloseTo(0.125, 12);
    expect(w.prevX[i]).toBe(1);
    expect(w.prevY[i]).toBe(2);
  });
});
```

- [ ] **Paso 2: Correr y ver que fallen**

Correr: `npx vitest run tests/unit/rng.test.ts tests/unit/world.test.ts`
Esperado: FAIL porque no existen los módulos `../../src/sim/rng` y `../../src/sim/world`.

- [ ] **Paso 3: Implementar**

```ts
// src/sim/rng.ts
export interface Rng {
  next(): number;
  range(min: number, max: number): number;
}

// mulberry32: rápido, determinista y suficiente para un juego.
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (min, max) => min + (max - min) * next() };
}
```

```ts
// src/sim/config.ts
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
```

```ts
// src/sim/world.ts
import type { SimConfig } from './config';
import { createRng } from './rng';

export const FREE = 0;
export const ORBITING = 1;
export const KIND_ASTEROID = 0;
export const KIND_ROCKY = 1;
export const KIND_ICE = 2;
export const KIND_GAS = 3;

export interface Star {
  x: number; y: number; prevX: number; prevY: number;
  mass: number; captureRadius: number;
}

export interface World {
  readonly config: SimConfig;
  readonly capacity: number;
  tick: number;
  count: number;
  readonly star: Star;
  readonly x: Float64Array; readonly y: Float64Array;
  readonly prevX: Float64Array; readonly prevY: Float64Array;
  readonly vx: Float64Array; readonly vy: Float64Array;
  readonly radius: Float64Array; readonly mass: Float64Array;
  readonly orbitR: Float64Array; readonly orbitTarget: Float64Array; readonly orbitAngle: Float64Array;
  readonly state: Uint8Array; readonly kind: Uint8Array;
  orbitingCount: number;
  readonly captured: Int32Array;   // índices capturados en el último paso
  capturedCount: number;
}

export interface BodySpec { x: number; y: number; vx: number; vy: number; radius: number; kind: number }

export function captureRadiusFor(config: SimConfig, mass: number): number {
  return config.starBaseCaptureRadius + config.captureRadiusPerSqrtMass * Math.sqrt(mass);
}

export function addBody(w: World, b: BodySpec): number {
  if (w.count >= w.capacity) return -1;
  const i = w.count++;
  w.x[i] = b.x; w.y[i] = b.y; w.prevX[i] = b.x; w.prevY[i] = b.y;
  w.vx[i] = b.vx; w.vy[i] = b.vy;
  w.radius[i] = b.radius; w.mass[i] = b.radius * b.radius * b.radius;
  w.orbitR[i] = 0; w.orbitTarget[i] = 0; w.orbitAngle[i] = 0;
  w.state[i] = FREE; w.kind[i] = b.kind;
  return i;
}

export function createWorld(config: SimConfig, seed: number, extraCapacity = 0): World {
  const capacity = config.asteroidCount + config.planetCount + extraCapacity;
  const f = (): Float64Array => new Float64Array(capacity);
  const w: World = {
    config, capacity, tick: 0, count: 0,
    star: {
      x: 0, y: 0, prevX: 0, prevY: 0,
      mass: config.starStartMass, captureRadius: captureRadiusFor(config, config.starStartMass),
    },
    x: f(), y: f(), prevX: f(), prevY: f(), vx: f(), vy: f(), radius: f(), mass: f(),
    orbitR: f(), orbitTarget: f(), orbitAngle: f(),
    state: new Uint8Array(capacity), kind: new Uint8Array(capacity),
    orbitingCount: 0, captured: new Int32Array(capacity), capturedCount: 0,
  };
  const rng = createRng(seed);
  const spawn = (kind: number, rMin: number, rMax: number, sMin: number, sMax: number): void => {
    let px = 0;
    let py = 0;
    do {
      px = rng.range(-config.arenaHalfWidth, config.arenaHalfWidth);
      py = rng.range(-config.arenaHalfHeight, config.arenaHalfHeight);
    } while (Math.hypot(px, py) < config.spawnClearRadius);
    const ang = rng.range(0, Math.PI * 2);
    const speed = rng.range(sMin, sMax);
    addBody(w, { x: px, y: py, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, radius: rng.range(rMin, rMax), kind });
  };
  for (let i = 0; i < config.asteroidCount; i++) spawn(KIND_ASTEROID, 0.35, 1.1, 1, 4);
  for (let i = 0; i < config.planetCount; i++) spawn(KIND_ROCKY + Math.floor(rng.next() * 3), 2.5, 7, 0.3, 1);
  return w;
}

// Huella FNV-1a del estado. Sirve sólo para pruebas y depuración (crea objetos).
export function hashWorld(w: World): number {
  let h = 0x811c9dc5;
  const buf = new Float64Array(1);
  const bytes = new Uint8Array(buf.buffer);
  const mix = (v: number): void => {
    buf[0] = v;
    for (let k = 0; k < 8; k++) { h ^= bytes[k]; h = Math.imul(h, 0x01000193) >>> 0; }
  };
  mix(w.star.x); mix(w.star.y); mix(w.star.mass);
  for (let i = 0; i < w.count; i++) { mix(w.x[i]); mix(w.y[i]); mix(w.state[i]); }
  return h >>> 0;
}
```

- [ ] **Paso 4: Correr y ver que pasen**

Correr: `npx vitest run tests/unit/rng.test.ts tests/unit/world.test.ts`
Esperado: PASS, con 8 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/sim tests/unit/rng.test.ts tests/unit/world.test.ts
git commit -m "Agregar el mundo de la simulación con azar determinista

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 3: Simulación — un paso (estrella, deriva, captura y órbita)

**Archivos:**
- Crear: `src/sim/step.ts`
- Pruebas: `tests/unit/step.test.ts`

**Interfaces:**
- Consume: `World`, `addBody`, `captureRadiusFor`, `createWorld`, `hashWorld`, `FREE`, `ORBITING` y `KIND_ASTEROID` (de `src/sim/world.ts`); `DT` y `SimConfig` (de `src/sim/config.ts`).
- Produce: `Intent = { targetX: number; targetY: number; hasTarget: boolean }` y `step(world: World, intent: Intent): void`.

Reglas de `step`, en orden:
1. Copiar las posiciones actuales a `prev*` (estrella y cuerpos).
2. Mover la estrella hacia el objetivo, limitado a la arena, sin pasar `starMaxSpeed * DT`. Se ignora un objetivo con NaN o infinito, o con `hasTarget = false`.
3. **Cuerpo libre:** avanza con su velocidad y, si sale por un borde, aparece del otro lado. Se captura si está dentro de `star.captureRadius`, si `radius ≤ maxCaptureSize` y si `orbitingCount < orbitCapacity`. Al capturarse:
   - pasa a `ORBITING`;
   - `orbitR` es su distancia actual;
   - `orbitTarget = clamp(d * 0.9, orbitMin, orbitMax)`;
   - `orbitAngle = atan2`;
   - suma su masa a la estrella y se anota en `captured`.
4. **Cuerpo en órbita:** `orbitR` se acerca a `orbitTarget` con `orbitEase`. El ángulo avanza `orbitSpeedK * (orbitMin / orbitR)^1.5 * DT` y la posición queda exacta sobre el círculo alrededor de la estrella.
5. Recalcular `star.captureRadius` con la masa nueva y sumar 1 a `tick`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// tests/unit/step.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, DT, type SimConfig } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import {
  addBody, captureRadiusFor, createWorld, FREE, hashWorld, KIND_ASTEROID, ORBITING,
} from '../../src/sim/world';

const NO_INPUT: Intent = { targetX: 0, targetY: 0, hasTarget: false };

function emptyWorld(extra = 10, overrides: Partial<SimConfig> = {}) {
  return createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, ...overrides }, 1, extra);
}

function rock(x: number, y: number, radius = 0.5, vx = 0, vy = 0) {
  return { x, y, vx, vy, radius, kind: KIND_ASTEROID };
}

describe('estrella', () => {
  it('avanza hacia el objetivo sin pasar la velocidad máxima', () => {
    const w = emptyWorld();
    step(w, { targetX: 100, targetY: 0, hasTarget: true });
    expect(w.star.x).toBeCloseTo(DEFAULT_CONFIG.starMaxSpeed * DT, 10);
    expect(w.star.y).toBe(0);
  });

  it('llega exacto cuando el objetivo está cerca', () => {
    const w = emptyWorld();
    step(w, { targetX: 0.1, targetY: 0.2, hasTarget: true });
    expect(w.star.x).toBe(0.1);
    expect(w.star.y).toBe(0.2);
  });

  it('ignora objetivos inválidos y no produce NaN', () => {
    const w = emptyWorld();
    step(w, { targetX: Number.NaN, targetY: 5, hasTarget: true });
    step(w, { targetX: Number.POSITIVE_INFINITY, targetY: 5, hasTarget: true });
    expect(w.star.x).toBe(0);
    expect(w.star.y).toBe(0);
  });

  it('sin objetivo queda quieta', () => {
    const w = emptyWorld();
    for (let i = 0; i < 10; i++) step(w, NO_INPUT);
    expect(w.star.x).toBe(0);
    expect(w.star.y).toBe(0);
  });

  it('el objetivo se limita a la arena', () => {
    const w = emptyWorld();
    for (let i = 0; i < 2000; i++) step(w, { targetX: 1e6, targetY: -1e6, hasTarget: true });
    expect(w.star.x).toBe(DEFAULT_CONFIG.arenaHalfWidth);
    expect(w.star.y).toBe(-DEFAULT_CONFIG.arenaHalfHeight);
  });

  it('guarda la posición anterior para interpolar', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(50, 80, 0.5, 60, 0));
    step(w, { targetX: 100, targetY: 0, hasTarget: true });
    expect(w.star.prevX).toBe(0);
    expect(w.prevX[i]).toBe(50);
    expect(w.x[i]).toBeCloseTo(51, 10);
  });
});

describe('cuerpos libres', () => {
  it('se mueven y reaparecen del otro lado al cruzar el borde', () => {
    const w = emptyWorld();
    const hw = DEFAULT_CONFIG.arenaHalfWidth;
    const i = addBody(w, rock(hw - 0.01, 80, 0.5, 60, 0));
    step(w, NO_INPUT);
    expect(w.x[i]).toBeCloseTo(-hw + 0.99, 10);
    expect(w.state[i]).toBe(FREE);
  });
});

describe('captura', () => {
  it('captura un asteroide chico dentro del radio', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(3, 0, 0.5));
    step(w, NO_INPUT);
    expect(w.state[i]).toBe(ORBITING);
    expect(w.orbitingCount).toBe(1);
    expect(w.capturedCount).toBe(1);
    expect(w.captured[0]).toBe(i);
    expect(w.star.mass).toBeCloseTo(DEFAULT_CONFIG.starStartMass + 0.125, 12);
    expect(w.star.captureRadius).toBeCloseTo(captureRadiusFor(w.config, w.star.mass), 12);
  });

  it('no captura cuerpos más grandes que el límite', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(3, 0, 3));
    step(w, NO_INPUT);
    expect(w.state[i]).toBe(FREE);
    expect(w.orbitingCount).toBe(0);
  });

  it('con la órbita llena, el resto queda libre', () => {
    const w = emptyWorld(10, { orbitCapacity: 2 });
    addBody(w, rock(2, 0));
    addBody(w, rock(0, 2));
    addBody(w, rock(-2, 0));
    step(w, NO_INPUT);
    expect(w.orbitingCount).toBe(2);
    let free = 0;
    for (let k = 0; k < w.count; k++) if (w.state[k] === FREE) free++;
    expect(free).toBe(1);
  });

  it('el capturado termina orbitando a su radio de órbita y gira', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(3, 0, 0.5));
    step(w, NO_INPUT);
    const startAngle = w.orbitAngle[i];
    for (let k = 0; k < 600; k++) step(w, NO_INPUT);
    expect(Math.hypot(w.x[i] - w.star.x, w.y[i] - w.star.y)).toBeCloseTo(DEFAULT_CONFIG.orbitMin, 6);
    expect(w.orbitAngle[i]).toBeGreaterThan(startAngle + 1);
  });

  it('el capturado acompaña a la estrella cuando se mueve', () => {
    const w = emptyWorld();
    const i = addBody(w, rock(3, 0, 0.5));
    for (let k = 0; k < 600; k++) step(w, NO_INPUT);
    for (let k = 0; k < 120; k++) step(w, { targetX: 60, targetY: 30, hasTarget: true });
    expect(Math.hypot(w.x[i] - w.star.x, w.y[i] - w.star.y)).toBeCloseTo(DEFAULT_CONFIG.orbitMin, 6);
  });
});

describe('determinismo', () => {
  it('misma semilla y mismas órdenes dan la misma partida', () => {
    const run = (): { hash: number; orbiting: number } => {
      const w = createWorld(DEFAULT_CONFIG, 99);
      const intent: Intent = { targetX: 0, targetY: 0, hasTarget: true };
      for (let k = 0; k < 1200; k++) {
        intent.targetX = 100 * Math.sin(k * 0.01);
        intent.targetY = 50 * Math.cos(k * 0.013);
        step(w, intent);
      }
      return { hash: hashWorld(w), orbiting: w.orbitingCount };
    };
    const a = run();
    const b = run();
    expect(a.hash).toBe(b.hash);
    expect(a.orbiting).toBeGreaterThan(0);
  });
});
```

- [ ] **Paso 2: Correr y ver que fallen**

Correr: `npx vitest run tests/unit/step.test.ts`
Esperado: FAIL porque no existe el módulo `../../src/sim/step`.

- [ ] **Paso 3: Implementar**

```ts
// src/sim/step.ts
import { DT } from './config';
import { captureRadiusFor, FREE, ORBITING, type World } from './world';

export interface Intent { targetX: number; targetY: number; hasTarget: boolean }

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function step(w: World, intent: Intent): void {
  const c = w.config;
  const s = w.star;
  const hw = c.arenaHalfWidth;
  const hh = c.arenaHalfHeight;
  w.capturedCount = 0;

  s.prevX = s.x;
  s.prevY = s.y;
  w.prevX.set(w.x);
  w.prevY.set(w.y);

  if (intent.hasTarget && Number.isFinite(intent.targetX) && Number.isFinite(intent.targetY)) {
    const tx = clamp(intent.targetX, -hw, hw);
    const ty = clamp(intent.targetY, -hh, hh);
    const dx = tx - s.x;
    const dy = ty - s.y;
    const dist = Math.hypot(dx, dy);
    const maxStep = c.starMaxSpeed * DT;
    if (dist <= maxStep) { s.x = tx; s.y = ty; }
    else { s.x += (dx / dist) * maxStep; s.y += (dy / dist) * maxStep; }
  }

  const captureR = s.captureRadius;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] === FREE) {
      let x = w.x[i] + w.vx[i] * DT;
      let y = w.y[i] + w.vy[i] * DT;
      if (x > hw) x -= 2 * hw; else if (x < -hw) x += 2 * hw;
      if (y > hh) y -= 2 * hh; else if (y < -hh) y += 2 * hh;
      w.x[i] = x;
      w.y[i] = y;
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < captureR && w.radius[i] <= c.maxCaptureSize && w.orbitingCount < c.orbitCapacity) {
        w.state[i] = ORBITING;
        w.orbitR[i] = d;
        w.orbitTarget[i] = clamp(d * 0.9, c.orbitMin, c.orbitMax);
        w.orbitAngle[i] = Math.atan2(y - s.y, x - s.x);
        w.orbitingCount++;
        s.mass += w.mass[i];
        w.captured[w.capturedCount++] = i;
      }
    } else {
      const r = w.orbitR[i] + (w.orbitTarget[i] - w.orbitR[i]) * c.orbitEase;
      w.orbitR[i] = r;
      const a = w.orbitAngle[i] + c.orbitSpeedK * Math.pow(c.orbitMin / Math.max(r, 1e-6), 1.5) * DT;
      w.orbitAngle[i] = a;
      w.x[i] = s.x + Math.cos(a) * r;
      w.y[i] = s.y + Math.sin(a) * r;
    }
  }

  s.captureRadius = captureRadiusFor(c, s.mass);
  w.tick++;
}
```

Nota: un cuerpo capturado en un paso empieza a orbitar recién en el paso siguiente, porque en el paso de la captura ya fue procesado como libre. Es intencional: así no salta de lugar.

- [ ] **Paso 4: Correr y ver que pasen**

Correr: `npx vitest run tests/unit/step.test.ts`
Esperado: PASS, con 13 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/sim/step.ts tests/unit/step.test.ts
git commit -m "Agregar el paso de la simulación: movimiento, captura y órbita

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 4: Ritmo fijo, medición de cuadros y calidad automática

**Archivos:**
- Crear: `src/sim/loop.ts`, `src/perf/frameTimes.ts`, `src/perf/qualityGovernor.ts`, `src/render/quality.ts`
- Pruebas: `tests/unit/loop.test.ts`, `tests/unit/perf.test.ts`

**Interfaces:**
- Consume: `DT` (de `src/sim/config.ts`).
- Produce:
  - `FixedStepper`, con `advance(elapsedSeconds: number): number` y el getter `alpha: number`.
  - `FrameTimeRecorder(capacity)`, con `push(ms)`, `count`, `average()`, `percentile(p)` y `reset()`.
  - `QualityLevel = 'low' | 'medium' | 'high'`, `QualitySettings`, `QUALITY: Record<QualityLevel, QualitySettings>` y `lowerQuality(level): QualityLevel | null`.
  - `QualityGovernor(level, opts?)`, con `sample(frameMs): QualityLevel | null` y `current`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// tests/unit/loop.test.ts
import { describe, expect, it } from 'vitest';
import { DT } from '../../src/sim/config';
import { FixedStepper } from '../../src/sim/loop';

describe('FixedStepper', () => {
  it('da un paso por cada 1/60 s', () => {
    const s = new FixedStepper();
    expect(s.advance(DT)).toBe(1);
    expect(s.advance(DT * 2)).toBe(2);
  });

  it('acumula tiempos chicos', () => {
    const s = new FixedStepper();
    expect(s.advance(0.005)).toBe(0);
    expect(s.advance(0.005)).toBe(0);
    expect(s.advance(0.005)).toBe(0);
    expect(s.advance(0.005)).toBe(1);
  });

  it('alpha queda entre 0 y 1', () => {
    const s = new FixedStepper();
    s.advance(DT * 1.5);
    expect(s.alpha).toBeGreaterThan(0.45);
    expect(s.alpha).toBeLessThan(0.55);
  });

  it('después de un pico enorme da como máximo 5 pasos y no arrastra atraso', () => {
    const s = new FixedStepper();
    expect(s.advance(10)).toBe(5);
    expect(s.advance(DT)).toBe(1);
  });

  it('ignora tiempos inválidos', () => {
    const s = new FixedStepper();
    expect(s.advance(Number.NaN)).toBe(0);
    expect(s.advance(-1)).toBe(0);
    expect(s.advance(0)).toBe(0);
  });
});
```

```ts
// tests/unit/perf.test.ts
import { describe, expect, it } from 'vitest';
import { FrameTimeRecorder } from '../../src/perf/frameTimes';
import { QualityGovernor } from '../../src/perf/qualityGovernor';
import { lowerQuality } from '../../src/render/quality';

describe('FrameTimeRecorder', () => {
  it('calcula promedio y percentiles', () => {
    const r = new FrameTimeRecorder(200);
    for (let i = 1; i <= 100; i++) r.push(i);
    expect(r.average()).toBeCloseTo(50.5, 10);
    expect(r.percentile(99)).toBe(99);
    expect(r.percentile(50)).toBe(50);
  });

  it('ignora valores inválidos', () => {
    const r = new FrameTimeRecorder(10);
    r.push(Number.NaN); r.push(-3); r.push(10);
    expect(r.count).toBe(1);
    expect(r.average()).toBe(10);
  });

  it('pisa lo más viejo cuando se llena', () => {
    const r = new FrameTimeRecorder(3);
    r.push(1); r.push(2); r.push(3); r.push(4);
    expect(r.count).toBe(3);
    expect(r.average()).toBeCloseTo(3, 10);
  });

  it('vacío devuelve 0', () => {
    const r = new FrameTimeRecorder(3);
    expect(r.average()).toBe(0);
    expect(r.percentile(99)).toBe(0);
  });
});

describe('QualityGovernor', () => {
  const opts = { budgetMs: 18, windowFrames: 180, cooldownFrames: 300 };

  it('baja un nivel cuando el p95 supera el presupuesto, una sola vez por ventana', () => {
    const g = new QualityGovernor('high', opts);
    const changes: (string | null)[] = [];
    for (let i = 0; i < 300; i++) { const c = g.sample(30); if (c) changes.push(c); }
    expect(changes).toEqual(['medium']);
    expect(g.current).toBe('medium');
  });

  it('no cambia si los cuadros entran en el presupuesto', () => {
    const g = new QualityGovernor('high', opts);
    for (let i = 0; i < 2000; i++) expect(g.sample(16)).toBeNull();
  });

  it('en baja no puede bajar más', () => {
    const g = new QualityGovernor('low', opts);
    for (let i = 0; i < 2000; i++) expect(g.sample(40)).toBeNull();
    expect(lowerQuality('low')).toBeNull();
  });
});
```

- [ ] **Paso 2: Correr y ver que fallen**

Correr: `npx vitest run tests/unit/loop.test.ts tests/unit/perf.test.ts`
Esperado: FAIL porque faltan los módulos.

- [ ] **Paso 3: Implementar**

```ts
// src/sim/loop.ts
import { DT } from './config';

export class FixedStepper {
  private acc = 0;

  constructor(private readonly dt = DT, private readonly maxSteps = 5) {}

  advance(elapsedSeconds: number): number {
    if (!(elapsedSeconds > 0)) return 0;
    this.acc += Math.min(elapsedSeconds, this.dt * this.maxSteps);
    let n = 0;
    while (this.acc + 1e-9 >= this.dt && n < this.maxSteps) { this.acc -= this.dt; n++; }
    if (this.acc < 0) this.acc = 0;
    return n;
  }

  get alpha(): number {
    return Math.min(1, this.acc / this.dt);
  }
}
```

```ts
// src/perf/frameTimes.ts
export class FrameTimeRecorder {
  private readonly buf: Float32Array;
  private readonly sorted: Float32Array;
  private n = 0;
  private i = 0;

  constructor(capacity = 600) {
    this.buf = new Float32Array(capacity);
    this.sorted = new Float32Array(capacity);
  }

  push(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.buf[this.i] = ms;
    this.i = (this.i + 1) % this.buf.length;
    if (this.n < this.buf.length) this.n++;
  }

  get count(): number { return this.n; }

  average(): number {
    if (this.n === 0) return 0;
    let s = 0;
    for (let k = 0; k < this.n; k++) s += this.buf[k];
    return s / this.n;
  }

  // Se llama pocas veces (no en cada cuadro): ordena una copia.
  percentile(p: number): number {
    if (this.n === 0) return 0;
    const view = this.sorted.subarray(0, this.n);
    view.set(this.buf.subarray(0, this.n));
    view.sort();
    const idx = Math.min(this.n - 1, Math.max(0, Math.ceil((p / 100) * this.n) - 1));
    return view[idx];
  }

  reset(): void { this.n = 0; this.i = 0; }
}
```

```ts
// src/render/quality.ts
export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualitySettings {
  level: QualityLevel;
  dprCap: number;
  nebulaScale: number;     // resolución de la nebulosa respecto de la pantalla
  nebulaOctaves: number;
  starCount: number;
  planetSegments: number;
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  low: { level: 'low', dprCap: 1, nebulaScale: 0.25, nebulaOctaves: 3, starCount: 1500, planetSegments: 24 },
  medium: { level: 'medium', dprCap: 1.5, nebulaScale: 0.35, nebulaOctaves: 4, starCount: 3000, planetSegments: 40 },
  high: { level: 'high', dprCap: 2, nebulaScale: 0.5, nebulaOctaves: 5, starCount: 5000, planetSegments: 64 },
};

export function lowerQuality(level: QualityLevel): QualityLevel | null {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return null;
}
```

```ts
// src/perf/qualityGovernor.ts
import { lowerQuality, type QualityLevel } from '../render/quality';
import { FrameTimeRecorder } from './frameTimes';

export interface GovernorOptions { budgetMs: number; windowFrames: number; cooldownFrames: number }

export class QualityGovernor {
  private readonly rec: FrameTimeRecorder;
  private sinceChange = 0;

  constructor(
    private level: QualityLevel,
    private readonly opts: GovernorOptions = { budgetMs: 18, windowFrames: 180, cooldownFrames: 300 },
  ) {
    this.rec = new FrameTimeRecorder(opts.windowFrames);
  }

  get current(): QualityLevel { return this.level; }

  // Devuelve el nivel nuevo sólo en el cuadro en que cambia.
  sample(frameMs: number): QualityLevel | null {
    this.rec.push(frameMs);
    this.sinceChange++;
    if (this.rec.count < this.opts.windowFrames || this.sinceChange < this.opts.cooldownFrames) return null;
    if (this.rec.percentile(95) <= this.opts.budgetMs) return null;
    const next = lowerQuality(this.level);
    if (!next) return null;
    this.level = next;
    this.rec.reset();
    this.sinceChange = 0;
    return next;
  }
}
```

Nota: `percentile` se llama en cada cuadro una vez cumplida la espera inicial, y ordena 180 números (unos microsegundos). Es la única excepción aceptada a la regla de no crear objetos: `subarray` crea una vista chica. Si el profiler la marca, se agrega una espera más larga entre llamadas.

- [ ] **Paso 4: Correr y ver que pasen**

Correr: `npx vitest run tests/unit/loop.test.ts tests/unit/perf.test.ts`
Esperado: PASS, con 12 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/sim/loop.ts src/perf src/render/quality.ts tests/unit/loop.test.ts tests/unit/perf.test.ts
git commit -m "Agregar paso fijo, medición de cuadros y calidad automática

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 5: Controles y cámara

**Archivos:**
- Crear: `src/input/gamepad.ts`, `src/input/controller.ts`, `src/render/camera.ts`
- Pruebas: `tests/unit/input.test.ts`, `tests/unit/camera.test.ts`

**Interfaces:**
- Consume: `Intent` (de `src/sim/step.ts`).
- Produce:
  - `applyDeadzone(x, y, deadzone, out: { x: number; y: number }): { x: number; y: number }`.
  - `InputController(el: HTMLElement, toWorld: (sx: number, sy: number, out: { x: number; y: number }) => void, reach?: number)`, con `poll(starX: number, starY: number): Intent`.
  - `ViewRect = { halfWidth: number; halfHeight: number }`.
  - `fitView(arenaHalfWidth, arenaHalfHeight, aspect): ViewRect`.
  - `screenToWorld(sx, sy, cssWidth, cssHeight, view: ViewRect, out): { x: number; y: number }`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// tests/unit/camera.test.ts
import { describe, expect, it } from 'vitest';
import { fitView, screenToWorld } from '../../src/render/camera';

describe('fitView', () => {
  it('en 16:9 muestra la arena exacta', () => {
    expect(fitView(160, 90, 16 / 9)).toEqual({ halfWidth: 160, halfHeight: 90 });
  });
  it('en pantallas más anchas muestra más a los costados', () => {
    const v = fitView(160, 90, 21 / 9);
    expect(v.halfHeight).toBe(90);
    expect(v.halfWidth).toBeCloseTo(210, 10);
  });
  it('en pantallas más angostas muestra más arriba y abajo', () => {
    const v = fitView(160, 90, 4 / 3);
    expect(v.halfWidth).toBeCloseTo(160, 10);
    expect(v.halfHeight).toBeCloseTo(120, 10);
  });
});

describe('screenToWorld', () => {
  const view = { halfWidth: 160, halfHeight: 90 };
  const out = { x: 0, y: 0 };
  it('el centro de la pantalla es el origen', () => {
    expect(screenToWorld(640, 360, 1280, 720, view, out)).toEqual({ x: 0, y: 0 });
  });
  it('arriba a la izquierda es (-ancho, +alto)', () => {
    expect(screenToWorld(0, 0, 1280, 720, view, out)).toEqual({ x: -160, y: 90 });
  });
  it('abajo a la derecha es (+ancho, -alto)', () => {
    expect(screenToWorld(1280, 720, 1280, 720, view, out)).toEqual({ x: 160, y: -90 });
  });
});
```

```ts
// tests/unit/input.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputController } from '../../src/input/controller';
import { applyDeadzone } from '../../src/input/gamepad';

describe('applyDeadzone', () => {
  const out = { x: 0, y: 0 };
  it('dentro de la zona muerta da cero', () => {
    expect(applyDeadzone(0.1, 0.1, 0.2, out)).toEqual({ x: 0, y: 0 });
  });
  it('a fondo da 1', () => {
    expect(applyDeadzone(1, 0, 0.2, out)).toEqual({ x: 1, y: 0 });
  });
  it('reescala entre la zona muerta y el máximo', () => {
    const r = applyDeadzone(0.6, 0, 0.2, out);
    expect(r.x).toBeCloseTo(0.5, 10);
    expect(r.y).toBe(0);
  });
  it('valores inválidos dan cero', () => {
    expect(applyDeadzone(Number.NaN, 0.5, 0.2, out)).toEqual({ x: 0, y: 0 });
  });
});

function fakeElement() {
  const listeners: Record<string, (e: { clientX: number; clientY: number }) => void> = {};
  const el = {
    addEventListener: (type: string, fn: (e: { clientX: number; clientY: number }) => void) => { listeners[type] = fn; },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  return { el: el as unknown as HTMLElement, listeners };
}

const toWorld = (sx: number, sy: number, out: { x: number; y: number }): void => { out.x = sx / 10; out.y = -sy / 10; };

describe('InputController', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin entrada no hay objetivo', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el } = fakeElement();
    expect(new InputController(el, toWorld).poll(0, 0).hasTarget).toBe(false);
  });

  it('el mouse define el objetivo en coordenadas del mundo y lo mantiene si sale de la ventana', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    const input = new InputController(el, toWorld);
    listeners['pointermove']!({ clientX: 100, clientY: 50 });
    const a = input.poll(0, 0);
    expect(a).toMatchObject({ targetX: 10, targetY: -5, hasTarget: true });
    const b = input.poll(0, 0);
    expect(b).toMatchObject({ targetX: 10, targetY: -5, hasTarget: true });
  });

  it('el joystick mueve el objetivo desde la estrella y al soltarlo la estrella frena', () => {
    const pad = { axes: [1, 0] };
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    const { el } = fakeElement();
    const input = new InputController(el, toWorld, 40);
    expect(input.poll(10, 5)).toMatchObject({ targetX: 50, targetY: 5, hasTarget: true });
    pad.axes = [0, 0];
    expect(input.poll(12, 6)).toMatchObject({ targetX: 12, targetY: 6, hasTarget: true });
  });

  it('ejes NaN del joystick no producen NaN', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [{ axes: [Number.NaN, Number.NaN] }] });
    const { el } = fakeElement();
    const r = new InputController(el, toWorld).poll(3, 4);
    expect(Number.isFinite(r.targetX) && Number.isFinite(r.targetY)).toBe(true);
  });
});
```

- [ ] **Paso 2: Correr y ver que fallen**

Correr: `npx vitest run tests/unit/input.test.ts tests/unit/camera.test.ts`
Esperado: FAIL porque faltan los módulos.

- [ ] **Paso 3: Implementar**

```ts
// src/render/camera.ts
export interface ViewRect { halfWidth: number; halfHeight: number }

// Siempre se ve la arena entera; si sobra pantalla, se muestra más espacio alrededor.
export function fitView(arenaHalfWidth: number, arenaHalfHeight: number, aspect: number): ViewRect {
  const halfHeight = Math.max(arenaHalfHeight, arenaHalfWidth / aspect);
  return { halfWidth: halfHeight * aspect, halfHeight };
}

export function screenToWorld(
  sx: number, sy: number, cssWidth: number, cssHeight: number, view: ViewRect, out: { x: number; y: number },
): { x: number; y: number } {
  out.x = ((sx / cssWidth) * 2 - 1) * view.halfWidth;
  out.y = -((sy / cssHeight) * 2 - 1) * view.halfHeight;
  return out;
}
```

```ts
// src/input/gamepad.ts
export function applyDeadzone(
  x: number, y: number, deadzone: number, out: { x: number; y: number },
): { x: number; y: number } {
  const m = Math.hypot(x, y);
  if (!Number.isFinite(m) || m < deadzone) { out.x = 0; out.y = 0; return out; }
  const scale = (Math.min(m, 1) - deadzone) / (1 - deadzone) / m;
  out.x = x * scale;
  out.y = y * scale;
  return out;
}
```

```ts
// src/input/controller.ts
import type { Intent } from '../sim/step';
import { applyDeadzone } from './gamepad';

type ToWorld = (sx: number, sy: number, out: { x: number; y: number }) => void;

export class InputController {
  private readonly intent: Intent = { targetX: 0, targetY: 0, hasTarget: false };
  private readonly world = { x: 0, y: 0 };
  private readonly stick = { x: 0, y: 0 };
  private pointerX = 0;
  private pointerY = 0;
  private hasPointer = false;
  private usingGamepad = false;

  constructor(el: HTMLElement, private readonly toWorld: ToWorld, private readonly reach = 40) {
    el.addEventListener('pointermove', (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointerX = e.clientX - r.left;
      this.pointerY = e.clientY - r.top;
      this.hasPointer = true;
      this.usingGamepad = false;
    });
  }

  poll(starX: number, starY: number): Intent {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (let k = 0; k < pads.length; k++) {
      const p = pads[k];
      if (!p) continue;
      applyDeadzone(p.axes[0] ?? 0, p.axes[1] ?? 0, 0.2, this.stick);
      if (this.stick.x !== 0 || this.stick.y !== 0) {
        this.usingGamepad = true;
        this.intent.targetX = starX + this.stick.x * this.reach;
        this.intent.targetY = starY - this.stick.y * this.reach;   // en el joystick, Y positivo es abajo
        this.intent.hasTarget = true;
        return this.intent;
      }
      if (this.usingGamepad) {
        this.intent.targetX = starX;
        this.intent.targetY = starY;
        this.intent.hasTarget = true;
        return this.intent;
      }
    }
    if (this.hasPointer) {
      this.toWorld(this.pointerX, this.pointerY, this.world);
      this.intent.targetX = this.world.x;
      this.intent.targetY = this.world.y;
      this.intent.hasTarget = true;
    }
    return this.intent;
  }
}
```

- [ ] **Paso 4: Correr y ver que pasen**

Correr: `npx vitest run tests/unit/input.test.ts tests/unit/camera.test.ts`
Esperado: PASS, con 14 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add src/input src/render/camera.ts tests/unit/input.test.ts tests/unit/camera.test.ts
git commit -m "Agregar controles de mouse y joystick, y la cámara de la arena

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 6: Render base — pipeline, nebulosa, estrellas de fondo y el juego andando

**Archivos:**
- Crear: `src/render/context.ts`, `src/render/params.ts`, `src/render/layer.ts`, `src/render/pipeline.ts`, `src/render/blackhole/lensPass.ts`, `src/render/spaceView.ts`, `src/render/layers.ts`, `src/render/shaders/noise.ts`, `src/render/shaders/common.ts`, `src/render/background/nebula.ts`, `src/render/background/starfield.ts`
- Modificar: `src/renderer/game.ts` (se reemplaza entero) y `src/renderer/globals.d.ts`
- Pruebas: `tests/e2e/game.spec.ts`, `tests/e2e/nowebgl.spec.ts`

**Interfaces:**
- Consume: `World`, `createWorld`, `step`, `DEFAULT_CONFIG`, `FixedStepper`, `QualityGovernor`, `QUALITY`, `QualityLevel`, `QualitySettings`, `fitView`, `screenToWorld`, `ViewRect`, `InputController`, `createRng` y `Rng`.
- Produce:
  - `createSpaceView(canvas: HTMLCanvasElement, opts: SpaceViewOptions): SpaceView | ViewFailure`.
  - `SpaceView`, con `ok: true`, `params`, `diagnostics`, `renderer`, `update(world, alpha, time)`, `render()`, `applyParams()`, `setQuality(level)` y `screenToWorld(sx, sy, out)`.
  - `Diagnostics`, `ViewParams` y `DEFAULT_PARAMS`.
  - `Layer` y `FrameContext`.
  - `Pipeline`, con `renderer`, `composer`, `bloom`, `vignette`, `lens` y `setSize`.
  - `LensPass`, con `lensUniforms` (`uCenter`, `uAspect`, `uEinsteinR`, `uEnabled`).
  - `NOISE_GLSL`, `FULLSCREEN_VERT`, `PLANE_VERT`, `BODY_VERT` y `LOCAL_VERT`.
  - `buildLayers(deps: LayerDeps): Layer[]`, con `LayerDeps = { world, quality, rng, pipeline }`.
  - `window.__GAME__ = { diagnostics, world }`.

- [ ] **Paso 1: Escribir las pruebas e2e que fallan**

```ts
// tests/e2e/game.spec.ts
import { expect, type Page, test } from '@playwright/test';

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 60, undefined, { timeout: 45_000 });
  return errors;
}

test('arranca sin errores y dibuja la escena', async ({ page }) => {
  const errors = await boot(page);
  const d = await page.evaluate(() => window.__GAME__!.diagnostics);
  expect(d.calls).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/e2e/juego.png' });
});

test('se adapta al cambiar el tamaño de la ventana', async ({ page }) => {
  await boot(page);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForFunction(() => {
    const d = window.__GAME__!.diagnostics;
    const dpr = Math.min(window.devicePixelRatio, 2);
    return d.canvasWidth === Math.floor(800 * dpr) && d.canvasHeight === Math.floor(600 * dpr);
  }, undefined, { timeout: 10_000 });
});
```

```ts
// tests/e2e/nowebgl.spec.ts
import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-3d-apis'] } });

test('sin WebGL2 muestra un aviso en español', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.fatal')).toContainText('WebGL2');
});
```

- [ ] **Paso 2: Correr y ver que fallen**

Correr: `npx playwright test --project=web tests/e2e/game.spec.ts tests/e2e/nowebgl.spec.ts`
Esperado: FAIL. `window.__GAME__` no existe (se vence el tiempo) y `.fatal` no aparece.

- [ ] **Paso 3: Crear los shaders compartidos**

```ts
// src/render/shaders/noise.ts
// Ruido simplex 3D: Ian McEwan y Ashima Arts (MIT), https://github.com/ashima/webgl-noise
// Se define OCTAVES antes de incluirlo (por defecto, 5).
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
#ifndef OCTAVES
#define OCTAVES 5
#endif
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < OCTAVES; i++) {
    s += a * snoise(p);
    p = p * 2.02 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`;
```

```ts
// src/render/shaders/common.ts
// Cuadro de pantalla completa (escena propia con cámara de -1..1).
export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Plano en el mundo.
export const PLANE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Posición local (anillos del agujero negro).
export const LOCAL_VERT = /* glsl */ `
varying vec3 vLocal;
void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Esferas (estrella y planetas), con soporte de instancing; instanceColor.r se usa como semilla.
export const BODY_VERT = /* glsl */ `
varying vec3 vObjNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vSeed;
void main() {
  #ifdef USE_INSTANCING
    mat4 m = modelMatrix * instanceMatrix;
  #else
    mat4 m = modelMatrix;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vSeed = instanceColor.r;
  #else
    vSeed = 0.0;
  #endif
  vec4 wp = m * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vObjNormal = normal;
  vWorldNormal = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
```

- [ ] **Paso 4: Crear contexto, parámetros, capa y pipeline (con la lente ya conectada)**

```ts
// src/render/context.ts
export const MSG_NO_WEBGL2 =
  'Tu placa de video o tu navegador no soporta WebGL2, que el juego necesita. Actualizá los drivers de video y volvé a intentar.';
export const MSG_CONTEXT_LOST = 'Se perdió la conexión con la placa de video. Recargando…';

export function getWebGL2(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    return canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
}

export function showFatal(message: string): void {
  const el = document.createElement('div');
  el.className = 'fatal';
  el.textContent = message;
  document.body.appendChild(el);
}
```

```ts
// src/render/params.ts
export interface ViewParams {
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteDarkness: number;
  starIntensity: number;
  coronaIntensity: number;
  starCore: string;
  starEdge: string;
  lightIntensity: number;
  planetAtmosphere: number;
  nebulaIntensity: number;
  nebulaScale: number;
  nebulaColorA: string;
  nebulaColorB: string;
  nebulaColorC: string;
  lensEnabled: boolean;
  einsteinScale: number;
  diskIntensity: number;
  blackHoleX: number;
  blackHoleY: number;
  blackHoleRadius: number;
}

export const DEFAULT_PARAMS: ViewParams = {
  bloomIntensity: 1.4,
  bloomThreshold: 1.0,
  vignetteDarkness: 0.55,
  starIntensity: 6,
  coronaIntensity: 1.5,
  starCore: '#fff1d6',
  starEdge: '#ff9a3c',
  lightIntensity: 3,
  planetAtmosphere: 1,
  nebulaIntensity: 0.6,
  nebulaScale: 0.012,
  nebulaColorA: '#1b2a5e',
  nebulaColorB: '#5b1f4a',
  nebulaColorC: '#e0a070',
  lensEnabled: true,
  einsteinScale: 2.2,
  diskIntensity: 5,
  blackHoleX: 115,
  blackHoleY: 48,
  blackHoleRadius: 7,
};
```

```ts
// src/render/layer.ts
import type { Object3D, WebGLRenderer } from 'three';
import type { World } from '../sim/world';
import type { ViewRect } from './camera';
import type { ViewParams } from './params';
import type { QualitySettings } from './quality';

export interface FrameContext {
  world: World;
  alpha: number;
  time: number;
  frame: number;
  starX: number;
  starY: number;
  view: ViewRect;
  width: number;   // CSS px
  height: number;  // CSS px
  dpr: number;
  quality: QualitySettings;
  params: ViewParams;
}

export interface Layer {
  readonly object: Object3D;
  update(ctx: FrameContext): void;
  prerender?(renderer: WebGLRenderer, ctx: FrameContext): void;
  resize?(ctx: FrameContext): void;
  applyParams?(params: ViewParams): void;
}
```

```ts
// src/render/blackhole/lensPass.ts
import { ShaderMaterial, Uniform, Vector2 } from 'three';
import { ShaderPass } from 'postprocessing';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

// Lente de masa puntual: lo que se ve a distancia r viene de r - θE²/r.
// Dentro de θE la imagen se invierte, y eso arma el anillo de Einstein.
const FRAG = /* glsl */ `
uniform sampler2D inputBuffer;
uniform vec2 uCenter;
uniform float uAspect;
uniform float uEinsteinR;
uniform float uEnabled;
varying vec2 vUv;
void main() {
  vec2 d = vUv - uCenter;
  d.x *= uAspect;
  float r = max(length(d), 1e-4);
  vec2 dir = d / r;
  float beta = r - (uEinsteinR * uEinsteinR) / r;
  float w = (1.0 - smoothstep(uEinsteinR * 5.0, uEinsteinR * 8.0, r)) * uEnabled;
  vec2 src = dir * mix(r, beta, w);
  src.x /= uAspect;
  gl_FragColor = texture2D(inputBuffer, uCenter + src);
}
`;

export interface LensUniforms {
  uCenter: Uniform<Vector2>;
  uAspect: Uniform<number>;
  uEinsteinR: Uniform<number>;
  uEnabled: Uniform<number>;
}

export class LensPass extends ShaderPass {
  readonly lensUniforms: LensUniforms;

  constructor() {
    const uniforms = {
      inputBuffer: new Uniform(null),
      uCenter: new Uniform(new Vector2(0.5, 0.5)),
      uAspect: new Uniform(1),
      uEinsteinR: new Uniform(0),
      uEnabled: new Uniform(0),
    };
    super(new ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }), 'inputBuffer');
    this.lensUniforms = uniforms;
  }
}
```

```ts
// src/render/pipeline.ts
import { HalfFloatType, NoToneMapping, type OrthographicCamera, type Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import {
  BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import { LensPass } from './blackhole/lensPass';

export interface Pipeline {
  readonly renderer: WebGLRenderer;
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;
  readonly vignette: VignetteEffect;
  readonly lens: LensPass;
  setSize(width: number, height: number, dpr: number): void;
}

export function createPipeline(
  canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, scene: Scene, camera: OrthographicCamera,
): Pipeline {
  const renderer = new WebGLRenderer({ canvas, context: gl, powerPreference: 'high-performance' });
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.info.autoReset = false;

  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const lens = new LensPass();
  composer.addPass(lens);
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: 0.25, intensity: 1.4, radius: 0.8 });
  const vignette = new VignetteEffect({ offset: 0.35, darkness: 0.55 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  composer.addPass(new EffectPass(camera, bloom, vignette, tone));

  return {
    renderer, composer, bloom, vignette, lens,
    setSize(width, height, dpr) {
      renderer.setPixelRatio(dpr);
      composer.setSize(width, height);
    },
  };
}
```

- [ ] **Paso 5: Crear las capas de fondo**

```ts
// src/render/background/starfield.ts
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector2, Vector3 } from 'three';
import type { Rng } from '../../sim/rng';
import type { Layer } from '../layer';

const VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aLayer;
attribute vec3 aColor;
uniform vec2 uOffset;
uniform vec2 uExtent;
uniform float uTime;
uniform float uPixelRatio;
uniform vec3 uParallax;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  float f = aLayer < 0.5 ? uParallax.x : (aLayer < 1.5 ? uParallax.y : uParallax.z);
  vec2 p = position.xy - uOffset * f;
  p = mod(p + uExtent, 2.0 * uExtent) - uExtent;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, position.z, 1.0);
  vTwinkle = 0.75 + 0.25 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
  vColor = aColor;
  gl_PointSize = aSize * uPixelRatio;
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 24.0);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * vTwinkle, 1.0);
}
`;

const TINTS: readonly (readonly [number, number, number])[] = [
  [0.75, 0.85, 1.0], [1.0, 1.0, 1.0], [1.0, 0.93, 0.8], [1.0, 0.8, 0.6],
];
const LAYER_SIZE = [1.2, 1.8, 2.6];

export function createStarfield(count: number, rng: Rng, extentX: number, extentY: number): Layer {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const layer = new Float32Array(count);
  const color = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rng.range(-extentX, extentX);
    pos[i * 3 + 1] = rng.range(-extentY, extentY);
    pos[i * 3 + 2] = -250;
    const l = rng.next() < 0.6 ? 0 : rng.next() < 0.7 ? 1 : 2;
    layer[i] = l;
    size[i] = LAYER_SIZE[l]! * rng.range(0.7, 1.3);
    phase[i] = rng.next();
    const bright = 0.12 + Math.pow(rng.next(), 6) * 2.6 * (l === 2 ? 1.3 : 1);
    const t = TINTS[Math.floor(rng.next() * TINTS.length)]!;
    color[i * 3] = t[0] * bright;
    color[i * 3 + 1] = t[1] * bright;
    color[i * 3 + 2] = t[2] * bright;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new BufferAttribute(phase, 1));
  geo.setAttribute('aLayer', new BufferAttribute(layer, 1));
  geo.setAttribute('aColor', new BufferAttribute(color, 3));
  const mat = new ShaderMaterial({
    uniforms: {
      uOffset: { value: new Vector2() },
      uExtent: { value: new Vector2(extentX, extentY) },
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uParallax: { value: new Vector3(0.01, 0.025, 0.05) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  const offset = mat.uniforms['uOffset']!.value as Vector2;
  return {
    object: points,
    update(ctx) {
      mat.uniforms['uTime']!.value = ctx.time;
      offset.set(ctx.starX, ctx.starY);
    },
    resize(ctx) { mat.uniforms['uPixelRatio']!.value = ctx.dpr; },
  };
}
```

```ts
// src/render/background/nebula.ts
import {
  Color, HalfFloatType, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2,
  WebGLRenderTarget,
} from 'three';
import type { Layer } from '../layer';
import type { QualitySettings } from '../quality';
import { FULLSCREEN_VERT } from '../shaders/common';
import { NOISE_GLSL } from '../shaders/noise';

const FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec2 uOffset;
uniform vec2 uViewHalf;
uniform float uScale;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uIntensity;
void main() {
  vec2 world = (vUv * 2.0 - 1.0) * uViewHalf + uOffset;
  vec3 q = vec3(world * uScale, uTime * 0.004);
  float n1 = fbm(q);
  float n2 = fbm(q * 1.3 + vec3(n1 * 1.4, -n1 * 1.1, 0.0) + 3.7);
  float dens = clamp(n2 * 0.5 + 0.5, 0.0, 1.0);
  dens = smoothstep(0.35, 1.0, dens);
  dens *= dens;
  vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.75, n1 * 0.5 + 0.5));
  col = mix(col, uColorC, smoothstep(0.55, 0.95, dens));
  float dust = smoothstep(0.5, 0.8, fbm(q * 2.3 + 11.0) * 0.5 + 0.5);
  col *= dens * (1.0 - 0.7 * dust) * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

// La nebulosa se calcula a baja resolución en una textura y se actualiza cada 2 cuadros:
// cambia muy lento y así cuesta una fracción.
export function createNebula(quality: QualitySettings): Layer {
  const rt = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: false });
  const mat = new ShaderMaterial({
    defines: { OCTAVES: quality.nebulaOctaves },
    uniforms: {
      uTime: { value: 0 },
      uOffset: { value: new Vector2() },
      uViewHalf: { value: new Vector2(1, 1) },
      uScale: { value: 0.012 },
      uColorA: { value: new Color() },
      uColorB: { value: new Color() },
      uColorC: { value: new Color() },
      uIntensity: { value: 0.6 },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: NOISE_GLSL + FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const nScene = new Scene();
  nScene.add(quad);
  const nCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const display = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: rt.texture, depthWrite: false }));
  display.position.z = -300;
  display.frustumCulled = false;
  display.renderOrder = -10;
  const offset = mat.uniforms['uOffset']!.value as Vector2;
  const viewHalf = mat.uniforms['uViewHalf']!.value as Vector2;
  return {
    object: display,
    update(ctx) {
      mat.uniforms['uTime']!.value = ctx.time;
      offset.set(ctx.starX * 0.08, ctx.starY * 0.08);
    },
    resize(ctx) {
      const s = ctx.quality.nebulaScale;
      rt.setSize(Math.max(1, Math.round(ctx.width * ctx.dpr * s)), Math.max(1, Math.round(ctx.height * ctx.dpr * s)));
      display.scale.set(ctx.view.halfWidth, ctx.view.halfHeight, 1);
      viewHalf.set(ctx.view.halfWidth, ctx.view.halfHeight);
    },
    prerender(renderer, ctx) {
      if (ctx.frame > 1 && ctx.frame % 2 !== 0) return;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(nScene, nCam);
      renderer.setRenderTarget(prev);
    },
    applyParams(p) {
      mat.uniforms['uIntensity']!.value = p.nebulaIntensity;
      mat.uniforms['uScale']!.value = p.nebulaScale;
      (mat.uniforms['uColorA']!.value as Color).set(p.nebulaColorA);
      (mat.uniforms['uColorB']!.value as Color).set(p.nebulaColorB);
      (mat.uniforms['uColorC']!.value as Color).set(p.nebulaColorC);
    },
  };
}
```

- [ ] **Paso 6: Crear la lista de capas y la vista**

```ts
// src/render/layers.ts
import type { Rng } from '../sim/rng';
import type { World } from '../sim/world';
import { createNebula } from './background/nebula';
import { createStarfield } from './background/starfield';
import type { Layer } from './layer';
import type { Pipeline } from './pipeline';
import type { QualitySettings } from './quality';

export interface LayerDeps { world: World; quality: QualitySettings; rng: Rng; pipeline: Pipeline }

export function buildLayers(deps: LayerDeps): Layer[] {
  const c = deps.world.config;
  return [
    createNebula(deps.quality),
    createStarfield(deps.quality.starCount, deps.rng, c.arenaHalfWidth * 1.6, c.arenaHalfHeight * 1.6),
  ];
}
```

```ts
// src/render/spaceView.ts
import { Color, OrthographicCamera, Scene, type WebGLRenderer } from 'three';
import { createRng } from '../sim/rng';
import type { World } from '../sim/world';
import { fitView, screenToWorld } from './camera';
import { getWebGL2, MSG_CONTEXT_LOST, MSG_NO_WEBGL2, showFatal } from './context';
import type { FrameContext } from './layer';
import { buildLayers } from './layers';
import { DEFAULT_PARAMS, type ViewParams } from './params';
import { createPipeline } from './pipeline';
import { QUALITY, type QualityLevel } from './quality';

export interface Diagnostics {
  frames: number;
  quality: QualityLevel;
  calls: number;
  triangles: number;
  orbiting: number;
  canvasWidth: number;
  canvasHeight: number;
  lastFrameMs: number;   // tiempo de CPU para armar el cuadro
  lensEnabled: number;
  lensRadius: number;
}

export interface SpaceView {
  readonly ok: true;
  readonly params: ViewParams;
  readonly diagnostics: Diagnostics;
  readonly renderer: WebGLRenderer;
  update(world: World, alpha: number, time: number): void;
  render(): void;
  applyParams(): void;
  setQuality(level: QualityLevel): void;
  screenToWorld(sx: number, sy: number, out: { x: number; y: number }): { x: number; y: number };
}

export interface ViewFailure { readonly ok: false; readonly reason: string }

export interface SpaceViewOptions { world: World; quality: QualityLevel; seed?: number; params?: Partial<ViewParams> }

export function createSpaceView(canvas: HTMLCanvasElement, opts: SpaceViewOptions): SpaceView | ViewFailure {
  const gl = getWebGL2(canvas);
  if (!gl) return { ok: false, reason: MSG_NO_WEBGL2 };

  const cfg = opts.world.config;
  const params: ViewParams = { ...DEFAULT_PARAMS, ...opts.params };
  let quality = QUALITY[opts.quality];

  const scene = new Scene();
  scene.background = new Color(0x000000);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);

  const pipeline = createPipeline(canvas, gl, scene, camera);
  const layers = buildLayers({ world: opts.world, quality, rng: createRng(opts.seed ?? 1), pipeline });
  for (const l of layers) scene.add(l.object);

  const diagnostics: Diagnostics = {
    frames: 0, quality: quality.level, calls: 0, triangles: 0, orbiting: 0,
    canvasWidth: 0, canvasHeight: 0, lastFrameMs: 0, lensEnabled: 0, lensRadius: 0,
  };
  const ctx: FrameContext = {
    world: opts.world, alpha: 1, time: 0, frame: 0, starX: 0, starY: 0,
    view: { halfWidth: cfg.arenaHalfWidth, halfHeight: cfg.arenaHalfHeight },
    width: 1, height: 1, dpr: 1, quality, params,
  };

  const resize = (): void => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
    pipeline.setSize(w, h, dpr);
    const v = fitView(cfg.arenaHalfWidth, cfg.arenaHalfHeight, w / h);
    ctx.view.halfWidth = v.halfWidth;
    ctx.view.halfHeight = v.halfHeight;
    camera.left = -v.halfWidth;
    camera.right = v.halfWidth;
    camera.top = v.halfHeight;
    camera.bottom = -v.halfHeight;
    camera.updateProjectionMatrix();
    ctx.width = w;
    ctx.height = h;
    ctx.dpr = dpr;
    ctx.quality = quality;
    for (const l of layers) l.resize?.(ctx);
    diagnostics.canvasWidth = canvas.width;
    diagnostics.canvasHeight = canvas.height;
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showFatal(MSG_CONTEXT_LOST);
    setTimeout(() => location.reload(), 1500);
  });

  const applyParams = (): void => {
    pipeline.bloom.intensity = params.bloomIntensity;
    pipeline.bloom.luminanceMaterial.threshold = params.bloomThreshold;
    pipeline.vignette.darkness = params.vignetteDarkness;
    for (const l of layers) l.applyParams?.(params);
  };
  applyParams();

  const lensU = pipeline.lens.lensUniforms;

  return {
    ok: true,
    params,
    diagnostics,
    renderer: pipeline.renderer,
    update(world, alpha, time) {
      ctx.world = world;
      ctx.alpha = alpha;
      ctx.time = time;
      ctx.starX = world.star.prevX + (world.star.x - world.star.prevX) * alpha;
      ctx.starY = world.star.prevY + (world.star.y - world.star.prevY) * alpha;
      for (const l of layers) l.update(ctx);
    },
    render() {
      const t0 = performance.now();
      pipeline.renderer.info.reset();
      for (const l of layers) l.prerender?.(pipeline.renderer, ctx);
      pipeline.composer.render();
      ctx.frame++;
      diagnostics.frames++;
      diagnostics.calls = pipeline.renderer.info.render.calls;
      diagnostics.triangles = pipeline.renderer.info.render.triangles;
      diagnostics.orbiting = ctx.world.orbitingCount;
      diagnostics.lensEnabled = lensU.uEnabled.value;
      diagnostics.lensRadius = lensU.uEinsteinR.value;
      diagnostics.lastFrameMs = performance.now() - t0;
    },
    applyParams,
    setQuality(level) {
      quality = QUALITY[level];
      diagnostics.quality = level;
      resize();
    },
    screenToWorld(sx, sy, out) {
      return screenToWorld(sx, sy, ctx.width, ctx.height, ctx.view, out);
    },
  };
}
```

Nota: `setQuality` cambia en vivo el DPR y la resolución de la nebulosa. Las octavas, la cantidad de estrellas y los segmentos se aplican recién la próxima vez que se carga la página.

- [ ] **Paso 7: Reemplazar `src/renderer/game.ts` y ampliar `globals.d.ts`**

```ts
// src/renderer/game.ts
import { InputController } from '../input/controller';
import { QualityGovernor } from '../perf/qualityGovernor';
import { showFatal } from '../render/context';
import { createSpaceView } from '../render/spaceView';
import { DEFAULT_CONFIG } from '../sim/config';
import { FixedStepper } from '../sim/loop';
import { step } from '../sim/step';
import { createWorld } from '../sim/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const world = createWorld(DEFAULT_CONFIG, 20261124);
const view = createSpaceView(canvas, { world, quality: 'high' });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const input = new InputController(canvas, (sx, sy, out) => { view.screenToWorld(sx, sy, out); });
  const stepper = new FixedStepper();
  const governor = new QualityGovernor('high');
  window.__GAME__ = { diagnostics: view.diagnostics, world };
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    const steps = stepper.advance(elapsed);
    const intent = input.poll(world.star.x, world.star.y);
    for (let i = 0; i < steps; i++) step(world, intent);
    view.update(world, stepper.alpha, now / 1000);
    view.render();
    const next = governor.sample(elapsed * 1000);
    if (next) view.setQuality(next);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
```

```ts
// src/renderer/globals.d.ts
import type { Diagnostics } from '../render/spaceView';
import type { World } from '../sim/world';

declare global {
  interface Window {
    platform?: { kind: 'electron' };
    __GAME__?: { diagnostics: Diagnostics; world: World };
  }
}
export {};
```

- [ ] **Paso 8: Correr las pruebas**

```bash
npm run typecheck
npx playwright test --project=web
```

Esperado: typecheck sin errores; las 4 pruebas web pasan (boot, arranque, cambio de tamaño y sin WebGL2).

- [ ] **Paso 9: Mirar la captura**

Abrir `artifacts/e2e/juego.png`. Esperado: fondo negro con estrellas de distintos brillos y una nebulosa tenue en azul, morado y ocre. Si se ve totalmente negro, aplicar la skill `threejs-debug-profiler` (sección "Blank or bad canvas") antes de seguir.

- [ ] **Paso 10: Commit**

```bash
git add src tests/e2e/game.spec.ts tests/e2e/nowebgl.spec.ts
git commit -m "Agregar el pipeline gráfico con nebulosa y estrellas de fondo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 7: Cuerpos — estrella del jugador, planetas y asteroides

**Archivos:**
- Crear: `src/render/bodies/star.ts`, `src/render/bodies/planets.ts`, `src/render/bodies/asteroids.ts`
- Modificar: `src/render/layers.ts` (se reemplaza entero)
- Pruebas: agregar una prueba a `tests/e2e/game.spec.ts`

**Interfaces:**
- Consume: `Layer`, `FrameContext`, `ViewParams`, `BODY_VERT`, `PLANE_VERT`, `NOISE_GLSL`, `World`, `Rng` y las constantes `KIND_*`.
- Produce:
  - `createStarLayer(segments: number): Layer` y `starRenderRadius(mass: number): number`.
  - `createPlanetsLayer(world: World, segments: number, rng: Rng): Layer`.
  - `createAsteroidLayer(world: World, rng: Rng): Layer` y `createRockGeometry(): BufferGeometry`.

- [ ] **Paso 1: Escribir la prueba e2e que falla**

Agregar al final de `tests/e2e/game.spec.ts`:

```ts
test('al mover el mouse la estrella captura asteroides', async ({ page }) => {
  await boot(page);
  for (let k = 0; k < 120; k++) {
    const a = k * 0.15;
    await page.mouse.move(640 + Math.cos(a) * 300, 360 + Math.sin(a) * 200);
    await page.waitForTimeout(50);
  }
  const orbiting = await page.evaluate(() => window.__GAME__!.diagnostics.orbiting);
  expect(orbiting).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/e2e/capturas.png' });
});
```

- [ ] **Paso 2: Correr y ver que falle**

Correr: `npx playwright test --project=web tests/e2e/game.spec.ts -g "captura"`
Esperado: PASS en la lógica, porque la simulación ya captura, **pero** la captura no muestra estrella ni asteroides. Este paso existe para confirmarlo mirando `artifacts/e2e/capturas.png`: sólo se ve el fondo. El criterio de "falla" es esa imagen vacía.

- [ ] **Paso 3: Crear la estrella**

```ts
// src/render/bodies/star.ts
import {
  AdditiveBlending, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, ShaderMaterial, SphereGeometry,
} from 'three';
import type { Layer } from '../layer';
import { BODY_VERT, PLANE_VERT } from '../shaders/common';
import { NOISE_GLSL } from '../shaders/noise';

const CORE_FRAG = /* glsl */ `
varying vec3 vObjNormal;
varying vec3 vWorldNormal;
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uEdge;
uniform float uIntensity;
void main() {
  vec3 n = normalize(vWorldNormal);
  float mu = clamp(n.z, 0.0, 1.0);
  float limb = 0.4 + 0.6 * pow(mu, 0.5);
  float g = fbm(normalize(vObjNormal) * 6.0 + vec3(0.0, 0.0, uTime * 0.15)) * 0.5 + 0.5;
  vec3 col = mix(uEdge, uCore, limb) * (0.85 + 0.3 * g);
  gl_FragColor = vec4(col * uIntensity * limb, 1.0);
}
`;

const CORONA_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uCoreFrac;
void main() {
  vec2 d = vUv * 2.0 - 1.0;
  float r = length(d);
  if (r > 1.0) discard;
  float a = atan(d.y, d.x);
  float rays = 0.65 + 0.35 * snoise(vec3(cos(a) * 2.0, sin(a) * 2.0, uTime * 0.2));
  float x = max(r - uCoreFrac, 0.0) / (1.0 - uCoreFrac);
  float glow = exp(-x * 5.0) * rays + exp(-x * 18.0) * 1.5;
  glow *= 1.0 - smoothstep(0.7, 1.0, r);
  gl_FragColor = vec4(uColor * glow * uIntensity, 1.0);
}
`;

export function starRenderRadius(mass: number): number {
  return 2.2 + 0.35 * Math.sqrt(mass);
}

export function createStarLayer(segments: number): Layer {
  const coreMat = new ShaderMaterial({
    defines: { OCTAVES: 4 },
    uniforms: { uTime: { value: 0 }, uCore: { value: new Color() }, uEdge: { value: new Color() }, uIntensity: { value: 6 } },
    vertexShader: BODY_VERT,
    fragmentShader: NOISE_GLSL + CORE_FRAG,
  });
  const core = new Mesh(new SphereGeometry(1, segments, Math.max(8, Math.floor(segments / 2))), coreMat);

  const coronaMat = new ShaderMaterial({
    defines: { OCTAVES: 2 },
    uniforms: { uTime: { value: 0 }, uColor: { value: new Color() }, uIntensity: { value: 1.5 }, uCoreFrac: { value: 0.25 } },
    vertexShader: PLANE_VERT,
    fragmentShader: NOISE_GLSL + CORONA_FRAG,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const corona = new Mesh(new PlaneGeometry(2, 2), coronaMat);
  corona.position.z = -1.5;
  corona.scale.setScalar(4);   // la corona llega a 4 radios; el núcleo ocupa 1/4 (uCoreFrac)

  const body = new Group();
  body.add(corona, core);

  const ring = new Mesh(
    new RingGeometry(0.97, 1.0, 128),
    new MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false }),
  );

  const root = new Group();
  root.add(body, ring);

  return {
    object: root,
    update(ctx) {
      body.position.set(ctx.starX, ctx.starY, 0);
      body.scale.setScalar(starRenderRadius(ctx.world.star.mass));
      ring.position.set(ctx.starX, ctx.starY, 0.5);
      ring.scale.setScalar(ctx.world.star.captureRadius);
      coreMat.uniforms['uTime']!.value = ctx.time;
      coronaMat.uniforms['uTime']!.value = ctx.time;
    },
    applyParams(p) {
      coreMat.uniforms['uIntensity']!.value = p.starIntensity;
      coronaMat.uniforms['uIntensity']!.value = p.coronaIntensity;
      (coreMat.uniforms['uCore']!.value as Color).set(p.starCore);
      (coreMat.uniforms['uEdge']!.value as Color).set(p.starEdge);
      (coronaMat.uniforms['uColor']!.value as Color).set(p.starEdge);
    },
  };
}
```

- [ ] **Paso 4: Crear los planetas**

```ts
// src/render/bodies/planets.ts
import {
  AdditiveBlending, Color, Euler, Group, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, SphereGeometry, Vector3,
} from 'three';
import type { Rng } from '../../sim/rng';
import { KIND_GAS, KIND_ICE, KIND_ROCKY, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { BODY_VERT } from '../shaders/common';
import { NOISE_GLSL } from '../shaders/noise';

const PLANET_FRAG = /* glsl */ `
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uAtmo;
uniform float uAtmoStrength;
uniform float uBands;
uniform float uTime;
uniform float uAmbient;
varying vec3 vObjNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vSeed;
void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 on = normalize(vObjNormal);
  vec3 p = on * 2.0 + vSeed * 17.0;
  float rocky = fbm(p) * 0.5 + 0.5;
  float bands = sin(on.y * 10.0 + fbm(p * 0.7 + vec3(0.0, uTime * 0.03, 0.0)) * 2.5) * 0.5 + 0.5;
  float t = mix(rocky, bands, uBands);
  vec3 albedo = mix(uColorA, uColorB, smoothstep(0.3, 0.6, t));
  albedo = mix(albedo, uColorC, smoothstep(0.62, 0.85, t));
  float ndl = dot(n, L);
  vec3 col = albedo * (uLightColor * max(ndl, 0.0) + uAmbient);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.5);
  col += uAtmo * rim * uAtmoStrength * smoothstep(-0.25, 0.35, ndl);
  col += uAtmo * 0.12 * smoothstep(-0.05, 0.12, ndl) * (1.0 - smoothstep(0.12, 0.4, ndl));
  gl_FragColor = vec4(col, 1.0);
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uLightPos;
uniform vec3 uAtmo;
uniform float uAtmoStrength;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 n = normalize(vWorldNormal);
  float ndl = dot(n, normalize(uLightPos - vWorldPos));
  float edge = 1.0 - clamp(n.z, 0.0, 1.0);
  float glow = pow(edge, 3.0) * smoothstep(-0.3, 0.5, ndl);
  gl_FragColor = vec4(uAtmo * glow * uAtmoStrength, 1.0);
}
`;

interface Preset { a: string; b: string; c: string; atmo: string; atmoStrength: number; bands: number }

const PRESETS: Record<number, Preset> = {
  [KIND_ROCKY]: { a: '#3b2f2a', b: '#7a5a43', c: '#c9b08a', atmo: '#8fb4ff', atmoStrength: 0.7, bands: 0 },
  [KIND_ICE]: { a: '#6f8fb0', b: '#cfe3f2', c: '#ffffff', atmo: '#bfe8ff', atmoStrength: 1.0, bands: 0 },
  [KIND_GAS]: { a: '#8a5a36', b: '#d9a86c', c: '#f3e0bf', atmo: '#ffd2a0', atmoStrength: 0.8, bands: 1 },
};

interface Entry {
  body: InstancedMesh;
  atmo: InstancedMesh;
  mat: ShaderMaterial;
  indices: Int32Array;
  tilt: Float32Array;
  spin: Float32Array;
  baseAtmo: number;
}

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const pos = new Vector3();
const scl = new Vector3();
const seedColor = new Color();

export function createPlanetsLayer(world: World, segments: number, rng: Rng): Layer {
  const group = new Group();
  const geo = new SphereGeometry(1, segments, Math.max(8, Math.floor(segments / 2)));
  const lightPos = new Vector3();
  const entries: Entry[] = [];

  for (const kind of [KIND_ROCKY, KIND_ICE, KIND_GAS]) {
    let n = 0;
    for (let i = 0; i < world.count; i++) if (world.kind[i] === kind) n++;
    if (n === 0) continue;
    const indices = new Int32Array(n);
    let k = 0;
    for (let i = 0; i < world.count; i++) if (world.kind[i] === kind) indices[k++] = i;
    const pre = PRESETS[kind]!;
    const mat = new ShaderMaterial({
      defines: { OCTAVES: 5 },
      uniforms: {
        uLightPos: { value: lightPos },
        uLightColor: { value: new Vector3(1.3, 1.25, 1.15) },
        uColorA: { value: new Color(pre.a) },
        uColorB: { value: new Color(pre.b) },
        uColorC: { value: new Color(pre.c) },
        uAtmo: { value: new Color(pre.atmo) },
        uAtmoStrength: { value: pre.atmoStrength },
        uBands: { value: pre.bands },
        uTime: { value: 0 },
        uAmbient: { value: 0.015 },
      },
      vertexShader: BODY_VERT,
      fragmentShader: NOISE_GLSL + PLANET_FRAG,
    });
    const atmoMat = new ShaderMaterial({
      uniforms: { uLightPos: mat.uniforms['uLightPos']!, uAtmo: mat.uniforms['uAtmo']!, uAtmoStrength: mat.uniforms['uAtmoStrength']! },
      vertexShader: BODY_VERT,
      fragmentShader: ATMO_FRAG,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const body = new InstancedMesh(geo, mat, n);
    const atmo = new InstancedMesh(geo, atmoMat, n);
    body.frustumCulled = false;
    atmo.frustumCulled = false;
    atmo.renderOrder = 1;
    const tilt = new Float32Array(n);
    const spin = new Float32Array(n);
    for (let s = 0; s < n; s++) {
      tilt[s] = rng.range(-0.5, 0.5);
      spin[s] = rng.range(0.05, 0.2);
      seedColor.setRGB(rng.next(), 0, 0);
      body.setColorAt(s, seedColor);
      atmo.setColorAt(s, seedColor);
    }
    group.add(body, atmo);
    entries.push({ body, atmo, mat, indices, tilt, spin, baseAtmo: pre.atmoStrength });
  }

  return {
    object: group,
    update(ctx) {
      const w = ctx.world;
      const a = ctx.alpha;
      lightPos.set(ctx.starX, ctx.starY, 25);
      for (let k = 0; k < entries.length; k++) {
        const en = entries[k]!;
        en.mat.uniforms['uTime']!.value = ctx.time;
        for (let s = 0; s < en.indices.length; s++) {
          const i = en.indices[s]!;
          pos.set(w.prevX[i] + (w.x[i] - w.prevX[i]) * a, w.prevY[i] + (w.y[i] - w.prevY[i]) * a, 0);
          e.set(en.tilt[s]!, ctx.time * en.spin[s]!, 0);
          q.setFromEuler(e);
          scl.setScalar(w.radius[i]);
          m4.compose(pos, q, scl);
          en.body.setMatrixAt(s, m4);
          scl.setScalar(w.radius[i] * 1.12);
          m4.compose(pos, q, scl);
          en.atmo.setMatrixAt(s, m4);
        }
        en.body.instanceMatrix.needsUpdate = true;
        en.atmo.instanceMatrix.needsUpdate = true;
      }
    },
    applyParams(p) {
      for (const en of entries) en.mat.uniforms['uAtmoStrength']!.value = en.baseAtmo * p.planetAtmosphere;
    },
  };
}
```

Aclaración sobre la interpolación: un cuerpo que reaparece del otro lado del mapa interpola en el mismo cuadro entre las dos puntas y se ve cruzando la pantalla durante un cuadro. Es un detalle aceptable en el hito 0, y se anota en Notion como pendiente para el hito 1.

- [ ] **Paso 5: Crear los asteroides**

```ts
// src/render/bodies/asteroids.ts
import {
  type BufferAttribute, type BufferGeometry, Color, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, Matrix4,
  MeshStandardMaterial, PointLight, Quaternion, Vector3,
} from 'three';
import type { Rng } from '../../sim/rng';
import { KIND_ASTEROID, type World } from '../../sim/world';
import type { Layer } from '../layer';

// Roca irregular: la deformación depende sólo de la posición, así los vértices repetidos no se separan.
export function createRockGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(1, 2);
  const p = g.attributes['position'] as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const d = 1
      + 0.18 * Math.sin(3.1 * x + 1.7) * Math.cos(2.3 * y + 0.4)
      + 0.12 * Math.sin(5.3 * z + 2.2 + 1.9 * x)
      + 0.06 * Math.sin(9.1 * (x + y + z));
    p.setXYZ(i, x * d, y * d, z * d);
  }
  g.computeVertexNormals();
  return g;
}

const m4 = new Matrix4();
const q = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();
const axis = new Vector3();
const tint = new Color();

export function createAsteroidLayer(world: World, rng: Rng): Layer {
  let n = 0;
  for (let i = 0; i < world.count; i++) if (world.kind[i] === KIND_ASTEROID) n++;
  const indices = new Int32Array(n);
  let k = 0;
  for (let i = 0; i < world.count; i++) if (world.kind[i] === KIND_ASTEROID) indices[k++] = i;

  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: true });
  const mesh = new InstancedMesh(createRockGeometry(), mat, Math.max(1, n));
  mesh.count = n;
  mesh.frustumCulled = false;
  const axes = new Float32Array(n * 3);
  const spin = new Float32Array(n);
  for (let s = 0; s < n; s++) {
    const base = 0.35 + rng.next() * 0.35;
    const warm = rng.next() * 0.08;
    tint.setRGB(base + warm, base, base - warm * 0.5);
    mesh.setColorAt(s, tint);
    axis.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
    axes[s * 3] = axis.x;
    axes[s * 3 + 1] = axis.y;
    axes[s * 3 + 2] = axis.z;
    spin[s] = rng.range(0.2, 1.5);
  }

  const light = new PointLight(0xfff1d6, 3, 0, 0);
  const hemi = new HemisphereLight(0x1a2340, 0x000000, 0.15);
  const group = new Group();
  group.add(mesh, light, hemi);

  return {
    object: group,
    update(ctx) {
      const w = ctx.world;
      const a = ctx.alpha;
      light.position.set(ctx.starX, ctx.starY, 25);
      for (let s = 0; s < n; s++) {
        const i = indices[s]!;
        pos.set(w.prevX[i] + (w.x[i] - w.prevX[i]) * a, w.prevY[i] + (w.y[i] - w.prevY[i]) * a, 0);
        axis.set(axes[s * 3]!, axes[s * 3 + 1]!, axes[s * 3 + 2]!);
        q.setFromAxisAngle(axis, ctx.time * spin[s]! + s);
        scl.setScalar(w.radius[i]);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(s, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    applyParams(p) { light.intensity = p.lightIntensity; },
  };
}
```

- [ ] **Paso 6: Reemplazar `src/render/layers.ts`**

```ts
// src/render/layers.ts
import type { Rng } from '../sim/rng';
import type { World } from '../sim/world';
import { createNebula } from './background/nebula';
import { createStarfield } from './background/starfield';
import { createAsteroidLayer } from './bodies/asteroids';
import { createPlanetsLayer } from './bodies/planets';
import { createStarLayer } from './bodies/star';
import type { Layer } from './layer';
import type { Pipeline } from './pipeline';
import type { QualitySettings } from './quality';

export interface LayerDeps { world: World; quality: QualitySettings; rng: Rng; pipeline: Pipeline }

export function buildLayers(deps: LayerDeps): Layer[] {
  const c = deps.world.config;
  return [
    createNebula(deps.quality),
    createStarfield(deps.quality.starCount, deps.rng, c.arenaHalfWidth * 1.6, c.arenaHalfHeight * 1.6),
    createPlanetsLayer(deps.world, deps.quality.planetSegments, deps.rng),
    createAsteroidLayer(deps.world, deps.rng),
    createStarLayer(deps.quality.planetSegments),
  ];
}
```

- [ ] **Paso 7: Correr las pruebas y mirar las capturas**

```bash
npm run typecheck
npx playwright test --project=web
```

Esperado: las 5 pruebas web pasan. En `artifacts/e2e/capturas.png` se ve:
- una estrella brillante con corona y su anillo de captura tenue;
- asteroides grises iluminados de un costado, algunos orbitándola;
- planetas con lado de día y de noche, y un borde de atmósfera hacia la estrella.

- [ ] **Paso 8: Commit**

```bash
git add src/render tests/e2e/game.spec.ts
git commit -m "Dibujar la estrella, los planetas y los asteroides con luz

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 8: Agujero negro — horizonte, disco de acreción, anillo de fotones y lente

**Archivos:**
- Crear: `src/render/blackhole/blackHole.ts`
- Modificar: `src/render/layers.ts` (se agrega una línea y un import)
- Pruebas: agregar una prueba a `tests/e2e/game.spec.ts`

**Interfaces:**
- Consume: `Pipeline.lens.lensUniforms` (Tarea 6), `LOCAL_VERT`, `NOISE_GLSL` y `ViewParams` (`blackHoleX`, `blackHoleY`, `blackHoleRadius`, `einsteinScale`, `diskIntensity` y `lensEnabled`).
- Produce: `createBlackHoleLayer(pipeline: Pipeline): Layer`.

- [ ] **Paso 1: Escribir la prueba e2e que falla**

Agregar al final de `tests/e2e/game.spec.ts`:

```ts
test('el agujero negro activa la lente', async ({ page }) => {
  await boot(page);
  const d = await page.evaluate(() => window.__GAME__!.diagnostics);
  expect(d.lensEnabled).toBe(1);
  expect(d.lensRadius).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/e2e/agujero-negro.png' });
});
```

- [ ] **Paso 2: Correr y ver que falle**

Correr: `npx playwright test --project=web -g "agujero negro"`
Esperado: FAIL con `lensEnabled` igual a 0, porque nadie actualiza todavía la lente.

- [ ] **Paso 3: Implementar la capa**

```ts
// src/render/blackhole/blackHole.ts
import {
  AdditiveBlending, CircleGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, ShaderMaterial,
} from 'three';
import type { Layer } from '../layer';
import type { Pipeline } from '../pipeline';
import { LOCAL_VERT } from '../shaders/common';
import { NOISE_GLSL } from '../shaders/noise';

const DISK_FRAG = /* glsl */ `
varying vec3 vLocal;
uniform float uTime;
uniform float uIntensity;
uniform float uInner;
uniform float uOuter;
uniform vec3 uHot;
uniform vec3 uCool;
void main() {
  float r = length(vLocal.xy);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float ang = atan(vLocal.y, vLocal.x);
  float a2 = ang + uTime * 1.6 / pow(r, 1.5);
  vec3 p = vec3(cos(a2) * r, sin(a2) * r, r * 0.7) * 0.9;
  float n = fbm(p) * 0.5 + 0.5;
  float streaks = 0.55 + 0.7 * n;
  float doppler = 1.0 + 0.65 * cos(ang - 0.6);
  float radial = pow(1.0 - t, 1.6) * smoothstep(0.0, 0.05, t);
  float fade = 1.0 - smoothstep(0.8, 1.0, t);
  vec3 col = mix(uCool, uHot, pow(1.0 - t, 2.0));
  gl_FragColor = vec4(col * radial * streaks * doppler * fade * uIntensity, 1.0);
}
`;

const PHOTON_FRAG = /* glsl */ `
varying vec3 vLocal;
uniform vec3 uColor;
uniform float uIntensity;
void main() {
  float r = length(vLocal.xy);
  float g = exp(-pow((r - 1.05) / 0.035, 2.0));
  gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
}
`;

export function createBlackHoleLayer(pipeline: Pipeline): Layer {
  const horizon = new Mesh(new CircleGeometry(1, 96), new MeshBasicMaterial({ color: 0x000000 }));
  horizon.position.z = 0.1;

  const diskMat = new ShaderMaterial({
    defines: { OCTAVES: 4 },
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 5 },
      uInner: { value: 1.6 },
      uOuter: { value: 5.0 },
      uHot: { value: new Color(1.0, 0.85, 0.6) },
      uCool: { value: new Color(0.9, 0.35, 0.1) },
    },
    vertexShader: LOCAL_VERT,
    fragmentShader: NOISE_GLSL + DISK_FRAG,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    side: DoubleSide,
  });
  const disk = new Mesh(new RingGeometry(1.6, 5.0, 160, 4), diskMat);
  disk.rotation.x = -1.12;   // disco inclinado: la mitad de atrás queda tapada por el horizonte
  const diskPivot = new Group();
  diskPivot.rotation.z = 0.35;
  diskPivot.add(disk);

  const photonMat = new ShaderMaterial({
    uniforms: { uColor: { value: new Color(1.0, 0.8, 0.55) }, uIntensity: { value: 3 } },
    vertexShader: LOCAL_VERT,
    fragmentShader: PHOTON_FRAG,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    transparent: true,
  });
  const photon = new Mesh(new RingGeometry(1.0, 1.15, 160, 1), photonMat);
  photon.position.z = 0.2;

  const group = new Group();
  group.add(horizon, diskPivot, photon);
  const lens = pipeline.lens.lensUniforms;

  return {
    object: group,
    update(ctx) {
      const p = ctx.params;
      group.position.set(p.blackHoleX, p.blackHoleY, 0);
      group.scale.setScalar(p.blackHoleRadius);
      diskMat.uniforms['uTime']!.value = ctx.time;
      lens.uCenter.value.set((p.blackHoleX / ctx.view.halfWidth + 1) * 0.5, (p.blackHoleY / ctx.view.halfHeight + 1) * 0.5);
      lens.uAspect.value = ctx.width / ctx.height;
      lens.uEinsteinR.value = (p.blackHoleRadius * p.einsteinScale) / (2 * ctx.view.halfHeight);
      lens.uEnabled.value = p.lensEnabled ? 1 : 0;
    },
    applyParams(p) {
      diskMat.uniforms['uIntensity']!.value = p.diskIntensity;
      photonMat.uniforms['uIntensity']!.value = p.diskIntensity * 0.6;
    },
  };
}
```

- [ ] **Paso 4: Sumar la capa en `src/render/layers.ts`**

Agregar el import:

```ts
import { createBlackHoleLayer } from './blackhole/blackHole';
```

y como último elemento del array que devuelve `buildLayers`:

```ts
    createBlackHoleLayer(deps.pipeline),
```

- [ ] **Paso 5: Correr y mirar**

```bash
npm run typecheck
npx playwright test --project=web
```

Esperado: las 6 pruebas web pasan. En `artifacts/e2e/agujero-negro.png`, arriba a la derecha, se ve:
- un círculo negro;
- un disco anaranjado inclinado, más brillante de un lado;
- un anillo fino de luz;
- las estrellas y la nebulosa del fondo curvadas alrededor (lente).

- [ ] **Paso 6: Commit**

```bash
git add src/render tests/e2e/game.spec.ts
git commit -m "Agregar el agujero negro con disco de acreción y lente gravitatoria

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 9: Laboratorio visual

**Archivos:**
- Crear: `src/renderer/lab.html`, `src/renderer/lab.ts`, `src/dev/visual-lab/main.ts`
- Modificar: `src/renderer/globals.d.ts` (agregar `__LAB__`)
- Pruebas: `tests/e2e/lab.spec.ts`

**Interfaces:**
- Consume: `createSpaceView`, `ViewParams`, `createWorld`, `DEFAULT_CONFIG`, `step`, `FixedStepper`, `InputController` y `showFatal`.
- Produce: la página `/lab.html` y `window.__LAB__ = { params: ViewParams; apply(): void }`.

- [ ] **Paso 1: Escribir la prueba e2e que falla**

```ts
// tests/e2e/lab.spec.ts
import { expect, test } from '@playwright/test';

test('el laboratorio carga con su panel y acepta cambios', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/lab.html');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.getByText('Laboratorio visual')).toBeVisible();
  await page.evaluate(() => {
    window.__LAB__!.params.blackHoleX = 0;
    window.__LAB__!.params.blackHoleY = 0;
    window.__LAB__!.params.diskIntensity = 8;
    window.__LAB__!.apply();
  });
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/e2e/laboratorio.png' });
});
```

- [ ] **Paso 2: Correr y ver que falle**

Correr: `npx playwright test --project=web tests/e2e/lab.spec.ts`
Esperado: FAIL, porque `/lab.html` da 404 o no carga nada.

- [ ] **Paso 3: Implementar**

```html
<!-- src/renderer/lab.html -->
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Laboratorio visual — Enjambre gravitatorio</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="./lab.ts"></script>
  </body>
</html>
```

```ts
// src/renderer/lab.ts
import '../dev/visual-lab/main';
```

```ts
// src/dev/visual-lab/main.ts
import Stats from 'stats-gl';
import { Pane } from 'tweakpane';
import { InputController } from '../../input/controller';
import { showFatal } from '../../render/context';
import type { QualityLevel } from '../../render/quality';
import { createSpaceView } from '../../render/spaceView';
import { DEFAULT_CONFIG } from '../../sim/config';
import { FixedStepper } from '../../sim/loop';
import { step } from '../../sim/step';
import { createWorld } from '../../sim/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const world = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 300, planetCount: 6 }, 7);
const view = createSpaceView(canvas, { world, quality: 'high' });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const p = view.params;
  const lab = { paused: false, quality: 'high' as QualityLevel };
  const pane = new Pane({ title: 'Laboratorio visual' });

  const post = pane.addFolder({ title: 'Postproceso' });
  post.addBinding(p, 'bloomIntensity', { min: 0, max: 4, label: 'Bloom' });
  post.addBinding(p, 'bloomThreshold', { min: 0, max: 3, label: 'Umbral' });
  post.addBinding(p, 'vignetteDarkness', { min: 0, max: 1, label: 'Viñeta' });

  const star = pane.addFolder({ title: 'Estrella' });
  star.addBinding(p, 'starIntensity', { min: 0, max: 20, label: 'Brillo' });
  star.addBinding(p, 'coronaIntensity', { min: 0, max: 5, label: 'Corona' });
  star.addBinding(p, 'starCore', { label: 'Núcleo' });
  star.addBinding(p, 'starEdge', { label: 'Borde' });
  star.addBinding(p, 'lightIntensity', { min: 0, max: 10, label: 'Luz sobre rocas' });

  const planets = pane.addFolder({ title: 'Planetas' });
  planets.addBinding(p, 'planetAtmosphere', { min: 0, max: 3, label: 'Atmósfera' });

  const nebula = pane.addFolder({ title: 'Nebulosa' });
  nebula.addBinding(p, 'nebulaIntensity', { min: 0, max: 3, label: 'Intensidad' });
  nebula.addBinding(p, 'nebulaScale', { min: 0.002, max: 0.05, label: 'Escala' });
  nebula.addBinding(p, 'nebulaColorA', { label: 'Color A' });
  nebula.addBinding(p, 'nebulaColorB', { label: 'Color B' });
  nebula.addBinding(p, 'nebulaColorC', { label: 'Color C' });

  const hole = pane.addFolder({ title: 'Agujero negro' });
  hole.addBinding(p, 'lensEnabled', { label: 'Lente' });
  hole.addBinding(p, 'einsteinScale', { min: 0, max: 5, label: 'Radio de Einstein' });
  hole.addBinding(p, 'diskIntensity', { min: 0, max: 15, label: 'Disco' });
  hole.addBinding(p, 'blackHoleX', { min: -160, max: 160, label: 'Posición X' });
  hole.addBinding(p, 'blackHoleY', { min: -90, max: 90, label: 'Posición Y' });
  hole.addBinding(p, 'blackHoleRadius', { min: 2, max: 20, label: 'Tamaño' });

  const sim = pane.addFolder({ title: 'Simulación' });
  sim.addBinding(lab, 'paused', { label: 'Pausar' });
  sim.addBinding(lab, 'quality', { label: 'Calidad', options: { Baja: 'low', Media: 'medium', Alta: 'high' } })
    .on('change', (ev) => view.setQuality(ev.value));
  sim.addButton({ title: 'Copiar parámetros' }).on('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(p, null, 2));
  });

  pane.on('change', () => view.applyParams());

  const stats = new Stats({ trackGPU: true, horizontal: true });
  document.body.appendChild(stats.dom);
  void stats.init(view.renderer);

  window.__GAME__ = { diagnostics: view.diagnostics, world };
  window.__LAB__ = { params: p, apply: () => view.applyParams() };

  const input = new InputController(canvas, (sx, sy, out) => { view.screenToWorld(sx, sy, out); });
  const stepper = new FixedStepper();
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    const steps = lab.paused ? 0 : stepper.advance(elapsed);
    const intent = input.poll(world.star.x, world.star.y);
    for (let i = 0; i < steps; i++) step(world, intent);
    view.update(world, lab.paused ? 1 : stepper.alpha, now / 1000);
    view.render();
    stats.update();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
```

En `src/renderer/globals.d.ts`, sumar el import y la propiedad:

```ts
import type { ViewParams } from '../render/params';
```

```ts
    __LAB__?: { params: ViewParams; apply(): void };
```

Notas:
- Si la API de `stats-gl@4.2.3` difiere (`init` y `update`), revisar su README en `node_modules/stats-gl/README.md` y ajustar sólo esas dos llamadas.
- La supernova del laboratorio que menciona el diseño queda **fuera** del hito 0, porque es una mecánica opcional (sección 5.10). Se suma cuando exista.

- [ ] **Paso 4: Correr**

```bash
npm run typecheck
npx playwright test --project=web
```

Esperado: las 7 pruebas web pasan. `artifacts/e2e/laboratorio.png` muestra el panel "Laboratorio visual" a la derecha, el medidor de stats-gl y el agujero negro en el centro.

- [ ] **Paso 5: Commit**

```bash
git add src/renderer/lab.html src/renderer/lab.ts src/renderer/globals.d.ts src/dev/visual-lab tests/e2e/lab.spec.ts
git commit -m "Agregar el laboratorio visual con paneles de ajuste en vivo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 10: Banco de estrés

**Archivos:**
- Crear: `src/renderer/bench.html`, `src/renderer/bench.ts`, `src/dev/benchmarks/main.ts`, `src/dev/benchmarks/result.ts`
- Modificar: `src/renderer/globals.d.ts` (agregar `__BENCH_RESULT__`)
- Pruebas: `tests/e2e/bench.spec.ts`

**Interfaces:**
- Consume: `createSpaceView`, `FrameTimeRecorder`, `FixedStepper`, `step`, `createWorld`, `DEFAULT_CONFIG` y `QualityLevel`.
- Produce:
  - `BenchResult = { seconds, frames, avgMs, p95Ms, p99Ms, fps, asteroids, bodies, quality, calls, triangles, gpu }`.
  - La página `/bench.html?seconds=10&quality=high`.

- [ ] **Paso 1: Escribir la prueba que falla**

```ts
// tests/e2e/bench.spec.ts
import { expect, test } from '@playwright/test';

test('banco de estrés: 2.000 asteroides y 300 cuerpos', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const quality = process.env['BENCH_QUALITY'] ?? 'high';
  await page.goto(`/bench.html?seconds=10&quality=${quality}`);
  const handle = await page.waitForFunction(() => window.__BENCH_RESULT__, undefined, { timeout: 120_000 });
  const result = (await handle.jsonValue())!;
  await testInfo.attach('resultado', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  console.log(`RESULTADO DEL BANCO ${JSON.stringify(result)}`);
  expect(errors).toEqual([]);
  expect(result.asteroids).toBe(2000);
  expect(result.bodies).toBe(300);
  expect(result.frames).toBeGreaterThan(100);
  if (process.env['BENCH_STRICT'] === '1') {
    expect(result.avgMs).toBeLessThanOrEqual(16.9);
    expect(result.p99Ms).toBeLessThanOrEqual(20);
  }
});
```

- [ ] **Paso 2: Correr y ver que falle**

Correr: `npx playwright test --project=bench`
Esperado: FAIL por tiempo vencido: no existe `/bench.html` ni `__BENCH_RESULT__`.

- [ ] **Paso 3: Implementar**

```ts
// src/dev/benchmarks/result.ts
export interface BenchResult {
  seconds: number;
  frames: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  fps: number;
  asteroids: number;
  bodies: number;
  quality: string;
  calls: number;
  triangles: number;
  gpu: string;
}
```

```html
<!-- src/renderer/bench.html -->
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Banco de estrés — Enjambre gravitatorio</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="./bench.ts"></script>
  </body>
</html>
```

```ts
// src/renderer/bench.ts
import '../dev/benchmarks/main';
```

```ts
// src/dev/benchmarks/main.ts
import { FrameTimeRecorder } from '../../perf/frameTimes';
import { showFatal } from '../../render/context';
import type { QualityLevel } from '../../render/quality';
import { createSpaceView } from '../../render/spaceView';
import { DEFAULT_CONFIG } from '../../sim/config';
import { FixedStepper } from '../../sim/loop';
import { type Intent, step } from '../../sim/step';
import { createWorld } from '../../sim/world';

const query = new URLSearchParams(location.search);
const seconds = Math.max(1, Number(query.get('seconds') ?? '10'));
const q = query.get('quality');
const quality: QualityLevel = q === 'low' || q === 'medium' ? q : 'high';
const WARMUP = 2;

const config = { ...DEFAULT_CONFIG, asteroidCount: 2000, planetCount: 300, orbitCapacity: 600 };
const world = createWorld(config, 424242);
const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = createSpaceView(canvas, { world, quality });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const rec = new FrameTimeRecorder(Math.ceil(seconds * 240));
  const stepper = new FixedStepper();
  const intent: Intent = { targetX: 0, targetY: 0, hasTarget: true };
  window.__GAME__ = { diagnostics: view.diagnostics, world };
  const gl = view.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'desconocida';
  let start = -1;
  let last = performance.now();
  const frame = (now: number): void => {
    if (start < 0) start = now;
    const t = (now - start) / 1000;
    const elapsed = (now - last) / 1000;
    last = now;
    // Recorrido fijo, el mismo en cada corrida.
    intent.targetX = config.arenaHalfWidth * 0.6 * Math.sin(t * 0.4);
    intent.targetY = config.arenaHalfHeight * 0.6 * Math.sin(t * 0.53);
    const steps = stepper.advance(elapsed);
    for (let i = 0; i < steps; i++) step(world, intent);
    view.update(world, stepper.alpha, now / 1000);
    view.render();
    if (t > WARMUP) rec.push(elapsed * 1000);
    if (t >= WARMUP + seconds) {
      const avg = rec.average();
      window.__BENCH_RESULT__ = {
        seconds, frames: rec.count, avgMs: avg, p95Ms: rec.percentile(95), p99Ms: rec.percentile(99),
        fps: avg > 0 ? 1000 / avg : 0, asteroids: config.asteroidCount, bodies: config.planetCount, quality,
        calls: view.diagnostics.calls, triangles: view.diagnostics.triangles, gpu,
      };
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
```

En `src/renderer/globals.d.ts`, sumar el import y la propiedad:

```ts
import type { BenchResult } from '../dev/benchmarks/result';
```

```ts
    __BENCH_RESULT__?: BenchResult;
```

- [ ] **Paso 4: Correr el banco en la máquina**

```bash
npm run typecheck
npm run bench
```

Esperado: PASS, y en la salida aparece una línea `RESULTADO DEL BANCO {...}`. Anotar `avgMs`, `p99Ms`, `fps`, `calls`, `triangles` y `gpu`. El veredicto contra la meta (promedio ≤ 16,9 ms y p99 ≤ 20 ms) se da en la Tarea 11.

- [ ] **Paso 5: Commit**

```bash
git add src/renderer/bench.html src/renderer/bench.ts src/renderer/globals.d.ts src/dev/benchmarks tests/e2e/bench.spec.ts
git commit -m "Agregar el banco de estrés de 2.000 asteroides y 300 cuerpos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 11: Pasada de arte, mediciones y revisión de Lucas

Es el cierre del hito. No suma funciones: ajusta valores y deja evidencia.

**Archivos:**
- Crear: `tests/e2e/shots.spec.ts`
- Modificar: `src/render/params.ts` (sólo los valores de `DEFAULT_PARAMS`, con lo ajustado en el laboratorio) y, si el profiler lo pide, `src/render/quality.ts`

**Interfaces:**
- Consume: `window.__GAME__`, `window.__LAB__` y `window.__BENCH_RESULT__`.

- [ ] **Paso 1: Escribir el juego de capturas**

```ts
// tests/e2e/shots.spec.ts
import { test } from '@playwright/test';

const dir = 'artifacts/hito-0';

test('capturas para el puntaje visual', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 120, undefined, { timeout: 60_000 });
  await page.screenshot({ path: `${dir}/1-inicio.png` });

  for (let k = 0; k < 160; k++) {
    const a = k * 0.12;
    await page.mouse.move(960 + Math.cos(a) * 520, 540 + Math.sin(a) * 300);
    await page.waitForTimeout(50);
  }
  await page.screenshot({ path: `${dir}/2-sistema-creciendo.png` });

  await page.goto('/lab.html');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 120, undefined, { timeout: 60_000 });
  await page.evaluate(() => {
    const p = window.__LAB__!.params;
    p.blackHoleX = 20; p.blackHoleY = 10; p.blackHoleRadius = 12;
    window.__LAB__!.apply();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/3-agujero-negro-cerca.png` });
});
```

- [ ] **Paso 2: Sacar las capturas**

Correr: `npm run shots`
Esperado: tres PNG en `artifacts/hito-0/`.

- [ ] **Paso 3: Puntuar con la skill**

Invocar la skill `threejs-aaa-graphics-builder` y leer `references/visual-scorecard.md`. Mirar las imágenes de referencia de `assets/scorecard-anchors/` y puntuar las tres capturas. Las equivalencias con nuestro juego son las de la sección 7 del diseño:
- "Héroe" es la estrella con su sistema.
- "Obstáculos" son los planetas grandes y el agujero negro.
- "Interactuables" son los asteroides capturables.
- "Mundo" es la nebulosa con las estrellas de fondo.

"UI/HUD" se puntúa "0 (no existe en el hito 0, justificado)" y queda fuera del promedio. Cada categoría lleva su número y una línea de evidencia.

- [ ] **Paso 4: Iterar hasta "premium"**

Para cada categoría por debajo de 2:
1. Abrir el laboratorio (`npm run dev:web` y entrar a `http://localhost:5174/lab.html`).
2. Ajustar los parámetros.
3. Usar "Copiar parámetros" y pasar los valores a `DEFAULT_PARAMS`.
4. Volver a correr `npm run shots`.

Si un problema no se arregla con parámetros (por ejemplo, la nebulosa se ve como ruido uniforme), corregir el shader de esa capa. En cada vuelta se vuelven a correr `npm test` y `npm run test:e2e`.

Criterio de salida: todas las categorías ≥ 2, promedio ≥ 2,3 y ninguna falla automática de la skill.

- [ ] **Paso 5: Medir el rendimiento**

Correr: `npm run bench`; después `BENCH_QUALITY=medium npm run bench` y `BENCH_QUALITY=low npm run bench` (en PowerShell: `$env:BENCH_QUALITY='medium'; npm run bench`).

Comparar contra la meta: en `high`, promedio ≤ 16,9 ms y p99 ≤ 20 ms. Si no se cumple:
1. Invocar la skill `threejs-debug-profiler`.
2. Clasificar el cuello de botella (CPU, GPU de fragmentos, etc.).
3. Cambiar **una** cosa y medir de nuevo.
4. Optimizar en este orden: DPR → resolución de la nebulosa → octavas → segmentos de planetas → cantidad de estrellas.

Anotar las tres corridas finales (avgMs, p99Ms, calls, triangles, gpu).

- [ ] **Paso 6: Revisión de Lucas**

1. Correr `npm run dev`, que abre la ventana de Electron.
2. Pedirle a Lucas que juegue 2 minutos moviendo la estrella y que abra el laboratorio (`npm run dev:web` y entrar a `/lab.html`).
3. Preguntarle si es lo que busca. Si no, anotar exactamente qué le falta y volver al paso 4.

- [ ] **Paso 7: Registrar y cerrar**

- En Notion, en la bitácora:
  - agregar la tabla del puntaje antes y después de la pasada;
  - agregar las mediciones del banco;
  - anotar la respuesta de Lucas;
  - anotar lo pendiente para el hito 1: el salto visual al reaparecer por el borde, el "hola Steam" y la honda.
- Marcar las tareas 1 a 11 como "Hecha".

```bash
git add src/render/params.ts src/render/quality.ts tests/e2e/shots.spec.ts
git commit -m "Ajustar la dirección de arte del hito 0 y dejar las capturas de puntaje

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Criterio de "hito 0 listo"** (de la sección 10 del diseño):
1. Lucas dice "eso es lo que busco".
2. El scorecard llega a nivel premium.
3. El banco da 60 FPS en `high`, o en `medium` con una justificación anotada.
