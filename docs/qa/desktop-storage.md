# Almacenamiento y filtros por tamaño en PC (sección 2.2)

## Implementado

- Capacidad, espacio libre y ocupado consultados con statfs en la unidad donde MMPlayer guarda sus datos. Sin cifras fijas ni capacidad inventada si la consulta falla.
- Pantalla identificada como «Unidad de MMPlayer», para no presentar la capacidad de una unidad como la suma de todos los discos del PC.
- Desglose real por tamaño de archivos: imágenes de artistas, playlists, CD, portadas personalizadas y extraídas del escáner, vídeos Canvas y miniaturas, letras y caché.
- Tamaño físico de la música consultado en disco, sin depender de una propiedad size inexistente en el modelo de canciones.
- Rutas mmplayer-media://track/<id> resueltas a los archivos físicos; los filtros de carpetas por tamaño mínimo/máximo usan los bytes reales. El caché de tamaños se invalida con las actualizaciones de biblioteca.
- checkFilesExistOnDisk consulta archivos reales en lotes, conserva el orden y devuelve false para archivos ausentes, renombrados, carpetas o rutas inválidas. No necesita un escaneo para detectar un archivo que se ha movido.
- Caché de la aplicación separada en app-cache. En Windows cache y Cache coincidían con la carpeta interna de Electron; la limpieza y el recuento de MMPlayer ahora usan su propia carpeta.
- Limpieza de Canvas incluye sus miniaturas; la limpieza temporal de medios reconoce la nueva carpeta de caché.

## Verificación

- `npm run desktop:typecheck` y `npm run desktop:build`: correctos.
- `npm run desktop:test`: 36 pruebas correctas, incluida capacidad real comparada con statfs, tamaños físicos y archivos renombrados detrás de rutas virtuales.
- `npx jest src/__tests__/libraryFilterService.test.ts src/__tests__/libraryFilters.test.ts src/__tests__/libraryFilterControls.test.ts --runInBand`: 20 pruebas correctas.
- `npm run test:sheets --workspace=@mmplayer/desktop -- --filter "Real disk|JSON and ZIP"`: 2 comprobaciones correctas en Electron real con perfil aislado. Verifica incrementos exactos por categoría, tamaño de música, filtros mínimo/máximo, limpieza de caché, protección de caché de Electron, eliminación de tamaños antiguos tras escaneo, pantalla de almacenamiento y regresión de copias JSON/ZIP.

Evidencia: `.tmp/desktop-sheets/1793196976232/report.json`.
