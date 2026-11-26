# Hito 0 — Ajuste: cámara inclinada de 35° y render del prototipo 3D

> **Para agentes:** este documento **reemplaza** partes del plan `2026-11-24-hito-0-prueba-visual.md`. Las Tareas 0 a 4, 9, 10 y 11 siguen como están, salvo lo que se indica abajo. Las Tareas 5, 6, 7 y 8 se ejecutan según esta versión. La metodología es la misma: TDD, commits por tarea y registro en el archivo de avance.

**Motivo:** Lucas aprobó el 25/11/2026 un prototipo 3D (`docs/diseno/prototipo-3d/`) con cámara en perspectiva inclinada a 35°, un sol realista y planetas en alta definición, sin halos ni líneas de órbita. El plan original suponía cámara ortográfica cenital.

**Diseño:** sección 7 del documento de diseño, en el bloque "Cámara y realismo".

## Decisiones de este ajuste

1. **Mapeo de coordenadas:** la simulación sigue en 2D, `(x, y)`. En Three.js el plano de juego es XZ, con y = 0. La conversión es `mundo3D = (sim.x, 0, -sim.y)`, así que el `+y` de la simulación queda "hacia el fondo" de la pantalla.
2. **La cámara sigue a la estrella:** se mueve con suavidad, a 35° de inclinación y a distancia fija. La arena (±160 × ±90) es más grande que lo que se ve; lo que queda fuera de pantalla, como el agujero negro, se indica en la interfaz más adelante.
3. **La matemática de cámara es pura y se prueba:** `src/render/cameraRig.ts` no importa `three`. Calcula la posición, la base y el rayo del mouse sobre el plano. El render copia esos valores a una `PerspectiveCamera`.
4. **Fondo:** la nebulosa pasa a una esfera de cielo y las estrellas de fondo a una esfera de puntos. Ambas siguen a la cámara para que no haya paralaje raro.
5. **Shaders:** se portan del prototipo (`docs/diseno/prototipo-3d/main.js`), que ya fue validado a ojo por Lucas:
   - `NOISE` (simplex, fbm, ridged y Worley);
   - el sol (`sunMat`) y su halo de cromosfera, protuberancias y corona (`halo`);
   - los planetas (`planetFrag`, tipos 0 a 4) y las nubes (`cloudFrag`);
   - el disco del agujero negro (`diskMat`) y la lente (`lensMat`).
6. **Tipos de planeta:** `KIND_ROCKY` se reparte en rocoso (tipo 0), oceánico (tipo 1) y lava (tipo 4) según `índice % 3`; `KIND_ICE` es el tipo 2 y `KIND_GAS` el tipo 3. Va un `InstancedMesh` por tipo y otro para las nubes de los oceánicos.
7. **Sin halos ni líneas:** no se dibujan atmósferas como borde ni órbitas. El anillo de captura de la estrella también se quita (era una línea); su información vuelve en fósforo en el hito 1.
8. **Calidad:** el preset `low` baja las octavas de los planetas (define `PLANET_OCTAVES`) y la cantidad de estrellas de fondo.

## Tarea 5 (reemplazada): controles y rig de cámara

**Archivos:**
- Crear: `src/input/gamepad.ts`, `src/input/controller.ts` (igual que el plan original), `src/render/cameraRig.ts`
- Pruebas: `tests/unit/input.test.ts` (igual que el original) y `tests/unit/cameraRig.test.ts`
- **No se crea** `src/render/camera.ts` (`fitView` y `screenToWorld` quedan reemplazados).

**Interfaces que produce:**

```ts
// src/render/cameraRig.ts
export interface CameraRigOptions { tiltDeg: number; distance: number; fovDeg: number; follow: number /* 0..1 por segundo */ }
export const DEFAULT_RIG: CameraRigOptions; // { tiltDeg: 35, distance: 150, fovDeg: 36, follow: 4 }
export class CameraRig {
  // Punto que mira la cámara, en coordenadas de la simulación.
  readonly focus: { x: number; y: number };
  // Posición y base de la cámara en el mundo 3D (y arriba; plano de juego en y = 0).
  readonly position: { x: number; y: number; z: number };
  readonly forward: { x: number; y: number; z: number };
  readonly right: { x: number; y: number; z: number };
  readonly up: { x: number; y: number; z: number };
  aspect: number;
  constructor(opts?: Partial<CameraRigOptions>);
  setOptions(opts: Partial<CameraRigOptions>): void;
  snap(x: number, y: number): void;                       // salta al punto sin suavizado
  update(targetX: number, targetY: number, dt: number): void; // sigue con suavizado exponencial
  // Rayo desde la pantalla (NDC -1..1) al plano y = 0, devuelto en coordenadas de la simulación.
  // Devuelve false si el rayo no corta el plano (horizonte).
  screenToSim(ndcX: number, ndcY: number, out: { x: number; y: number }): boolean;
}
export function toWorld(simX: number, simY: number, out: { x: number; y: number; z: number }): typeof out; // (x, 0, -y)
```

**Pruebas (escribir primero, verlas fallar y después implementar):**
- `toWorld(3, 4)` da `(3, 0, -4)`.
- Después de `snap(10, 20)`, el centro de la pantalla (`screenToSim(0, 0)`) cae en `(10, 20)` con precisión de 1e-6.
- Con `tiltDeg` 35 y `distance` 150, `position.y` es `150·sin 35°` y la distancia de la cámara al foco es 150.
- Un punto arriba en pantalla (`ndcY = 0.5`) cae más lejos (`y` mayor que el foco) y uno abajo cae más cerca. Un punto a la derecha da `x` mayor.
- Con aspecto 2, `screenToSim(1, 0)` da más `x` que con aspecto 1.
- `update` con `dt` enorme no se pasa del objetivo, con `dt = 0` no se mueve y con `dt` NaN no produce NaN.
- Un rayo por encima del horizonte (por ejemplo `ndcY = 1` con `tiltDeg = 5`) devuelve `false` y no modifica `out`.

**Implementación:** la cámara está en `foco3D + distance·(0, sin e, cos e)` y mira al foco. La base sale de `forward = normalizar(foco - posición)`, `right = normalizar(forward × (0,1,0))` y `up = right × forward`. El rayo es `dir = forward + ndcX·tan(fov/2)·aspect·right + ndcY·tan(fov/2)·up`. Corta el plano en `t = -pos.y / dir.y` si `dir.y < 0`. El suavizado usa `k = 1 - exp(-follow·dt)`.

**InputController:** no cambia. El `toWorld` que recibe se arma en `game.ts` convirtiendo el píxel a NDC y llamando a `rig.screenToSim`. Si el rayo no corta el plano, se mantiene el objetivo anterior.

**Commit:** "Agregar controles y la cámara inclinada que sigue a la estrella".

## Tarea 6 (reemplazada): pipeline, cielo y el juego andando

Igual que el plan original, con estos cambios:
- **`spaceView.ts`:** usa `PerspectiveCamera(fov, aspect, 0.5, 6000)`. En cada `update` llama a `rig.update(estrella)` y copia la posición y el `lookAt` del rig a la cámara. Expone `rig` para que `game.ts` arme la conversión del mouse. `screenToWorld` pasa a recibir el píxel, convertirlo a NDC y llamar a `rig.screenToSim`.
- **`background/sky.ts`** (en lugar de `nebula.ts`): esfera de cielo con el shader de nebulosa del prototipo, más la esfera de estrellas de fondo (`starCount` del preset). El grupo sigue la posición de la cámara.
- **Se borra** `background/starfield.ts` (lo absorbe `sky.ts`).
- **`FrameContext`:** pierde `view`/`ViewRect` y suma `rig: CameraRig` y `camera: PerspectiveCamera`.
- **`ViewParams`:** se quitan `nebulaColorA/B/C` y `nebulaScale`, y quedan `nebulaIntensity` (multiplica el color final del cielo), `bloomIntensity`, `bloomThreshold`, `vignetteDarkness`, `sunIntensity`, `lightIntensity`, `lensEnabled`, `einsteinScale`, `diskIntensity`, `blackHoleX`, `blackHoleY` y `blackHoleRadius`.
- **Bloom:** `luminanceThreshold 1.0`, `intensity 0.95`, `radius 0.7`. Se suma `SMAAEffect` en una segunda `EffectPass`.
- **Pruebas e2e:** las mismas (arranque sin errores, cambio de tamaño, aviso sin WebGL2). La captura `juego.png` muestra el cielo.

**Commit:** "Agregar el pipeline gráfico en perspectiva con cielo y estrellas".

## Tarea 7 (reemplazada): sol, planetas HD y asteroides

- **`bodies/sun.ts`** (en lugar de `star.ts`): la esfera del sol y la lámina de halo, con los shaders del prototipo. Escala `starRenderRadius(mass)`, ahora `= 4 + 0.5·sqrt(mass)`. La lámina siempre mira a la cámara. La `PointLight` va en la posición del sol (color `0xffc890`, intensidad `lightIntensity`, sin caída).
- **`bodies/planets.ts`:** cinco `InstancedMesh` (uno por tipo) con `planetFrag`, más uno de nubes. El vertex shader del prototipo se adapta a instancing (`modelMatrix * instanceMatrix`, como el `BODY_VERT` del plan original). La semilla de cada instancia va en `instanceColor.r` y se suma a `uSeed`. Cada planeta gira sobre su eje (y) a una velocidad propia.
- **`bodies/asteroids.ts`:** como el plan original, con posiciones en XZ (`toWorld`), un pequeño desvío vertical por instancia (±0,8) y colores grises oscuros como en el prototipo.
- **Prueba e2e nueva:** "al mover el mouse la estrella captura asteroides" (como la original). Además, una prueba que verifica que hay al menos 5 tipos de planeta dibujados, con `diagnostics.planetTypes >= 3` en el mundo por defecto.

**Commit:** "Dibujar el sol y los planetas en alta definición con luz real".

## Tarea 8 (reemplazada): agujero negro y lente

Como el plan original, pero:
- La posición del agujero negro está en coordenadas de la simulación (`blackHoleX`, `blackHoleY`) y se convierte con `toWorld`.
- El disco es el `RingGeometry(13, 44)` del prototipo, horizontal e inclinado 0,18 rad, y el grupo se escala con `blackHoleRadius / 9`.
- Los uniformes de la lente salen de proyectar la posición con la cámara: `uCenter` es el NDC proyectado pasado a UV, y `uEinsteinR` es la distancia en pantalla entre el centro y `centro + right·(radio·einsteinScale)`, convertida a unidades de UV en y.
- Si el agujero negro queda detrás de la cámara o fuera de pantalla, `uEnabled = 0`.

**Commit:** "Agregar el agujero negro con disco y lente en perspectiva".

## Ajustes menores en otras tareas

- **Tarea 9 (laboratorio):** los controles siguen el nuevo `ViewParams`. Se suma un selector de **inclinación** (35°, 50° y 65°) que llama a `rig.setOptions`, porque será un ajuste de Opciones.
- **Tarea 10 (banco):** sin cambios.
- **Tarea 11 (pasada de arte):** el umbral visual se mide contra el prototipo aprobado; el render del juego no puede quedar por debajo de él.

## Foco de revisión agregado

- **Mouse por encima del horizonte:** con la cámara inclinada, un clic muy arriba puede no cortar el plano. El objetivo se mantiene y nunca da NaN. Prueba en `cameraRig.test.ts`.
- **Agujero negro detrás de la cámara:** la lente se apaga en lugar de deformar la pantalla al revés. Se verifica con `diagnostics.lensEnabled` en una prueba e2e del laboratorio, moviendo el agujero negro detrás de la cámara.
