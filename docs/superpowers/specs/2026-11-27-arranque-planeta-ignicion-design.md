# MAGNAR: arranque como planeta, nombre propio e ignición

Fecha: 27/11/2026. Pedido de Lucas al jugar:

> «podríamos arrancar como un planeta y luego pasar a estrella»
>
> «la sensación de planetas inmensos, terminando luego siendo uno de ellos y luego estrella y luego agujero»
>
> «al iniciar, que cada jugador elija el nombre de su partida, que será el nombre de la entidad que comienza como planeta y sigue su evolución hasta agujero negro»

## 1. Objetivo

Que la partida cuente una evolución completa y real:

**planeta gaseoso chico → gigante gaseoso → enana marrón → ignición → estrellas → hipergigante → colapso → agujero negro**

Dos sensaciones guían el diseño:

- **Escala:** al principio los planetas son inmensos al lado tuyo, y terminás siendo uno de ellos y después devorándolos.
- **Propiedad:** el cuerpo tiene un nombre que eligió el jugador y lo acompaña de principio a fin.

Criterios de éxito:

- La etapa de planeta dura de 1 a 2 minutos y se entiende sin explicación.
- La ignición se siente como un momento grande.
- No hay nada que no exista en la astrofísica real.

## 2. El nombre

**Antes de la partida** aparece una pantalla con el estilo del visor (fósforo verde sobre negro), titulada «NOMBRÁ TU MUNDO»:

- un campo de texto de hasta 16 caracteres, que se pasa a mayúsculas;
- un botón «SUGERIR», que propone un nombre de una lista propia de nombres inventados que suenan bien en español y en inglés (por ejemplo, TÁURIDE, OSSIRAN, VELKOR);
- Enter, o el botón A del mando, para empezar.

**Se guarda** en el equipo (`localStorage`, clave `magnar.nombre`) y la próxima vez aparece ya escrito. Si el campo queda vacío, se usa una sugerencia.

**Dónde aparece:**

- en la barra de la carrera, en lugar de «VOS»;
- en el registro («IGNICIÓN · NACE TÁURIDE»);
- en el cartel final («TÁURIDE SE FUNDIÓ CON EL RIVAL»).

Reiniciar con R o desde el cartel final no vuelve a pedirlo: usa el guardado.

## 3. Etapas

Etapas nuevas antes de la enana roja. La masa sigue siendo una sola escala en la simulación. Los umbrales son masas del juego:

| Etapa | Masa | Unidad en el visor | Qué se ve |
|---|---|---|---|
| PLANETA GASEOSO | 0 | M♃ (masas de Júpiter) | Gaseoso chico con bandas, más chico que casi todos los planetas |
| GIGANTE GASEOSO | 8 | M♃ | Del tamaño de los planetas grandes |
| ENANA MARRÓN | 18 | M♃ | Bandas que se vuelven brasas, con un brillo rojo muy tenue |
| ENANA ROJA (ignición) | 30 | M☉ (masas solares) | Nace tu estrella |

Las etapas de estrella siguen como hoy, corridas en 30:

- enana amarilla en 70;
- **ESTRELLA BLANCA** en 120 (reemplaza a «ENANA BLANCA», que en la realidad es una estrella muerta);
- gigante azul en 175;
- supergigante en 235;
- hipergigante en 310.

La masa inicial sigue siendo 1. La escala del rival (`rivalMassScale`) se revisa con el bot para que la carrera siga pareja.

**Unidades:** en M♃ hasta la ignición, con valores reales (de 0,3 M♃ al arrancar hasta unas 80 M♃, que equivalen a 0,08 M☉, en la ignición). Desde ahí, en M☉, como ahora.

**Tamaño del jugador siendo planeta:**

- una curva propia (`planetSize`), que arranca más chica que los planetas comunes (radio de unos 2, contra planetas de 2,5 a 7) y llega a unos 6 en la enana marrón;
- a partir de la ignición rige `starSize` y la transición es suave, sin saltos.

**Cámara:** arranca más cerca (con un zoom equivalente al 70 %) y se aleja con la masa, como hoy.

## 4. Cómo se juega siendo planeta

Mientras sos planeta (masa menor a 30):

- **Juntás y esquivás.** Juntás asteroides y lunas, que giran a tu alrededor. Los planetas más grandes que vos te dañan con las mismas reglas de escalones, comparando con tu tamaño de planeta.
- **No disparás.** La honda y el bólido están bloqueados. El visor dice «HONDA · SE ENCIENDE CON LA IGNICIÓN».
- **El agujero negro está dormido:** no te persigue, queda lejos y quieto, y su alcance no te toca. Se activa con la ignición.
- **No hay cometas.** El primero sale un minuto después de la ignición.
- **Habilidades:** se cuentan igual que siempre; los planetas que juntes ya cuentan.

## 5. La luz

Siendo planeta no tenés luz propia. Todo lo ilumina una estrella lejana:

- una luz direccional tenue, de un color neutro y un poco frío;
- un punto brillante fijo en el fondo, que se ve a lo lejos.

Los planetas muestran sus lados de día y de noche, pero la escena es más oscura.

La enana marrón suma una luz puntual roja muy débil, de corto alcance.

En la ignición, la luz del sol, la de siempre, se enciende de 0 a su valor en unos 2 s, y la estrella lejana baja a un rastro.

## 6. La ignición

Al llegar a masa 30, una cinemática de unos 4 s. La simulación sigue andando, pero el control queda en pausa. Es una fase `PHASE_IGNITION`, como la del colapso:

1. **0 a 1,2 s:** el centro se comprime y brilla; las bandas se apagan hacia adentro.
2. **1,2 s:** un destello breve, sin rayos ni chispas.
3. **1,2 a 3 s:** una onda que se abre y empuja el polvo y los asteroides sueltos cercanos, y tu luz que se enciende.
4. **3 a 4 s:** aparece la enana roja, con su superficie, su corona y sus erupciones.

El visor dice «IGNICIÓN · NACE [NOMBRE]» y el registro lo anota.

Al terminar:

- se desbloquean los disparos;
- el agujero negro despierta;
- empieza a correr el reloj del primer cometa.

## 7. Arquitectura

**Simulación (`src/sim/`):**

- `stages.ts`: las etapas nuevas y los umbrales corridos. `isPlanetStage(mass)` y `IGNITION_MASS`.
- `world.ts`:
  - `bodySize(mass)`, que es `planetSize` antes de la ignición y `starSize` después, con un empalme suave;
  - todo lo que hoy usa `starSize` para la estrella del jugador pasa a usar `bodySize`.
- `phase.ts`: `PHASE_IGNITION`, con `startIgnition` y `stepIgnition`.
- `step.ts`:
  - bloquea el lanzamiento si sos planeta;
  - agujero negro dormido y sin cometas antes de la ignición;
  - dispara la ignición al cruzar `IGNITION_MASS`.

**Dibujo (`src/render/`):**

- `bodies/playerPlanet.ts`: capa nueva. Un gaseoso con bandas, con el estilo del tipo gaseoso de `planets.ts`, que se calienta hasta brasa en la enana marrón y se desvanece en la ignición.
- `bodies/sun.ts`: aparece desde la ignición, con un factor de encendido.
- `lighting`: la luz lejana más la luz del sol que se enciende. Tiene que entrar en las capas que usan `uSunPos` y `uLight`, sin romper lo existente.
- `fx/ignition.ts`: el destello y la onda.

**Interfaz (`src/ui/`):**

- `nameScreen.ts` y su CSS: la pantalla del nombre, con lista de sugerencias, guardado y teclado o mando.
- `hud.ts`: el nombre, las unidades M♃ y M☉ y el aviso del disparo bloqueado.
- `gameOver.ts`: el nombre en el cartel.

**`renderer/game.ts`:** la partida arranca después de la pantalla del nombre. La simulación no avanza mientras la pantalla está abierta.

## 8. Fuera de alcance

- El mensaje de la civilización que observa (relato).
- La intro, el logo y la música. Están en la especificación de identidad.
- Arrancar como planeta rocoso: no es real, porque la roca no se enciende.

## 9. Pruebas

**Unitarias:**

- etapas y umbrales;
- `bodySize` continuo en la ignición;
- disparo bloqueado siendo planeta;
- agujero dormido y sin cometas antes de la ignición;
- la ignición se dispara una sola vez y lo desbloquea todo;
- conversión a M♃ y M☉.

**De navegador:**

- la pantalla del nombre: escribir, sugerir, guardar y empezar;
- el visor con el nombre y las unidades;
- la ignición: captura en cada paso y sin errores en la consola.

**Bot de balance:**

- la duración de la etapa de planeta (meta: 60 a 120 s);
- la carrera con el rival sigue pareja.

**Rendimiento:** el banco, sin subir el p99.
