# Arranque como planeta, nombre e ignición: plan de construcción

> **Para quien lo ejecute:** se usa la skill superpowers:executing-plans, en línea y con TDD. Los pasos usan casillas (`- [ ]`).

**Objetivo:** la partida arranca con un planeta gaseoso chico que tiene el nombre que eligió el jugador. Pasa por gigante gaseoso y enana marrón, se enciende con una ignición y sigue la carrera de siempre.

**Arquitectura:**

- Las etapas de planeta van delante de las de estrella, en la misma escala de masa: la ignición es en 30 y las etapas de estrella se corren 30.
- `starSize` usa una curva de planeta antes de 30.
- Un interruptor de configuración (`planetStart`, encendido por defecto) bloquea el disparo, duerme al agujero negro y frena los cometas hasta la ignición. Las pruebas que necesitan una estrella desde el principio lo apagan.
- Una fase nueva (`PHASE_IGNITION`) hace de cinemática.
- Para el dibujo hay una capa del jugador planeta, una luz de escena compartida y un efecto de ignición.
- Para la interfaz, una pantalla del nombre.

**Tecnología:** TypeScript, Three.js, Vitest y Playwright.

**Especificación:** `docs/superpowers/specs/2026-11-27-arranque-planeta-ignicion-design.md`.

## Restricciones globales

- Todo lo visible, en español rioplatense.
- No se crean objetos dentro del bucle del juego.
- Se mide el p99 con el banco antes de afirmar algo sobre el rendimiento.
- Nada que no exista en la astrofísica real.

## Puntos a vigilar

1. **Reiniciar la partida (R o el cartel final)** no vuelve a pedir el nombre: usa el guardado.
2. **Un nombre vacío o de puros espacios** se reemplaza por una sugerencia.
3. **Perder masa siendo planeta** (por un golpe) no hace retroceder una ignición que ya ocurrió.
4. **Apretar el disparo siendo planeta** no deja una carga a medias para después de la ignición.
5. **El agujero negro dormido** no traga nada ni tira de nada.

---

### Tarea 1: etapas, tamaños y unidades

**Archivos:**

- `src/sim/stages.ts`: etapas nuevas, `IGNITION_MASS = 30`, `STAGE_IGNITION = 3` y `STAGE_HYPER = 8`.
- `src/sim/world.ts`: `starSize` con la curva de planeta antes de 30.
- `src/ui/solarMass.ts`: M♃ antes de 30.
- Pruebas: `tests/unit/stages.test.ts`, `tests/unit/solarMass.test.ts` y las que dependan de los umbrales viejos.

**Etapas** (masa del juego):

| Etapa | Masa |
|---|---|
| PLANETA GASEOSO | 0 |
| GIGANTE GASEOSO | 8 |
| ENANA MARRÓN | 18 |
| ENANA ROJA | 30 |
| ENANA AMARILLA | 70 |
| ESTRELLA BLANCA | 120 |
| GIGANTE AZUL | 175 |
| SUPERGIGANTE | 235 |
| HIPERGIGANTE | 310 |

**Tamaño:**

- antes de 30: `planetSize(m) = 1.6 + 0.8·√m`;
- desde 30: `4 + 0.55·√m`.

**Unidades:**

- antes de 30, en masas de Júpiter: de 0,3 M♃ a 80 M♃, en tramos lineales con valores reales;
- después, en masas solares (M☉).

Pasos:

- [ ] Escribir las pruebas: la etapa de 1 es PLANETA GASEOSO y la de 30 es ENANA ROJA; `starSize` crece y es continuo por tramos; `formatSolar(1)` termina en «M♃» y `formatSolar(30)` en «M☉».
- [ ] Verificar que fallan.
- [ ] Implementar.
- [ ] Verificar que pasan, junto con el resto de las pruebas unitarias, y corregir las que dependen de los umbrales viejos.
- [ ] Commit.

### Tarea 2: la etapa de planeta y la ignición en la simulación

**Archivos:**

- `src/sim/config.ts`: `planetStart: true` e `ignitionTime: 4`.
- `src/sim/world.ts`: `ignited` (booleano), `PHASE_IGNITION = 4` e `ignitions` (contador).
- `src/sim/launch.ts`: sin disparo mientras `planetStart && !ignited`; la carga vuelve a 0.
- `src/sim/step.ts`:
  - agujero negro dormido (no se mueve, no atrae, no traga, sin disco ni marea);
  - el reloj de los cometas quieto;
  - al llegar a `IGNITION_MASS` en `PHASE_PLAY`, se pasa a `PHASE_IGNITION`;
  - la cinemática dura 4 s; en 1,2 s, la onda empuja lo suelto que está a menos de 45 unidades;
  - al terminar, `ignited = true`, se vuelve a `PHASE_PLAY` y el reloj del cometa queda en `cometFirst`.
- Pruebas: `tests/unit/ignition.test.ts`. Las pruebas viejas que necesitan una estrella desde el principio usan `planetStart: false`.

Pasos:

- [ ] Escribir las pruebas:
  - siendo planeta no se dispara;
  - el agujero negro queda quieto y no traga;
  - no salen cometas;
  - al cruzar 30 hay ignición una sola vez y, después de 4 s, se desbloquea todo;
  - perder masa después de la ignición no vuelve atrás.
- [ ] Verificar que fallan.
- [ ] Implementar.
- [ ] Verificar que pasan y corregir las pruebas viejas con `planetStart: false`.
- [ ] Commit.

### Tarea 3: el dibujo (planeta, luz e ignición)

**Archivos:**

- `src/render/lighting.ts`: `sceneLight = { level }`. Las capas que iluminan (planetas, partidos, asteroides, cráteres y lunas) multiplican su luz por este nivel en cada cuadro.
- `src/render/bodies/playerPlanet.ts`: un gaseoso con bandas que fluyen y un borde de atmósfera. Es una brasa roja, cada vez más fuerte, desde la ENANA MARRÓN. Se desvanece en la ignición.
- `src/render/bodies/sun.ts`:
  - siendo planeta, la luz viene de lejos: `sunPos` queda lejos en una dirección fija y el nivel de luz es 0,35;
  - en la ignición, la luz del sol se enciende de 0,35 a 1 en unos 2 s y el sol aparece;
  - antes de la ignición no hay sol.
- `src/render/fx/ignition.ts`: compresión brillante, un destello breve (sin rayos) y una onda irregular.
- `src/render/layers.ts`: conectar las capas nuevas.
- Prueba: `tests/e2e/ignition.spec.ts`, con capturas del planeta, la enana marrón, la ignición y la estrella, y sin errores en la consola.

Pasos:

- [ ] Implementar.
- [ ] Correr la prueba de navegador.
- [ ] Revisar las capturas.
- [ ] Commit.

### Tarea 4: el nombre

**Archivos:**

- `src/ui/nameScreen.ts` y su CSS:
  - pantalla «NOMBRÁ TU MUNDO» con un campo de hasta 16 caracteres, el botón «SUGERIR» y Enter para empezar;
  - con mando, A empieza y X sugiere;
  - guarda en `localStorage` con la clave `magnar.nombre`;
  - si está vacío, usa una sugerencia.
- `src/ui/playerName.ts`: la lista de sugerencias y `setPlayerName`.
- `src/renderer/game.ts`:
  - la simulación no avanza hasta que se elige el nombre;
  - al reiniciar con `?seed`, no vuelve a preguntar (se marca con el parámetro `?n=1`).
- `src/ui/hud.ts`:
  - el nombre en la barra;
  - en el registro, «IGNICIÓN · NACE [NOMBRE]»;
  - el aviso «HONDA · SE ENCIENDE CON LA IGNICIÓN».
- `src/ui/gameOver.ts`: el nombre en el cartel.
- Prueba: `tests/e2e/name.spec.ts` (escribir, sugerir, empezar, el nombre en la barra y el reinicio sin pregunta). Las pruebas de navegador existentes pasan `?n=1` o un nombre guardado.

Pasos:

- [ ] Escribir la prueba de navegador.
- [ ] Implementar.
- [ ] Verificar que pasan, junto con las demás pruebas de navegador.
- [ ] Commit.

### Tarea 5: balance, rendimiento y cierre

- [ ] El bot con `planetStart`: la etapa de planeta dura de 60 a 120 s. Si no, ajustar los umbrales de 8, 18 y 30.
- [ ] El banco: el p99 no sube.
- [ ] Actualizar la memoria y Notion.
- [ ] Commit.
