# Tarjetas de canción, letras y actividad en PC (sección 2.4)

## Implementado

- captureRef deja de lanzar el error del stub y captura el contenido completo de la tarjeta con Electron.
- Congela estilos calculados e incrusta imágenes y fuentes, incluidos los iconos cuando no hay portada. La captura usa un renderizador aislado, sin acceso al puente de la aplicación ni recursos externos.
- PNG a 1440 × 2560 desde ShareSong, ShareLyrics y ShareStats. La salida no depende del tamaño del monitor ni del zoom de la ventana. El adaptador también admite JPEG y resultados data-uri/base64.
- Guardar como del sistema permite guardar las imágenes generadas. Cancelar se trata sin mostrar un fallo; un error de generación o guardado sí muestra un aviso.
- El logo usa una importación compatible con PC y móvil. Las vistas previas calculan el tamaño a partir del panel disponible y reaccionan al zoom.
- Los archivos temporales se guardan en la caché propia de MMPlayer.

## Verificación

- npm run desktop:typecheck y npm run desktop:build: correctos.
- npm run desktop:test: 36 pruebas correctas.
- npm run test:sheets --workspace=@mmplayer/desktop -- --filter "cards export complete": correcto en Electron real, con perfil aislado.
- La prueba abre las tres pantallas, selecciona la vista previa de letras, pulsa los controles de compartir y comprueba archivos físicos PNG de 1440 × 2560 en zooms de 70 %, 100 % y 130 %.
- Verifica diversidad de píxeles, texto y marca inferior, y rechaza resultados con grandes zonas blancas causadas por recortes. También comprueba captura JPEG sin portada con su icono, tarjeta desmontada y cancelación desde la pantalla.
- Se revisaron visualmente las imágenes de canción, letras y actividad para confirmar logo, portada, texto y pie completos.
- La elección de destino en el diálogo se automatiza solo en el entorno de prueba. La captura, codificación y escritura de archivos son reales. Las tarjetas se guardan en disco; la prueba no envía imágenes a terceros.

Evidencia: .tmp/desktop-sheets/1793198912633/report.json y PNG en esa misma carpeta.
