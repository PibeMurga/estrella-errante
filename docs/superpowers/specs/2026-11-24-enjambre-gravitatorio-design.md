# Enjambre gravitatorio — Documento de diseño

- **Fecha:** 24/11/2026
- **Estado:** aprobado por partes en el brainstorming; falta la revisión del documento completo
- **Nombre:** "Enjambre gravitatorio" es provisorio. El definitivo se elige en el hito 3.
- **Bitácora:** Notion, espacio "Estudio Game", página "Juego propio — Bitácora del proyecto".

---

## 1. Objetivo y restricciones

**Qué buscamos:** un juego propio y original, adictivo y muy atractivo visualmente, para vender barato en Steam (y después en Epic). No tiene relación con MiSplash ni con Lideco.

**Bases de Lucas para crear:**
- Adictivo y atractivo desde lo visual.
- Nombre simple, que se entienda y que atrape.
- Nada de puzzles.

**Restricciones:**
- Equipo: Lucas y Claude, sin presupuesto de arte ni de música.
- Gráficos hechos con código (shaders, partículas, luz, geometría), sin arte dibujado a mano.
- Tecnología web empaquetada como programa de escritorio, para que Claude pueda probarlo.
- Plazo: unos 6 meses hasta la venta.

**Criterios de éxito:**
1. Un GIF de 5 segundos tiene que bastar para llamar la atención en Steam.
2. Los jugadores repiten partidas ("una más").
3. El juego se distingue de la competencia directa (ver sección 2).
4. Corre a 60 cuadros por segundo en Steam Deck.

## 2. Mercado y diferenciación

La fantasía "crecer hasta ser un agujero negro" vende, pero está concurrida:

| Juego | Qué es | Situación |
|---|---|---|
| A Game About Feeding A Black Hole (dic. 2025) | Incremental / idle | Muy positivas; 100.000 copias en menos de un mes, según el desarrollador |
| Drifter Star: Evolution (dic. 2025, USD 3,99) | Roguelike: de asteroide a agujero negro | Mayormente positivas (~1.000 reseñas). Era casi igual a nuestra idea original |
| Become Blackhole (2026) | Incremental: de polvo a agujero negro | Lanzamiento previsto para noviembre de 2026 |
| Solar 2 (2011) | Clásico de asteroide a agujero negro con física | Ya es viejo |
| Orbital (2026) | Arcade retro: un planeta contra un agujero negro | No construís un sistema ni crecés; no es cinemático |

**En qué nos diferenciamos:**
- **Fantasía al revés:** el agujero negro no es tu destino, es tu enemigo.
- **Las órbitas como mecánica de acción:** lo que capturás te orbita y es tu arma y tu escudo.
- **Estilo visual cinemático.**

**Gancho:** *"No te convertís en agujero negro: lo enfrentás."*

**Frase de venta:** *"Un agujero negro devora la galaxia. Sos una estrella errante: armá tu sistema, lanzá tus mundos y enfrentalo."*

## 3. Pilares

Todo lo que se agregue al juego tiene que servir al menos a uno de estos pilares:

1. **Hermoso de mirar:** estilo cinemático, luz real, curvas orbitales y lente gravitatoria.
2. **Habilidad física:** tu sistema es tu arma; lanzar, apuntar y alinear se dominan con práctica.
3. **Crecer sin parar:** arrancás con dos piedras y terminás con un sistema que llena la pantalla.
4. **"Una más":** partidas de unos 15 minutos y cada una distinta.

Enganches que buscamos, todos a la vez: partidas cortas, crecimiento, habilidad y un costado contemplativo.

## 4. Bucle de una partida (~15 minutos)

| Momento | Qué pasa |
|---|---|
| 0–3 min | Sos una estrella chica. Capturás asteroides, que quedan en órbita, y esquivás cuerpos grandes. |
| 3–10 min | Capturás lunas y planetas, cada uno con su función. Al subir de etapa elegís 1 entre 3 mejoras. Aparecen cazadores y planetas huérfanos para rescatar. |
| Toda la partida | El agujero negro avanza desde un borde, curva la luz y achica el mapa. |
| 10–15 min | Jefe final: el agujero negro. Lo enfrentás con honda, alineaciones y, si hace falta, la supernova. |
| Al terminar | Ganes o pierdas, cobrás polvo estelar y desbloqueás variedad. |

- **Victoria:** derrotar al agujero negro del sistema.
- **Derrota:** cada golpe te cuesta mundos. Si no te queda ninguno en órbita y recibís otro golpe, tu estrella se apaga.
- **Capturar no es destruir:** lo que atrapás pasa a formar parte de tu sistema. Sólo se destruye a los enemigos.

## 5. Sistemas del juego

1. **Gravedad y captura.**
   - Tenés un radio de captura que crece con tu masa.
   - Se captura lo que entra al radio y es más chico que tu límite.
   - Lo que es más grande que vos te daña al chocarte.
2. **Órbitas en anillos.**
   - Cada anillo tiene una cantidad limitada de lugares; las etapas desbloquean anillos nuevos.
   - Los anillos internos son rápidos y protegen; los externos son lentos y pegan fuerte.
   - Podés reordenar los mundos entre anillos.
3. **Honda gravitatoria** (click o gatillo).
   - Lanza el mundo mejor alineado hacia la mira, con una velocidad que depende de su órbita.
   - El daño depende del tipo y la masa del mundo.
   - Después de golpear intenta volver. Si se aleja demasiado o lo atrapa otra gravedad, se pierde.
4. **Alineaciones.**
   - Si dos o más mundos quedan en línea con tu estrella, se forma un eclipse y sale un rayo de luz en esa dirección.
   - Con más mundos alineados, el rayo es más fuerte.
   - Se provocan a propósito controlando la velocidad de los anillos.
5. **Tipos de materia** (~10 en la versión 1.0).
   - Ejemplos: hielo congela, gas atrae, hierro escuda, fuego quema en área, cristal multiplica los rayos.
   - Cambian el aspecto de tu sistema y definen qué mejoras te tocan.
6. **Mejoras.**
   - Se elige 1 entre 3 al subir de etapa.
   - Las opciones salen según la materia dominante de tu sistema.
   - Hay sinergias entre dos tipos; por ejemplo, hielo con cristal da rayos que congelan.
7. **Etapas de la estrella.**
   - Enana roja → amarilla → blanca → gigante azul → supergigante.
   - Cada etapa suma un anillo y más radio de captura.
8. **Enemigos.**
   - **Cuerpos errantes grandes:** obstáculos.
   - **Cazadores:** cometas que roban mundos y enjambres rivales.
   - **Agujero negro:** presente toda la partida; al final pelea como jefe con fases.
9. **Rescate** (opcional según el plazo).
   - Los planetas huérfanos que huyen del agujero negro valen doble polvo estelar y traen una mejora rara.
   - Para rescatarlos hay que entrar en la zona de peligro.
10. **Supernova** (opcional según el plazo).
    - Se carga jugando. Borra la pantalla y daña muchísimo al jefe.
    - Costo: perdés casi todos tus mundos y volvés a enana roja.

**Controles:** el cuerpo sigue al cursor y el click lanza. Todo se puede jugar con joystick, pensando en Steam Deck.

## 6. Contenido y progresión

**Sistemas estelares:**
1. **Nebulosa de origen:** tutorial integrado. El jefe es el agujero negro joven.
2. **Cinturón de hierro:** muchos cuerpos errantes y enjambres rivales. El jefe es un agujero negro con disco de acreción que dispara escombros.
3. **El Núcleo:** todo junto y el mapa se achica rápido. El jefe es el agujero negro supermasivo, con tres fases.

Ganar un sistema desbloquea el siguiente. Cada sistema tiene niveles de dificultad **Ascensión 1–10**.

**Contenido de la versión 1.0:**
- ~10 tipos de materia.
- ~50 mejoras, de las cuales ~15 son sinergias.
- ~8 tipos de enemigo y 3 jefes.
- 4 estrellas iniciales; por ejemplo, una enana roja de gravedad fuerte o una estrella binaria con dos centros.

**Progreso entre partidas:** con el polvo estelar se desbloquean materias, mejoras, estrellas y sistemas. También hay un **Atlas estelar** coleccionable. **No hay poder permanente.**

**Demo para el Next Fest:** el sistema 1 completo, con 4 materias y ~15 mejoras. Termina con el texto "esto recién empieza".

**Precio:** USD 5,99, con 10–20 % de descuento la semana de salida.

## 7. Dirección de arte: Cinemático

Se eligió entre Neón, Cosmos pastel, Cinemático y Geométrico plano mirando bocetos animados.

- **Fondo y estrellas:** negro profundo, nebulosas sutiles y estrellas de fondo con distintos brillos.
- **Planetas:** esferas con luz que viene de tu estrella, con lado de día y lado de noche, y atmósfera en el borde iluminado.
- **Tu estrella:** resplandor en varias capas (bloom) y un leve destello óptico.
- **Asteroides:** rocas irregulares iluminadas de un costado.
- **Agujero negro:** distorsión por lente gravitatoria, que curva la luz del fondo, y disco de acreción.
- **Riesgo principal:** es el estilo más difícil de pulir. Se valida primero, en el hito 0.

## 8. Arquitectura técnica

**Stack:** TypeScript, Three.js (WebGL2), Vite y Electron, con electron-builder para el instalador.

**Principio clave:** la **simulación** está separada del **dibujo**.
- La simulación es TypeScript puro, sin dependencias, determinista dada una semilla, y avanza a paso fijo de 60 por segundo.
- El dibujo sólo lee el estado de la simulación e interpola entre pasos.

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `sim/` | Física orbital, captura, honda, alineaciones, daño, enemigos y etapas. Emite eventos. | Nada |
| `content/` | Datos de materias, mejoras, enemigos, sistemas y estrellas | Nada |
| `render/` | Shaders de planetas, estrella, nebulosa y lente; asteroides instanciados; bloom; calidad ajustable | Three.js, `sim/` (sólo lectura) |
| `input/` | Mouse y joystick convertidos en intenciones (mover, lanzar, supernova) | Nada |
| `audio/` | Sonido y música que reaccionan a los eventos | Eventos de `sim/` |
| `meta/` | Polvo estelar, desbloqueos, Atlas y guardado | `content/` |
| `ui/` | Menús, elección de mejoras y pantalla final, en HTML/CSS sobre el canvas | `meta/`, `sim/` |
| `platform/` | Electron y Steam (logros, nube). Si Steam no está, el juego corre igual. | Electron, librería de Steamworks |

**Flujo de datos:**
1. `input` produce intenciones.
2. `sim.step()` avanza el estado y emite eventos.
3. `render` dibuja el estado.
4. `audio` y `ui` reaccionan a los eventos.

**Rendimiento mínimo:**
- 60 cuadros por segundo en Steam Deck y en gráficos integrados.
- Hasta ~2.000 asteroides y ~300 cuerpos activos.
- Calidad ajustable (baja, media y alta), que también baja sola si la placa no da.

**Robustez:**
- El guardado es atómico (archivo temporal y después reemplazo) y deja una copia de respaldo.
- Si la carga falla, se usa el respaldo.
- Si Steam no está disponible, el juego sigue funcionando sin sus funciones.

## 9. Pruebas

- **Simulación (Vitest):**
  - Las órbitas son estables.
  - La captura respeta los límites.
  - La honda vuelve o se pierde según corresponda.
  - Las alineaciones se detectan bien.
  - La misma semilla da la misma partida.
- **Contenido:** una prueba revisa que los datos estén completos y que no haya sinergias rotas.
- **Partidas automáticas:** un bot juega cientos de partidas a máxima velocidad para detectar cuelgues, partidas imposibles y desbalances.
- **Visual y rendimiento (Playwright):** capturas y medición de cuadros por segundo; se compara contra la versión anterior.
- **Diversión:** la prueba Lucas en cada hito.

## 10. Plan en hitos (~6 meses)

| Hito | Semanas | Entregable | Criterio de "listo" |
|---|---|---|---|
| 0 · Prueba visual | 1–2 | Escena cinemática: estrella, planetas con luz y atmósfera, nebulosa, lente y órbitas básicas | Lucas: "eso es lo que busco" |
| 1 · Juguete divertido | 3–6 | Captura, anillos, honda, alineaciones y 1 enemigo | Divierte 5 minutos sin contenido |
| 2 · Partida completa | 7–12 | Sistema 1, etapas, ~15 mejoras, jefe, polvo estelar y guardado | Partida de 15 minutos de principio a fin |
| 3 · Demo y vidriera | 13–16 | Pulido, nombre definitivo, página de Steam, GIFs y tráiler, demo | Demo lista para el Next Fest |
| 4 · Versión 1.0 | 17–24 | Sistemas 2 y 3, jefes, ~50 mejoras, logros, nube y opciones | A la venta |

**Next Fest:** hay que confirmar las fechas oficiales. En general hay uno en febrero y otro en junio. Con la demo en la semana 16 llegamos al de junio de 2027, y en ese caso la salida se corre a junio o julio de 2027.

## 11. Riesgos

| Riesgo | Cómo lo cubrimos |
|---|---|
| Lo cinemático no llega a la calidad buscada | El hito 0 va primero; si falla, lo sabemos en 2 semanas |
| La honda no divierte | Se ajusta en el hito 1, antes de sumar contenido |
| El alcance se desborda | Rescate y supernova son opcionales |
| Música sin presupuesto | Sonido generado por código más música con licencia libre de regalías; se decide en el hito 2 |
| Nombre repetido o con marca registrada | Se verifica en Steam y en registros de marcas en el hito 3 |

## 12. Fuera de alcance (versión 1.0)

- Multijugador.
- Versiones para celular y consolas.
- Editor de niveles.
- Tabla de puntajes en línea. Se puede sumar después si la demo lo pide.
