# Diseño de interfaz — Enjambre gravitatorio

Estado al 24/11/2026. El registro completo está en Notion: página «Diseño de pantallas (interfaz)», dentro de la bitácora del proyecto.

## Identidad elegida: Consola de cosmonauta

Regla de diseño: nada que parezca generado o genérico. Cada elemento sale de objetos reales de época y tiene textura física.

| Elemento | Definición |
|---|---|
| Chapa | Pintura martillada turquesa de sala de control, con desgaste moderado (se descascara en bordes, juntas y tornillos), mugre leve y rayones finos. Se genera por código píxel por píxel |
| Herrajes | Latón envejecido, oscuro y con pátina (bulones, aros y escotillas) |
| Teclas | Baquelita verde oscuro con letras crema; la principal en ámbar. Con relieve y luz piloto |
| Pantallas | Fósforo verde-menta con matriz de puntos y vidrio con reflejo |
| Luces | LED ámbar |
| Letras | Martian Mono (rótulos y teclas) y Sometype Mono (pantallas), ambas con licencia OFL |
| Barras | Segmentadas, con parpadeo en el segmento que carga |
| Íconos | Sin emojis: símbolos dibujados a medida |

## Pantallas

| Pantalla | Estado | Archivos |
|---|---|---|
| Principal | Aprobada. La ventana muestra en movimiento la estrella del jugador con sus mundos y, de fondo, el agujero negro | `capturas/01-pantalla-principal.png`, `videos/pantalla-principal.webm` |
| Carga | Aprobada | `capturas/02-pantalla-de-carga.png`, `videos/pantalla-de-carga.webm` |
| Interfaz de partida | **Falta decidir:** A tablero de cabina, B placas en las esquinas o C visor de fósforo. Claude recomienda B con los arcos de fósforo de C | `capturas/03-partida-*.png` |
| Elegir mejora, pausa, fin de partida, elegir estrella, Atlas, opciones | Pendientes | — |

## Maquetas fuente

Los archivos de `maquetas/` se abren directamente en el navegador:
- `pantalla-principal-y-carga.html` incluye el generador de chapa, el aro de latón, la ventana animada y la carga. Para ver una sola pantalla, agregar `?only=s1` o `?only=s2` a la dirección.
- `interfaz-de-partida.html` tiene las tres opciones de interfaz de partida.
- `direccion-de-arte.html` tiene los bocetos de las cuatro direcciones de arte del juego.

Las fuentes tipográficas se cargan desde Google Fonts, así que hace falta conexión a internet.
