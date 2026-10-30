# Copias e importación ZIP en PC

## Implementado (sección 2.1)

- Ajustes permite exportar e importar JSON y ZIP sin navegar a DesktopPending.
- Exportar abre Guardar como del sistema; cancelar no se comunica como una exportación realizada.
- Restauración con reemplazo o combinación y resolución de conflictos mediante el servicio compartido.
- ZIP con portadas, Canvas, imágenes y perfil. Los archivos de música se importan por separado.
- Reasignación Android → PC: conserva los IDs del índice de archivos de PC y actualiza las referencias de playlists, etiquetas, colaboradores e historial. Solo acepta coincidencias únicas por ruta o metadatos; no elige entre duplicados ambiguos.
- Si faltan canciones, permite seleccionar carpetas para escanear o conservarlas sin localizar. Las copias no incluyen los archivos de audio.
- ZIP musical extraído en una carpeta propia y escaneado por el worker; progreso real y recuento de importados y omitidos.
- Archivos ZIP procesados por streams, con validación de rutas, nombres de Windows, entradas repetidas, cifrado, enlaces simbólicos, espacio libre, tamaño y CRC. No sobrescribe archivos durante la extracción.

## Verificación

- `npm run desktop:typecheck` y `npm run desktop:build`: correctos.
- `npm run desktop:test`: 35 pruebas correctas, incluidas compresión/extracción binaria y reasignación de Android a PC sin modificar la copia original ni adivinar coincidencias ambiguas.
- `npx jest src/__tests__/backupArchive.test.ts src/__tests__/backupData.test.ts src/__tests__/tagHistoryBackup.test.ts --runInBand`: 31 pruebas correctas.
- `npm run test:sheets --workspace=@mmplayer/desktop -- --filter "JSON and ZIP"`: correcto. Electron real con perfil aislado; exportación JSON/ZIP, inclusión y restauración de portada, reemplazo de SQLite, combinación ZIP con conservación de conflictos e importación/escaneo de audio ZIP.
- La prueba sustituye la elección de destino del diálogo nativo y alimenta el selector con archivos de prueba. La lectura, escritura, empaquetado, restauración de SQLite y escaneo son reales. El reinicio final se suprime solo durante la prueba para poder inspeccionar el resultado.

Evidencia de Electron: `.tmp/desktop-sheets/1793196436327/report.json`.

Las secciones 2.2 a 2.8 se revisarán por separado; este informe no las da por implementadas.
