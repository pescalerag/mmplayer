# Crossfade de reproducción (Android)

El ajuste de Audio y reproducción admite de 0 a 12 segundos enteros y empieza desactivado. Es global y se conserva entre sesiones; el fade de pausa/reanudación sigue siendo independiente.

## Comportamiento acordado

- Al empezar A → B, B pasa a ser la canción activa para la cola, letras, portada, notificación y controles. A solo conserva su audio saliente.
- «Añadir siguiente» durante la mezcla inserta después de B. Si B solo estaba preparada, una inserción puede sustituir esa preparación.
- Pausar congela las dos pistas y la curva; reanudar continúa la mezcla.
- Repetir toda la cola permite última → primera. Repetir una pista y las colas de una canción no hacen autofundido.
- El salto que genera una nueva cola con «aleatorio al finalizar» no hace crossfade.
- El tiempo de escucha se atribuye a B desde el inicio de la transición, sin duplicar minutos.
- Desactivar el ajuste deja terminar una mezcla ya iniciada.
- Siguiente, anterior, seek y selección explícita descartan el audio saliente y aplican la acción a la canción activa.
- Cambiar de cola consolida B antes de guardar su posición. La cola de destino mantiene el arranque pausado.
- Cast, restauración de sesiones, edición de sincronización de letras y repetición A–B suspenden la mezcla automática. Una transferencia a Cast consolida primero la canción y posición locales.

## Motor

El parche versionado de `react-native-track-player` contiene `CrossfadeCoordinator`, `CrossfadeEnvelope` y sus pruebas nativas. No basta con conservar cambios sueltos en `node_modules`.

Solo hay dos decodificadores: activo/preparado o activo/saliente. La preparación tiene su propio procesador ReplayGain y utiliza la fuente de datos del reproductor. Su liberación no destruye la caché compartida. No se inicia otra transición hasta liberar la saliente.

La instancia entrante continúa reproduciendo después del intercambio; no se reconstruye buscando su posición. La sesión multimedia se reasocia a la nueva instancia y el foco de audio conserva un único propietario. Las dos voces comparten sesión de audio para mantener EQ, graves y visualización; si Android no respeta esa sesión compartida se conserva el cambio normal sin solapamiento.

La curva utiliza tiempo monotónico y se detiene durante pausa/buffering. Las pistas cortas limitan tanto duración como instante de inicio. Cambiar velocidad adapta el tiempo restante conservando la proporción de mezcla. Una pista no preparada, de duración desconocida o con error conserva la transición normal.

Las inserciones nativas `-2` (después de la activa) y `-3` (después de su bloque manual) se resuelven en el hilo del motor. Los eventos y snapshots confirman el contador manual con una revisión para rechazar respuestas antiguas. Las entradas conservan identidades distintas aunque compartan archivo.

El snapshot de persistencia captura cola, índice y progreso en una operación. Las lecturas de progreso de Android incluyen la identidad de la entrada; las pantallas y letras rechazan muestras de la canción anterior. Las fronteras de escucha se procesan antes de esperar escrituras de historial.

## Comprobación

Pruebas de aplicación: `npm test -- --runInBand` y `npx tsc --noEmit`.

Pruebas nativas, desde `android` con un JDK configurado:

```powershell
.\gradlew.bat :react-native-track-player:testDebugUnitTest :native-equalizer:testDebugUnitTest
```

Las pruebas Robolectric cubren el coordinador y foco de audio con fuentes simuladas; no sustituyen escuchar la mezcla en un dispositivo. Para validar audio real hace falta una build que incorpore el motor nativo nuevo. No se ha generado APK como parte de esta implementación.

Pendiente de validación física: auriculares/Bluetooth, pantalla apagada, formatos y velocidades distintos, cambios rápidos de cola y combinación con EQ, graves, canvas y visualizador en dispositivos de gama baja. La implementación de crossfade es Android; iOS conserva su motor anterior. El soporte de archivos CUE sigue siendo una tarea independiente.
