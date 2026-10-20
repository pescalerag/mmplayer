# Optimización de reproducción: cambios y repetición en Xiaomi

Fecha: 20/10/2026. Comparación con `2026-10-20-xiaomi.md` y su CSV de referencia.

## Cambios aplicados

- Sustitución de cola en Android mediante `TrackPlayer.setQueue`, pausando antes y conservando el motor y sus parámetros. Se evita la secuencia `stop → reset → add` con la espera fija de 300 ms. El recorrido anterior se conserva como alternativa en iOS.
- Arranque de la canción seleccionada antes de esperar metadatos del resto. Las canciones posteriores se añaden por bloques; se carga un bloque siguiente antes de insertar una lista larga de canciones anteriores. Orden e identidades de entradas conservados.
- Consulta paralela de álbum y colaboradores al preparar cada pista. El mapeo de la cola original del aleatorio deja de lanzar todas las consultas simultáneamente y cede ejecución entre bloques.
- Guarda `isPreparingQueue` durante la sustitución: TrackPlayerSync no reproduce ni recarga estados intermedios. PlaybackService evita volver a resolver los metadatos del estado intermedio; sus eventos de audio/estadísticas se mantienen.
- Si el modelo e instancia activos ya coinciden, se evita una segunda búsqueda del mismo modelo.
- Cancelar una petición espera su operación nativa pendiente y libera correctamente la guarda. Una petición vieja no puede añadir su bloque a la nueva cola.
- La restauración aplica la velocidad/pitch globales guardados antes de continuar; no aplica primero los valores iniciales del store. Las colas restauradas siguen pausadas.
- El historial conserva su recorrido y garantías actuales: no se ha desplazado de forma insegura la lectura de identidad/tiempo a después del cambio. La escritura de ~45 ms observada no era el principal origen de los segundos de espera.
- Diagnóstico optativo `EXPO_PUBLIC_PROFILE_PLAYBACK=1`, con tiempos por fase y sin nombres de canciones ni rutas. Desactivado por defecto en builds normales.

No se ha cambiado el esquema de DB ni se han limitado artificialmente las colas a 50 entradas.

## Verificación

- TypeScript: `npx tsc --noEmit`, correcto.
- Jest: **148 suites y 1.322 tests correctos**.
- Pruebas nuevas: arranque con los metadatos de la siguiente canción bloqueados, orden y duplicados de una cola con prefijo largo, cancelación y cambios rápidos, errores nativos, guarda de preparación y conservación de posición/velocidad/pitch al restaurar.
- Gradle `:app:assembleRelease`: correcto. Build final 1 min 8 s.
- Actualización instalada con `adb install -r`, sin desinstalar ni borrar datos; paquete normal `com.pescalerag.mmplayer`, versión 3.0.0, código 34.
- APK final: `dist/MMPlayer-v3.0.0-performance-release.apk`.
- SHA-256: `5075F14BD770130B7746561C246A9F7750DCA964DDCCD8D8563C28A24C0BA9C4`.

La build final incluye dos protecciones verificadas después de la primera build de prueba: liberación de la guarda al cancelar y aplicación de los parámetros restaurados. Se volvió a instalar y repetir los casos críticos después de estos cambios.

## Repetición en dispositivo

Mismo Xiaomi M2007J17G/gauguin, Android 12, mismo paquete y biblioteca. USB conectado, batería ~20–23 %, temperatura final 31,2 °C y estado térmico 0. Se conservaron las cinco colas y se usó Cola 1 para los álbumes de prueba; Cola 2 mantuvo sus ~553 entradas. La app queda en Inicio, con el audio pausado y el álbum de 16 canciones cargado en Cola 1.

Se capturaron **42 ventanas válidas adicionales**: 24 en la primera build optimizada y 18 en la build final. El CSV distingue `intermediate` y `final`. Dos pulsaciones finales de pestaña realizadas con una pantalla superpuesta se descartaron y se repitieron tras verificar visualmente el origen; sus ficheros locales llevan el prefijo `discarded-`.

### Reproducción

| Caso comparable | Antes | Build final | Resultado |
| --- | --- | --- | --- |
| Álbum de una canción, mismo audio | 1.792 ms desde entrada hasta volumen positivo | 819 ms desde entrada | ~54 % menos en esta captura |
| Álbum de 16 canciones, repetición sin traza 1 | 2.278 ms desde marca | 756 ms desde marca | ~67 % menos |
| Álbum de 16 canciones, repetición sin traza 2 | 2.351 ms desde marca | 758 ms desde marca | ~68 % menos |
| Volumen completo en esas dos repeticiones | 2.602 / 2.678 ms | 1.045 / 1.081 ms | ~60 % menos hasta completar la rampa |
| Motor de audio al volver a la cola pequeña | Última creación de AudioTrack a 3.061 ms desde entrada | Última creación a 2.483 ms | Menor espera, pero todavía variable |
| Motor de audio al restaurar la cola grande | 3.288 ms en la repetición con traza | 1.580 ms | ~52 % menos en estas capturas |
| Siguiente con la cola ya cargada | Primer volumen positivo ~234 ms desde entrada | ~397 ms desde entrada | Sigue por debajo de medio segundo; esta captura no demuestra mejora de Siguiente |

Los tiempos no equivalen a una medición acústica. Usan el volumen positivo de AudioTrack y, en trazas, el evento táctil alineado entre relojes. En algunos reemplazos se observa un valor transitorio de volumen antes de escribir cero para el fundido: se toma la subida posterior al último cero para no presentar ese valor transitorio como inicio estable del efecto.

Las colas tienen más de una creación de AudioTrack en alguna captura; la comparación usa **la última** creación capturada de cada restauración, no la primera. Esto no mide exactamente cuándo el selector queda habilitado: `restoreQueue ready` corresponde a un punto interno anterior a validación/publicación final de la operación.

En la build final, las marcas de restauración indican `ready` a 1.765 ms para la pequeña y 1.884 ms para la grande desde la entrada a `restorePlaybackState`, sin incluir lo anterior de `switchQueue`. MediaSession confirmó ambas pausadas y con su posición restaurada. No se usan esos puntos internos como si fueran tiempos de creación de AudioTrack o de respuesta visual.

### Navegación

| Ventana | P95 de frame antes | P95 de frame final |
| --- | --- | --- |
| Primer acceso a Biblioteca | 150 ms | 81 ms |
| Primer acceso a Buscar | 85 ms | 97 ms |
| Primer acceso a Etiquetas | 38 ms | 46 ms |
| Volver a Inicio | 69 ms | 69 ms |
| Volver a Biblioteca | 81 ms | 81 ms |
| Volver a Buscar | 97 ms | 97 ms |

**No hay evidencia de una mejora general de navegación con este cambio.** Los accesos calientes siguen presentando frames individuales de 69–97 ms y los primeros accesos varían en ambas direcciones. Las muestras son cortas, con 1–2 frames en algunos cambios calientes; ni sus porcentajes de jank ni el P95 deben confundirse con latencia completa de apertura. No se han ocultado las muestras que empeoran.

También se repitieron apertura de PlayerScreen/QueueSheet, play/pause y detalles de álbum en la primera build optimizada. El CSV conserva los resultados. Los cambios de esta tarea se concentran en reproducción; la arquitectura de pestañas de la tarea anterior se mantiene.

## Trabajo que sigue siendo relevante

Las marcas ya separan la espera restante:

- Resolución de metadatos seleccionados: alrededor de medio segundo en varias capturas. Una consulta SQLite registrada en la traza ejecuta en menos de un milisegundo: no debe atribuirse todo ese tiempo al disco; también hay despacho del puente, trabajo de JS y presentación. Antes de añadir cachés de metadatos hay que definir invalidación para ediciones, colaboradores y carátulas.
- Restauración: `active-model` y publicación/modelos adyacentes todavía consumen una parte importante del tiempo después de sustituir la cola nativa.
- Navegación: el siguiente objetivo debe ser el coste de commit/render y suscripciones de los elementos visibles, especialmente primeras entradas a Biblioteca/Buscar y lectura del estado de reproducción por múltiples tarjetas.

El avance comprobado aquí es la reducción del camino de **iniciar una nueva reproducción**, con alrededor de un 67 % menos de espera en las dos repeticiones sin trazado. No es una garantía para todos los dispositivos ni una afirmación de que los tirones de navegación estén resueltos.

CSV: `2026-10-20-xiaomi-optimized-measurements.csv`. Capturas, trazas y logs completos permanecen fuera de Git en `.tmp/performance-device/after/` y `.tmp/performance-device/final/`.
