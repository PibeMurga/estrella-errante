# MAGNAR — reglas del proyecto

Diseño: `docs/superpowers/specs/2026-11-24-enjambre-gravitatorio-design.md`.
Bitácora: Notion "Estudio Game", usando SOLO el MCP `notion-juego`. Antes de escribir, confirmar que la cuenta sea lfigueiraduarte@gmail.com. Cada decisión, avance o tarea se registra ahí.

## Arquitectura
- La simulación (`src/sim/`) es TypeScript puro y determinista, con paso fijo y semilla. No depende del render.
- Se usan arrays tipados. No se agrega un ECS salvo que una medición lo justifique.
- Steamworks se usa sólo desde el proceso principal de Electron, a través de IPC y preload. Nunca se desactiva `contextIsolation`.
- Se prefieren dependencias chicas y especializadas. Antes de sumar una dependencia o cambiar la arquitectura, preguntarle a Lucas.
- Sólo se usa código y recursos con licencia que permita la venta (MIT, BSD, Apache, zlib, Unlicense). Si un repo no tiene licencia, se puede mirar pero no copiar.
- Sonidos: se aceptan los que tienen licencia CC0 o están en dominio público (como los de la NASA, revisados archivo por archivo y sin usar su logo ni insinuar su respaldo). El origen de cada archivo se anota.

## Calidad visual
- El estilo cinemático es un requisito del producto, no un adorno.
- Para trabajo visual importante se usa la skill `threejs-aaa-graphics-builder`, en modo sólo procedural, sin generación externa.
- Los cambios visuales se validan con capturas de Playwright y se puntúan con el scorecard de la skill.
- Se mantiene una identidad visual coherente (sección 7 del diseño).

## Rendimiento
- Objetivo: 60 FPS en Steam Deck, con un banco de prueba de 2.000 asteroides y 300 cuerpos.
- Antes de optimizar se mide con la skill `threejs-debug-profiler`.
- Se mide el tiempo de cuadro p99, no sólo el promedio de FPS.
- No se crean objetos nuevos dentro del bucle del juego.
- La calidad gráfica es ajustable (baja, media y alta).

## Eficiencia del agente
- La metodología es superpowers. Las skills especializadas se cargan sólo cuando hacen falta.
- Leer sólo los archivos de la tarea en curso.
- No delegar a subagentes tareas triviales.
- No refactorizar módulos ajenos a la tarea.
- No duplicar sistemas que ya existen.
- No escribir documentación redundante.

## Validación
- La simulación se prueba con Vitest: determinismo, órbitas, captura y guardado.
- El render y la interacción se prueban con Playwright.
- Nunca afirmar una mejora de rendimiento sin mediciones.

## Idioma
- Todo lo que ve Lucas va en español rioplatense: respuestas, documentos, Notion y commits.
