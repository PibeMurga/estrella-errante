# Meta, colapso y pantallas — diseño

Fecha: 26/11/2026. Decidido con Lucas en un brainstorming por secciones; las seis quedaron aprobadas en la conversación.
Complementa el diseño general (`2026-11-24-enjambre-gravitatorio-design.md`). Si algo choca, manda este documento.

Regla de fondo: todo tiene que parecer real. Lo raro es poco frecuente y nada se ve ficticio.

## 1. Objetivo y ciclo de una pantalla

1. **Arranque.** Sos una enana roja chica. El agujero negro rival aparece, te persigue y acelera de a poco. Crece con todo lo que traga, incluido lo que le tirás.
2. **Crecer.** Capturás asteroides y planetas (ver §3).
3. **Etapas por masa:** enana roja → amarilla → blanca → gigante azul → supergigante → **hipergigante** (nueva). Al llegar a cada etapa elegís 1 mejora entre 3 (ver §5).
4. **Colapso.** Siendo hipergigante y con más masa que el rival, el colapso queda disponible. Al dispararlo se ve la cinemática de la supernova (ver §7) y nace tu agujero negro.
5. **Fase final jugable (caza).** Ahora el agujero negro sos vos y el rival huye. Si lo alcanzás, se ve la cinemática de la fusión y ganás la pantalla.
6. **Derrota** en cualquiera de estos tres casos:
   - el rival te alcanza y te traga;
   - te apagás por un choque grave cuando no tenés protección;
   - en la caza, el rival se escapa (ver §2).

   La pantalla final dice siempre **por qué** perdiste, con una frase clara.

## 2. El agujero negro rival

**Comportamiento**
- Te persigue y acelera de a poco. Cada pantalla define su velocidad, su masa de arranque y el momento en que aparece.
- Crece con todo lo que traga: asteroides, planetas, escombros y lo que le tirás. Si se te escapa un planeta cercano, se lo come él. La carrera de masa es real.
- Un bólido que le pega le suma su masa y lo **enlentece un poco** durante unos segundos. **Nunca lo empuja.** La intensidad se ajusta jugando.
- Las mareas parten los planetas que pasan cerca, como hoy.

**Barras de masa.** Arriba de la pantalla se ven dos barras enfrentadas: tu masa contra la suya. Es la información más importante del juego. Cuando sos hipergigante y lo superás, la barra avisa que el colapso está disponible.

**Avisos en tres estados** (no hace falta que te atrape para entender el peligro):
1. **Lejos.** Una flecha con la distancia («AGUJERO NEGRO · X UA»), como hoy.
2. **Te atrae.** Cuando su gravedad ya te tira:
   - el visor se pone ámbar;
   - el fondo se curva hacia él con una lente suave;
   - tus cuerpos más externos se estiran un poco en su dirección.
3. **Sin retorno.** Cuando a tu velocidad ya no podés escapar:
   - el visor se pone rojo;
   - la distorsión es fuerte;
   - aparece el tiempo estimado hasta que te alcance.

Los cambios de estado se ven con una transición suave.

**En la caza.** Los papeles se invierten: el rival huye con la misma lógica que usaba para perseguirte, y las barras muestran tu ventaja. Si pasa un tiempo límite sin alcanzarlo (lo define cada pantalla), el rival se escapa y perdés.

**Marcas de peligro, minimalistas**
- Sólo aparecen en los cuerpos cercanos, a una distancia en la que podrías chocarlos.
- Son un arco fino alrededor del cuerpo, con el estilo del visor:
  - **ámbar:** te daña;
  - **rojo:** golpe grave;
  - **en trazos:** se puede partir a golpes.
- Los cuerpos que entran solos no llevan marca: lo que no tiene marca no hace daño.
- Las marcas aparecen y se apagan de a poco.

## 3. Planetas en tu sistema

**Captura en escalones**, según el tamaño del planeta (T) comparado con el tuyo (E). Los cortes son valores iniciales y se ajustan con el bot:

| Tamaño | Qué pasa | Marca |
|---|---|---|
| T ≤ 0,5·E | Entra solo a una **órbita exterior lenta**, más afuera que la de los asteroides. Se lo ve acercarse y caer en órbita. | ninguna |
| 0,5·E < T ≤ E | Hay que partirlo a golpes de honda o con un bólido. Los pedazos entran a tu órbita. | en trazos |
| E < T ≤ 1,5·E | Si lo chocás, te daña y perdés cuerpos de tu órbita. No te atraviesa: te esquiva o choca. | ámbar |
| T > 1,5·E | Golpe grave: perdés una etapa entera de masa. | rojo |

Los planetas nunca se lanzan: son tu sistema y la fuente de tus habilidades.

**Habilidades por cantidad.** Se cuentan los planetas en órbita sobre el total de planetas de la pantalla. Son tres escalones pasivos; los porcentajes son iniciales y se ajustan para que cueste:
1. **15 %, gravedad ampliada.** Crece tu radio de captura.
2. **30 %, escudo de órbita.** Ante un golpe que daña, primero se pierde un planeta exterior, que queda suelto y se puede recuperar, en lugar de tus asteroides.
3. **45 %, bólido mayor.** El lanzamiento cargado junta más asteroides y sale más pesado.

Si bajás de un umbral, perdés la habilidad hasta que lo vuelvas a alcanzar.

**Cometas con peso real**
- Cada pasada se lleva de 3 a 5 asteroides de tu órbita.
- Desde que tenés el segundo escalón, también puede llevarse un planeta chico.
- Si lo destruís, suelta todo lo que robó, que queda flotando para recuperarlo.
- Se destruye con 3 golpes de honda o con 1 bólido.

**Encuentros que ya existen y se conservan:**
- esquive lateral anticipado;
- choques esporádicos entre planetas;
- planetas partidos de a pedazos desiguales.

Ajustes acordados en el camino:
- menos planetas partidos;
- un esquive que no se sienta liviano;
- los cuerpos chicos rodean tu estrella, no la atraviesan.

## 4. Lanzamiento: un solo botón cargado

El nombre queda pendiente («honda gravitatoria» o «catapulta»). **El eclipse automático y su rayo blanco se eliminan.**

- **Toque:** lanzás un asteroide en la dirección que apuntás. Vuelve a tu órbita, como hoy.
- **Mantenido:** tu estrella junta asteroides de tu órbita en un **bólido**. Cuanto más mantenés, más asteroides se suman, hasta un límite, y se ve cómo se compactan antes de salir. Al soltar, el bólido sale hacia donde apuntás.
- **El bólido se pierde:** esos asteroides dejan tu órbita y quedan como escombros sueltos, que se pueden recapturar si vas a buscarlos.
- **Para qué sirve:**
  - romper planetas medianos o grandes;
  - destruir cometas;
  - frenar un poco al agujero negro, aunque eso lo alimenta.

## 5. Mejoras al subir de etapa

En cada etapa nueva el juego se pausa con una elección de **1 mejora entre 3**, sorteadas con la semilla. La primera versión trae unas 12. Las primeras seis son estas:
- órbita más rápida;
- lanzar cuesta menos asteroides;
- atracción a distancia;
- los cometas no te roban;
- el agujero negro te nota más tarde;
- recuperás más rápido lo que perdiste.

La lista completa se cierra en el plan de la Entrega 5. Ninguna mejora puede hacer el juego fácil: cada una cambia tu forma de jugar, no te regala la victoria.

## 6. Las 5 pantallas

En cada pantalla sube la dificultad del rival: es más rápido, arranca más grande y aparece antes. Además, cada una tiene su peculiaridad realista. Las pantallas se desbloquean en orden y el progreso se guarda.

1. **Nebulosa de origen.** Gas y polvo, muchos asteroides y planetas chicos, y un rival lento. Acá aprendés a crecer, a lanzar y a colapsar. *Peculiaridad:* la nebulosa frena un poco todo lo que se mueve, a vos y al rival.
2. **Cinturón denso.** Los restos de un sistema destruido: muchísimos asteroides, planetas rocosos partidos y choques frecuentes. *Peculiaridad:* el campo está lleno, así que esquivar y abrirte paso a bólidos es parte del juego.
3. **Sistema binario.** Otra estrella también captura y compite con vos por los planetas, pero no te ataca. Si se acerca al rival, él se la come y crece mucho. *Peculiaridad:* es una carrera de tres.
4. **Nube de cometas.** El borde de un sistema, lleno de cometas. *Peculiaridad:* tu sistema vive bajo asedio y defenderlo pesa tanto como crecer.
5. **Cerca del núcleo galáctico.** El rival arranca enorme y rápido, con un disco de escombros, y las mareas parten planetas todo el tiempo. *Peculiaridad:* hay poco tiempo y mucho riesgo, y el colapso se logra al límite.

Para más adelante quedan más asteroides alrededor en general y otras acciones del jugador.

## 7. Momentos visuales clave

**Hipergigante**
- **Late:** se hincha y se contrae despacio, y el brillo acompaña cada pulso.
- **Erupciones** cada tanto: una cáscara de gas sale despedida y se expande en un anillo que se desvanece, como en Eta Carinae.
- Una **nebulosa propia**, tenue y rojiza, se forma con lo que va expulsando.
- Los asteroides cercanos se curvan hacia ella aunque no los captures.

**Colapso y supernova (≈ 6 s)**
1. **Tensión:** la estrella se encoge de golpe, el brillo cae, la órbita tiembla y todo pasa en cámara lenta.
2. **Estallido:** un destello blanco llena la pantalla y una onda de choque luminosa barre todo. Tus cuerpos siguen en órbita.
3. **Nacimiento:** queda un punto negro, con su disco de acreción que se enciende y la lente que curva el fondo. La nebulosa de la explosión brilla durante toda la caza.

**Caza.** Tu agujero negro tiene el mismo aspecto realista que el rival. Lo que tocás lo tragás, y los cuerpos que pasan cerca se estiran por la marea.

**Fusión (≈ 5 s)**
1. Los dos agujeros se acercan girando uno alrededor del otro, cada vez más rápido.
2. Sus lentes se mezclan y deforman el fondo.
3. En el instante de la fusión, una **onda gravitatoria**: una deformación, no un anillo de luz, recorre la pantalla y hace ondular las estrellas.
4. Queda un solo agujero, más grande, y aparece la victoria.

## 8. Arquitectura

- **La simulación sigue siendo pura y determinista** (`src/sim/`), con paso fijo, semilla y arrays tipados. No se crean objetos dentro del bucle.
- **Fases de la partida.** `World` gana un campo de fase con este recorrido: `PLAY → COLLAPSE → HUNT → MERGE → WON`, y `LOST` desde cualquier fase con su motivo. Durante las cinemáticas (`COLLAPSE` y `MERGE`) la simulación avanza con un guion fijo, sin entrada del jugador, para que sea determinista.
- **Módulos nuevos**, cada uno con sus pruebas:
  - `sim/phase.ts`: fases y condiciones de colapso, victoria y derrota;
  - `sim/launch.ts`: toque, carga y bólido;
  - `sim/planetCapture.ts`: escalones de captura y golpes;
  - `sim/abilities.ts`: umbrales y habilidades;
  - `sim/upgrades.ts`: mejoras y su sorteo.

  Los encuentros (`encounters.ts`) y la marea (`tidal.ts`) se reutilizan, no se duplican.
- **El eclipse se elimina** de la simulación, del render (`fx/beam.ts`) y del visor.
- **Las pantallas son datos:** cada una es una configuración (`src/sim/levels.ts`) que extiende `config.ts` con su rival, sus densidades y un identificador de peculiaridad. La peculiaridad la resuelve una función chica por tipo, no un código aparte por pantalla.
- **Render:** la hipergigante, la supernova, el agujero negro propio, la fusión, las marcas y los avisos son capas nuevas o variantes de las capas existentes. El trabajo visual importante se hace con la skill `threejs-aaa-graphics-builder`, sólo procedural.
- **Guardado:** el progreso de pantallas desbloqueadas se guarda con el sistema de guardado existente.
- **Sin dependencias nuevas.** Si alguna hiciera falta, se le pregunta a Lucas antes.

## 9. Construcción en seis entregas

Cada entrega tiene su propio plan, se prueba y Lucas la juega antes de unirla a `main`:

1. **La meta:** barras de masa, hipergigante, colapso con supernova, caza, fusión, victoria y derrota con motivo. Las cinemáticas arrancan simples y se pulen después.
2. **El lanzamiento cargado:** toque o mantenido, el bólido que se pierde, la eliminación del eclipse y el efecto sobre el agujero negro.
3. **Planetas en tu sistema:** escalones de captura con órbita exterior, golpes según el tamaño, marcas de peligro, habilidades y cometas que roban más.
4. **Avisos del agujero negro:** los tres estados y la distorsión del espacio.
5. **Mejoras:** la elección de 1 entre 3 y la lista de unas 12.
6. **Las 5 pantallas:** peculiaridades, curva de dificultad y progreso guardado.

## 10. Pruebas y criterios de éxito

- **Vitest**, para cada regla:
  - transiciones de fase y sus motivos;
  - escalones de captura en sus bordes;
  - bólido (costo, límite, pérdida);
  - umbrales de habilidades;
  - sorteo de mejoras con semilla;
  - determinismo de las cinemáticas.
- **Bot que juega para ganar** (`npm run balance`). Cada pantalla tiene que ser ganable y más difícil que la anterior. Se mide con:
  - la tasa de victoria por pantalla, que tiene que bajar de la 1 a la 5;
  - la duración de las partidas;
  - el motivo de cada derrota.
- **Playwright y capturas**, para las barras, los avisos, las marcas y las cinemáticas.
- **Banco de rendimiento:** el p99 se mantiene dentro del objetivo (60 FPS en Steam Deck) con las capas nuevas.
- **La última palabra es de Lucas**, jugando cada entrega.

## 11. Decisiones confirmadas por Lucas (26/11/2026)

1. **El colapso lo disparás vos.** Cuando se cumplen las condiciones, la barra avisa y apretás una tecla. Podés seguir creciendo para entrar a la caza con más ventaja.
2. **La caza tiene tiempo límite.** Si no alcanzás al rival a tiempo, se escapa y perdés.
3. **Los cortes de tamaño son 0,5·E, E y 1,5·E.** El golpe grave te hace perder una etapa entera de masa.
4. **Las habilidades se pierden** si bajás del umbral, y el juego se pausa para elegir la mejora.

## 12. Ajustes después de las primeras partidas (27/11/2026)

Lucas jugó las Entregas 1 a 3 y ganó en 2:50, 3:11 y 2:42. Con eso quedó decidido:

- **La carrera de masa queda como está.** La escala del rival sigue en 55.
- **El final no se puede forzar.** Durante la supernova el rival huye; la caza arranca con él a 120 unidades o más; huye a 18; y en la caza tu agujero negro no frena al acercarse a lo que apuntás.
- **Un ecosistema más grande con la masa creciendo más lento:**
  - Los asteroides y las lunas suman 3/4 de su masa, y los planetas 1/10. Lo mismo se resta cuando se pierden.
  - En la órbita entran hasta 400 cuerpos.
  - La franja de órbita se ensancha con la estrella.
  - Los planetas tienen órbita propia, nunca se absorben, y se los atrapa desde el borde de su franja.
  - Al partir un planeta salen 6 fragmentos rocosos que se pueden capturar. Un bólido entero alcanza para partir un planeta mediano.

**Consultas abiertas para Lucas:**
1. ¿Las habilidades se calculan sobre todos los planetas de la pantalla, o sólo sobre los que siguen existiendo? Hoy se cuentan todos, y a medida que el rival se come planetas, el 45 % se vuelve casi imposible.
2. ¿Un cometa roba un planeta desde la habilidad 2 y en la mitad de las pasadas, como hoy?
3. ¿Un golpe grave en la primera etapa quita la mitad de la masa, como hoy?

## 13. Cambios pedidos por Lucas al jugar (27/11/2026, segunda ronda)

- **El colapso es automático** (reemplaza la decisión 1 de la §11). Apenas sos hipergigante y superás al rival en masa, colapsás solo; ya no hay tecla. El aviso de la hipergigante dice «SUPERÁ AL RIVAL Y COLAPSÁS».
- **Aviso claro al empezar la caza:** un cartel grande en el centro, «SOS UN AGUJERO NEGRO · ATRAPÁ AL RIVAL ANTES DE QUE ESCAPE», durante unos 4 segundos.
- **Pausa con ESC** (o Start en el mando), con la opción de empezar una partida nueva (R).
- **Colores de las alertas del agujero negro rival** (flecha, corchetes y distancia): rojas mientras te persigue y verde fósforo cuando lo perseguís vos.
- **Un planeta que partís sigue siendo el mismo planeta:** conserva su tamaño, se ve colapsado y en dos mitades, y entra a tu órbita aunque sea grande. Los gaseosos, que no tienen corteza, pierden su envoltura y se achican.
- **Marcas, revisadas con Lucas:** el que se puede partir es tu blanco y lleva un aro doble amarillo que late; el que daña, un aro rojo fino; el del golpe grave, un aro rojo grueso con un halo quieto; el que entra solo, sin marca. Reemplaza los trazos verdes y el ámbar del §2.
