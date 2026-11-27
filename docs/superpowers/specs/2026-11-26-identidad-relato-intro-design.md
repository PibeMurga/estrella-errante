# Identidad, relato e intro — diseño

Fecha: 26/11/2026, decidido con Lucas. Complementa la especificación de la meta (`2026-11-26-meta-colapso-pantallas-design.md`).

## 1. Decisiones de identidad

- **Nombre del juego: MAGNAR**, de *magna* + *star*. Se lee como un nombre propio en español y en inglés. En una búsqueda web no apareció ningún juego con ese nombre. Antes de usarlo en público, Lucas tiene que confirmarlo en Steam, en el INPI (clases 9 y 41), en el dominio y en Instagram.
- **Estudio:** el nombre todavía no está definido; se elige entre **TABLADO** y **PLATILLO**. Hasta que se decida, la intro muestra una firma provisoria (`TABLADO`) que se cambia en un solo lugar.
- **Autor:** Lucas, «Pibe Murga» (`@pibemurga`), aparece en los créditos.
- **Originalidad:** ni el nombre ni la historia ni su lógica pueden parecerse a juegos mainstream.

## 2. El relato

- **La civilización que te observa.** Vive en un planeta de tu sistema y nunca se la ve. Sólo se notan sus luces del lado nocturno y sus transmisiones. Su voz guía el inicio del juego.
- **Éxodo de estrella en estrella.** En cada pantalla se instalan en una estrella joven, que sos vos. Antes del colapso lanzan un arca y siguen viaje. Las 5 pantallas son cinco escalas hacia el centro de la galaxia.
- **El giro final: nunca huían, te usaban.** La civilización cría agujeros negros cada vez más grandes para alimentarse de su energía (el proceso de Penrose, cerca de Sagitario A*). Hay pistas desde el tutorial: la voz nunca miente, sólo omite.
- **Un rival con identidad.** Cada agujero negro tiene una designación de catálogo realista y un nombre que le da la civilización.
- **Cómo hablan.** El texto llega al visor letra por letra, acompañado de una «voz» sin palabras: un sonido vocal sintetizado, extraño y sin idioma. Al principio suena cálida y hacia el final se vuelve más fría.

## 3. Audio

- Las reglas aceptan sonidos CC0 o de dominio público (como los de la NASA), revisados archivo por archivo y con el origen anotado.
- Esta entrega sintetiza todo con Web Audio, sin archivos ni dependencias: el platillo, la estática de radio, la voz y el golpe de graves. Las sonificaciones reales de la NASA se suman más adelante, revisadas una por una.
- La música se decide después. La recomendación es generativa y sintetizada, con graves profundos y algo psicodélica.

## 4. Entrega I1: intro y pantalla de inicio

**Recorrido de la aplicación:** intro → pantalla de inicio → partida. Al terminar la partida, el jugador puede jugar otra o volver al inicio.

**La intro (≈ 25 s la primera vez)**
1. **Firma (0–3 s).** Fondo negro y el nombre del estudio. Suena un golpe de platillo de murga que se estira en una reverberación enorme.
2. **Transmisión (3–13 s).**
   - Estática de radio y una señal que se afina de a poco.
   - Llega el texto letra por letra, con la voz C:
     > *…te encontramos. Sos joven. Sos pequeña.*
     > *Nosotros vamos a cuidarte.*
3. **Nacimiento (13–21 s).**
   - Se abre el espacio y una enana roja se enciende.
   - A lo lejos, la lente de un agujero negro curva apenas el fondo.
4. **Título (21–25 s).** La estrella lanza una llamarada y aparece **MAGNAR**, con un golpe de graves y después silencio.
5. **Pantalla de inicio.** No hay corte: la misma estrella sigue de fondo.

**Reglas de la intro**
- **Versión corta.** Desde la segunda vez se ven sólo la firma y el título, unos 5 s. Que ya se vio se guarda en `localStorage`.
- **Saltear.** Cualquier tecla, clic o botón del mando la saltea y lleva directo al inicio.
- **La escena se dibuja en tiempo real** con las capas que ya existen (cielo, estrella y agujero negro), no con un video. Así se ve nítida en cualquier resolución y no pesa nada.
- **Las letras de MAGNAR se dibujan a mano como trazos SVG propios,** sin depender de fuentes con licencia. Son provisorias hasta que se diseñe el logo.

**Pantalla de inicio (mínima)**
- Opciones: JUGAR y SALIR (SALIR sólo en Electron).
- Usa el estilo de teclas con piloto de la maqueta `docs/diseno/maquetas/pantalla-principal-y-carga.html`, con las fuentes del visor actual, porque las fuentes OFL siguen esperando aprobación.
- La versión completa de la maqueta sigue en revisión.

**Audio y política de reproducción automática**
- En Electron se habilita el audio sin interacción previa (`autoplayPolicy`).
- En la versión web, la intro espera un primer clic («TOCÁ PARA EMPEZAR») antes de arrancar con sonido.

## 5. Arquitectura

- **`src/app/flow.ts`:** el recorrido intro → inicio → partida. Por ahora la partida sigue recargando la página; un reinicio sin recarga queda para después.
- **`src/intro/timeline.ts`:** función pura que devuelve el estado de cada tiempo de la intro según los segundos transcurridos. Se prueba sin el render.
- **`src/intro/intro.ts`:** dibuja la intro y la conecta con la escena.
- **`src/audio/`:**
  - `engine.ts`: contexto, mezcla y reverberación con una respuesta al impulso generada;
  - `sfx.ts`: platillo, estática y golpe de graves;
  - `voice.ts`: la voz C, con formantes que salen de una semilla tomada del texto.
- **`src/ui/startScreen.ts` y su CSS.**
- **Pruebas:**
  - el parámetro `?intro=0` saltea la intro para que las pruebas existentes no cambien;
  - Vitest para el recorrido de la intro, la versión corta y la regla de saltear;
  - Playwright para comprobar que la intro aparece, que se puede saltear y que JUGAR arranca la partida.

## 6. Pendiente para próximas entregas

- **El inicio guiado por la voz:** el tutorial de la pantalla 1, con señales al estilo del visor.
- **Un sistema único de señales.** Partir del inventario actual:
  - las esquinas sólo decoran;
  - el ámbar hoy mezcla el agujero negro con el peligro;
  - el contador de eclipses desaparece.

  Unificarlo con las barras de masa, las marcas y los avisos de la meta.
- **Imagen y presentación:** el logo final del estudio y del juego, el ícono, la portada (desde una captura real compuesta), la pantalla de carga y la cuenta de Instagram del estudio.
- **La música.**
