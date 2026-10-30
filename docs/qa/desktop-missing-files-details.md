# Archivos ausentes y cabeceras de detalle en PC

Al arrancar y al terminar una sincronización, PC comprueba los archivos físicos y muestra el mismo diálogo de archivos no encontrados que móvil. El usuario puede conservarlos, reintentar la búsqueda o eliminarlos de la biblioteca. No se ocultan ni se eliminan automáticamente. Antes de borrar se comprueba otra vez que los archivos sigan ausentes. La eliminación limpia las relaciones y las entidades vacías, actualiza el reproductor y respeta la limpieza de los registros históricos y sus etiquetas.

Las cabeceras compartidas de detalle en PC usan la altura del panel, con un máximo de 500 px (antes hasta 720 px). El cálculo de móvil permanece en 380 px. El máximo se revisó a 500 px por petición del usuario.

Validación en Electron, informe `.tmp/desktop-sheets/1793288158008/report.json`:

- Carpeta física de prueba retirada y restaurada: conservar mantiene favorito y puntuación; reintentar recupera el archivo; sincronizar vuelve a preguntar; confirmar elimina únicamente la canción ausente.
- Álbum, artista, playlist y carpeta: ventanas 900×640, 1280×800 y 1920×1080, con zoom 70 %, 100 % y 130 % (36 vistas). Cabeceras limitadas y espacio visible para el contenido. Captura revisada.
- 2 pruebas de interfaz correctas, 0 fallos.
- 38 pruebas de escritorio correctas; comprobación de tipos y compilación correctas.

Comando dirigido: `npm run test:sheets --workspace=@mmplayer/desktop -- --filter MISSING-DETAILS`.

Revisión de navegación y máximo de 500 px: `.tmp/desktop-sheets/1793288477934/report.json`, 2 pruebas correctas. Se repitieron las 36 vistas de detalle y se comprobaron las seis pestañas de navegación en ventanas de 900 y 1600 px, con zoom 70/100/130 %. Usan Ionicons como móvil, con variantes seleccionadas y contornos para las inactivas. La selección conserva el fondo morado y ocupa el ancho completo del panel, sin borde lateral ni esquinas redondeadas. Comprobadas también las dimensiones de los iconos en el panel compacto y revisada la captura final.
