# Letras físicas y precarga en PC (sección 2.3)

## Implementado y comprobado

- Importación .lrc desde la sheet con el selector de archivos de PC y persistencia en SQLite. Se elimina el BOM UTF-8 y se conservan tiempos, texto Unicode y saltos de línea. Los archivos vacíos no sustituyen las letras.
- Exportación .lrc mediante Guardar como del sistema usando los adaptadores de archivos de las secciones anteriores. Cancelar devuelve false y no modifica un archivo ya guardado. El nombre de archivo se adapta a las restricciones de Windows.
- Precarga automática al cargar/restaurar, modificar, avanzar o cambiar la cola. Se considera la canción actual y las dos siguientes, con debounce para cambios rápidos y sin esperar a la red para reproducir.
- Reutiliza letras existentes, respeta búsquedas anteriores fallidas o letras borradas, evita duplicar peticiones simultáneas y no pisa una edición/importación realizada durante una petición de fondo.
- Las peticiones de precarga tienen un límite de 10 segundos. HTTP 429 detiene la precarga de ese tramo; errores temporales no marcan una canción como permanentemente sin letras. Una cola obsoleta deja de solicitar canciones adicionales.
- Los IDs con guiones se buscan completos antes de intentar resolver antiguos IDs de instancias de reproducción.

## Verificación

- `npm run desktop:typecheck` y `npm run desktop:build`: correctos.
- `npm run desktop:test`: 36 pruebas correctas.
- `npx jest src/__tests__/lyricsSync.test.ts src/__tests__/lyricsService.test.ts src/__tests__/lyricsFetching.test.ts --runInBand`: 26 pruebas correctas. Incluyen alcance, deduplicación, caché, exclusiones, cancelación de cola, preservación de edición manual, 429/500 y timeout.
- `npm run test:sheets --workspace=@mmplayer/desktop -- --filter "Physical LRC"`: correcto en Electron con un perfil aislado. Importación desde la sheet, archivo físico exportado con contenido idéntico, cancelación de guardado, carga real de cola, avance y cambio de cola.
- En la prueba de Electron se suministra un archivo al selector y se elige automáticamente un destino aislado de Guardar como; lectura, escritura y SQLite son reales. Las respuestas LRCLIB de las canciones sintéticas de precarga son controladas para verificar de forma reproducible el comportamiento. Esta prueba no verifica la disponibilidad actual ni el catálogo del servicio externo.

Evidencia de Electron: `.tmp/desktop-sheets/1793197626111/report.json`.
