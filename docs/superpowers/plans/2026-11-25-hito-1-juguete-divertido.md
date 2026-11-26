# Hito 1 — "Juguete divertido": plan de implementación

> **Contexto:** Lucas aprobó el hito 0 el 25/11/2026 y dejó a Claude trabajando de noche con este pedido: "avanzar con las instrucciones que ya hicimos y finalizar con tu criterio todas las etapas cerrables sin más decisiones". Por eso este plan **no pasó por una revisión de diseño con Lucas**. Sale del documento de diseño aprobado (secciones 4, 5 y 10) y de lo que se habló el 25/11. Cada valor que no estaba definido se eligió con criterio, quedó en `SimConfig` o `ViewParams` para ajustarlo fácil y se anotó en Notion como **"decisión a revisar"**.
>
> **Método:** igual que el hito 0. TDD en la simulación, Playwright en el render, un commit por tarea y registro en `.superpowers/sdd/2026-11-25-hito-1-juguete-divertido/progress.md`.

**Objetivo:** que el juego tenga objetivo, amenaza y habilidad.
- **Objetivo:** crecer por etapas, a la vista en el visor de fósforo.
- **Amenaza:** un agujero negro que avanza y atrae, planetas que dañan y un cometa cazador.
- **Habilidad:** la honda y los eclipses.
- **Cierre:** fin de partida y reinicio.

**Base:** rama `hito-1`, creada desde `main` una vez unido el hito 0.

## Reglas comunes

- La simulación (`src/sim/`) sigue pura y determinista. El azar de la partida sale de un `Rng` guardado en el mundo.
- No se crean objetos por cuadro. Los enemigos y los eventos usan pools y arrays de tamaño fijo.
- La interfaz de partida es el **visor de fósforo**: HTML/CSS sobre el canvas, sin metal, con el estilo de `docs/diseno/maquetas/interfaz-de-partida.html` (opción C).
- Todo valor nuevo va en `SimConfig` o `ViewParams`.

## Tarea 1 · Etapas de la estrella

**Sim:** `STAGES` con umbral de masa y nombre: enana roja 0, enana amarilla 25, enana blanca 80, gigante azul 200 y supergigante 450. `stageFor(mass)` devuelve el índice. Cuando cambia, `step` emite el evento `stageUp` (contador `w.events.stageUp` y `w.stage`).

**Render:** el sol cambia su paleta de forma progresiva (`hot`, `mid` y `cool` por etapa, interpolados con `smoothToward`), de rojo anaranjado a amarillo, después blanco-azulado y azul.

**Pruebas:**
- Umbrales correctos y masa negativa o NaN → etapa 0.
- Al cruzar 25 se emite un `stageUp`.

## Tarea 2 · Agujero negro activo

**Sim:**
- `w.bh = { x, y, vx, vy, radius, mass, active }`.
- Aparece en un borde, del lado opuesto al jugador, y avanza hacia el centro del mapa. Su velocidad empieza en 1,5 y sube 0,02 por segundo, con tope de 6.
- **Gravedad:** `a = bhPull·mass / d²`, limitada y activa hasta 140 unidades. Afecta a los cuerpos libres, a la estrella y a los proyectiles.
- **Traga** los cuerpos libres que tocan `radius·1.2`: pasan a `DEAD` y su masa se suma a la del agujero negro, que crece un poco.
- **Si toca la estrella**, se termina la partida con `w.over = 'tragada'`.

**Render:** el agujero negro toma posición y tamaño de `w.bh`. En el laboratorio, los paneles de posición mueven `w.bh`.

**Pruebas:**
- Avanza hacia el centro.
- Atrae: un cuerpo libre quieto a 60 unidades se acerca.
- Traga: el cuerpo pasa a `DEAD` y el agujero gana masa.
- Tocar la estrella termina la partida.
- Fuera de su radio de influencia no hace nada.
- Determinismo.

## Tarea 3 · Planetas que dañan

**Sim:** si la estrella toca un planeta (`d < starSize + radio`) más grande que ella (`radio > starSize`):
- Se libera hasta 3 mundos de la órbita, que salen despedidos hacia afuera.
- La estrella rebota (empuje).
- Hay 1,5 s de invulnerabilidad.
- Si no tenía mundos en órbita, la partida termina con `w.over = 'apagada'`.

Contra planetas más chicos, nada todavía: capturarlos enteros queda para el hito 2.

**Pruebas:**
- Choque con un planeta grande: pierde mundos y rebota.
- Invulnerabilidad.
- Sin mundos, termina la partida.
- Un planeta más chico no daña.

## Tarea 4 · Honda

**Sim:**
- `Intent` suma `fire` (verdadero en el paso del clic) y la mira, que es el mismo objetivo del mouse.
- Con `fire` y el enfriamiento (0,35 s) cumplido, se elige el mundo en órbita cuyo ángulo está más cerca de la dirección de la mira.
- Pasa a `PROJECTILE`, con velocidad `mira·70 + velocidad de la estrella` y 2,2 s de vida.
- Al vencer pasa a `RETURNING`: vuelve hacia la estrella y, al entrar en `orbitMax`, se reincorpora a la órbita (`ORBITING`).
- Si al volver está a más de 220 unidades, se pierde y pasa a `FREE`.
- Los impactos contra el cometa se resuelven en la Tarea 6.

**Input:** el clic izquierdo y el gatillo derecho del joystick disparan. `InputController` expone `fire` por flanco.

**Pruebas:**
- Elige el mundo más alineado.
- Respeta el enfriamiento.
- El proyectil viaja, después vuelve y se reincorpora.
- Si se aleja demasiado, se pierde.
- Sin mundos, no pasa nada.

## Tarea 5 · Eclipses

**Sim:**
- En cada paso se buscan 3 o más mundos en órbita dentro de una ventana de 7° del mismo ángulo, desde la estrella.
- Si hay, se emite un evento `eclipse` con dirección y fuerza (la cantidad de mundos).
- El rayo dura 0,6 s, mide 150 unidades y tiene 2 s de enfriamiento.
- Daña a los cometas que cruza (Tarea 6).

**Render:** un haz de luz cálida aditivo, con bloom, desde la estrella en esa dirección; se desvanece.

**Pruebas:**
- 3 mundos alineados → eclipse.
- 2 mundos → no.
- Enfriamiento.
- La dirección es correcta.

## Tarea 6 · Cometa cazador

**Sim:**
- Pool de 6 cometas. El primero aparece a los 60 s y después uno cada 40 s, por un borde.
- Persiguen a la estrella a 24 unidades por segundo, con giro limitado.
- Al tocarla le roban un mundo, que queda libre y es arrastrado detrás del cometa. Después el cometa huye 6 s y vuelve a cazar.
- Tienen 3 de vida: un golpe de honda resta 1 y un rayo de eclipse resta 3.
- Al morir sueltan lo que robaron y dejan unos 5 asteroides chicos.

**Render:** núcleo brillante celeste con cola de partículas o estela en dirección contraria al movimiento.

**Pruebas:**
- Aparición según los tiempos.
- Persecución.
- Robo y huida.
- Daño por honda y por eclipse.
- Muerte con suelta de asteroides.
- El pool no se desborda.

## Tarea 7 · Visor de fósforo (interfaz de partida)

DOM sobre el canvas (`src/ui/hud.ts`), que se actualiza a 10 Hz para no tocar el DOM en cada cuadro:
- **Arriba al centro:** nombre de la etapa y barra segmentada hasta la próxima.
- **Arriba a la izquierda:** tiempo y masa.
- **Abajo al centro:** HONDA (luz lista o en enfriamiento), cantidad de ECLIPSES y mundos en órbita.
- **Agujero negro:**
  - si está fuera de pantalla, flecha ámbar en el borde con la distancia;
  - si está en pantalla, corchetes alrededor.
- **Registro breve** (3 líneas que se van apagando): "ETAPA: ENANA AMARILLA", "ECLIPSE ×4", "COMETA: TE ROBÓ UN MUNDO".

**Pruebas e2e:**
- El visor muestra la etapa.
- La flecha aparece cuando el agujero negro está fuera de pantalla.
- La barra cambia al capturar.

## Tarea 8 · Fin de partida y reinicio

Cuando `w.over` deja de estar vacío, la simulación se detiene, la escena sigue respirando y aparece el cartel de fósforo:
- **"ESTRELLA TRAGADA"** o **"ESTRELLA APAGADA"**;
- tiempo, masa máxima, etapa y eclipses;
- **[R] o clic: nueva partida**, que genera un mapa nuevo.

**Prueba e2e:** se fuerza el fin con un gancho de prueba (`window.__GAME__.forceOver`), el cartel aparece y al reiniciar vuelve a empezar.

## Tarea 9 · "Hola Steam"

**Qué se hace:**
- `steamworks-ffi-node` en el proceso principal, que ya está en el diseño aprobado.
- Para desarrollo usa el App ID de prueba 480; el real se configura por variable de entorno.
- IPC `steam:status` y `steam:testAchievement`.
- El preload expone `window.platform.steam`.
- **Si Steam no está o la librería falla, el juego sigue igual.**

**Prueba:** en Electron, `window.platform.steam.status()` responde `{ available: boolean }` sin romper.

**Pendiente:** la prueba en Steam Deck queda para hacerla con Lucas.

## Tarea 10 · Pasada de juego y cierre

- Capturas y video de una partida con el agujero negro, el cometa, la honda y un eclipse.
- Banco de rendimiento.
- Registro en Notion de todas las "decisiones a revisar".
- Revisión final independiente y unión con `main`.
