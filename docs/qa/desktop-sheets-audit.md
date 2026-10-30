# Auditoría de sheets y subniveles de MMPlayer PC

Resultado: **309 correctas, 3 fallidas y 1 sin verificar**.

29 tipos contrastados con el registro de la app; 1057 eventos registrados (848 clics).

Electron real con perfil y archivos aislados. Abrir un selector o una confirmación solo verifica ese paso, no la operación final. Los selectores de archivos se alimentan mediante File/DataTransfer de Chromium; parsers, motor, SQLite y escritura de metadatos son reales.

## Repetir

```powershell
npm run desktop:test:sheets
```

Subconjunto de subniveles:

```powershell
npm run test:sheets --workspace=@mmplayer/desktop -- --filter "ALL:"
```

La ejecución usa un perfil y archivos desechables. El build normal se restaura al terminar. Un fallo de la app mantiene el resultado fallido; abrir un menú solo verifica esa transición. Las operaciones se comprueban en casos propios. Los eventos confiables son entrada nativa de Electron; el resto son eventos DOM del driver.

## Fallos

| Sheet o subnivel | Opción | Evidencia |
|---|---|---|
| local-cast | Abrir y mostrar contenido | LocalCast no se renderiza en DesktopSheetHost |
| track-menu | Compartir | No solicita guardar archivo (evidencia: ALL: archivo fisico Compartir) |
| lyrics-menu | Buscar letras en internet | Búsqueda intentada; proveedor no verificable: HTTP 503 |
| track-menu | ALL: archivo fisico Compartir | No solicita guardar archivo |

## Límites de la comprobación

- Los selectores reciben archivos de prueba mediante File/DataTransfer y el destino del diálogo de guardar se redirige al directorio de la auditoría. SQLite, escritura de etiquetas de audio, ZIP, almacenamiento, motor y capturas son reales.
- Las búsquedas externas usan el proveedor real; un 404 solo confirma la búsqueda y la gestión de ausencia. No equivale a descargar unas letras que sí existan. Los casos adicionales de prefetch usan respuestas controladas y lo indican en su evidencia.
- Los temporizadores se activan en cada intervalo y se cancelan; no se espera una hora por cada opción.
- Se prueban los controles disponibles en PC y sus estados relevantes. Las opciones exclusivas de Android y los equipos externos que no estén conectados no se certifican.
- Los recuentos corresponden a casos de prueba; un caso puede incluir varias pulsaciones, y un mismo fallo puede afectar a varios casos.

## Todos los resultados

| Sheet o subnivel | Opción | Resultado | Evidencia |
|---|---|---|---|
| catalog | ALL: registro completo de sheets | pass | 29 tipos contrastados con useUIStore, mas tag-form y subniveles de escritorio |
| track-menu | Abrir y mostrar contenido | pass | 28 controles encontrados |
| album-menu | Abrir y mostrar contenido | pass | 12 controles encontrados |
| artist-menu | Abrir y mostrar contenido | pass | 7 controles encontrados |
| folder-menu | Abrir y mostrar contenido | pass | 8 controles encontrados |
| playlist-menu | Abrir y mostrar contenido | pass | 5 controles encontrados |
| lyrics-menu | Abrir y mostrar contenido | pass | 9 controles encontrados |
| artists-list | Abrir y mostrar contenido | pass | 2 controles encontrados |
| sleep-timer | Abrir y mostrar contenido | pass | 7 controles encontrados |
| speed-pitch | Abrir y mostrar contenido | pass | 2 controles encontrados |
| library-tabs-order | Abrir y mostrar contenido | pass | 7 controles encontrados |
| app-tabs-order | Abrir y mostrar contenido | pass | 12 controles encontrados |
| home-sections | Abrir y mostrar contenido | pass | 21 controles encontrados |
| swipe-action | Abrir y mostrar contenido | pass | 6 controles encontrados |
| sort-modal | Abrir y mostrar contenido | pass | 15 controles encontrados |
| metadata-editor | Abrir y mostrar contenido | pass | 13 controles encontrados |
| playlist-selector | Abrir y mostrar contenido | pass | 3 controles encontrados |
| tag-manager | Abrir y mostrar contenido | pass | 3 controles encontrados |
| tag-menu | Abrir y mostrar contenido | pass | 5 controles encontrados |
| player-menu | Abrir y mostrar contenido | pass | 18 controles encontrados |
| batch-menu | Abrir y mostrar contenido | pass | 12 controles encontrados |
| advanced-tag-search | Abrir y mostrar contenido | pass | 7 controles encontrados |
| edit-alias | Abrir y mostrar contenido | pass | 3 controles encontrados |
| clear-queue | Abrir y mostrar contenido | pass | 3 controles encontrados |
| canvas-manager | Abrir y mostrar contenido | pass | 2 controles encontrados |
| track-details | Abrir y mostrar contenido | pass | 7 controles encontrados |
| notification-settings | Abrir y mostrar contenido | pass | 9 controles encontrados |
| queue-destination | Abrir y mostrar contenido | pass | 5 controles encontrados |
| queue | Abrir y mostrar contenido | pass | Se abre DesktopQueuePanel |
| local-cast | Abrir y mostrar contenido | fail | LocalCast no se renderiza en DesktopSheetHost |
| track-menu | Cancelar | pass | Comprobación completada |
| track-menu | Añadir a continuación | pass | La cola crece y contiene la pista de prueba |
| track-menu | Añadir al final de la cola | pass | La cola crece y contiene la pista de prueba |
| track-menu | Añadir a una cola distinta | pass | Abre queue-destination con las pistas |
| track-menu | Seleccionar | pass | La selección contiene la pista |
| track-menu | Editar Metadatos | pass | Comprobación completada |
| track-menu | Añadir vídeo de fondo (Canvas) | pass | Comprobación completada |
| track-menu | Gestionar etiquetas | pass | Comprobación completada |
| track-menu | Añadir a playlist | pass | Comprobación completada |
| track-menu | Añadir a favoritos | pass | Estado favorito actualizado en el modelo |
| track-menu | Compartir | fail | No solicita guardar archivo (evidencia: ALL: archivo fisico Compartir) |
| track-menu | Ir a álbum | pass | Comprobación completada |
| track-menu | Ver artista | pass | Comprobación completada |
| track-menu | Excluir de reproducción aleatoria | pass | Modelo persistido actualizado |
| track-menu | Excluir canción — confirmación y cancelación | pass | La confirmación se muestra; cancelar conserva los datos |
| track-menu | Excluir canción | pass | La exclusión elimina la entidad desechable de SQLite |
| track-menu | Configurar saltos | pass | Comprobación completada |
| track-menu | Propiedades | pass | Comprobación completada |
| album-menu | Cancelar | pass | Comprobación completada |
| album-menu | Fijar | pass | isPinned actualizado |
| album-menu | Añadir a continuación | pass | La cola crece y contiene la pista de prueba |
| album-menu | Añadir al final de la cola | pass | La cola crece y contiene la pista de prueba |
| album-menu | Añadir a una cola distinta | pass | Abre queue-destination con las pistas |
| album-menu | Gestionar etiquetas | pass | Comprobación completada |
| album-menu | Añadir a playlist | pass | Comprobación completada |
| album-menu | Seleccionar canciones | pass | La selección contiene la pista |
| album-menu | Excluir álbum del aleatorio | pass | Modelo persistido actualizado |
| album-menu | Personalizar imagen de CD | pass | Comprobación completada |
| album-menu | Ver artista | pass | Comprobación completada |
| album-menu | Excluir del escaneo — confirmación y cancelación | pass | La confirmación se muestra; cancelar conserva los datos |
| album-menu | Excluir del escaneo | pass | La exclusión elimina la entidad desechable de SQLite |
| artist-menu | Cancelar | pass | Comprobación completada |
| artist-menu | Fijar en la biblioteca | pass | isPinned actualizado |
| artist-menu | Añadir a continuación | pass | La cola crece y contiene la pista de prueba |
| artist-menu | Añadir al final de la cola | pass | La cola crece y contiene la pista de prueba |
| artist-menu | Añadir a una cola distinta | pass | Abre queue-destination con las pistas |
| artist-menu | Añadir a playlist | pass | Comprobación completada |
| artist-menu | Ver artista | pass | Comprobación completada |
| folder-menu | Cancelar | pass | Comprobación completada |
| folder-menu | Añadir a continuación | pass | La cola crece y contiene la pista de prueba |
| folder-menu | Añadir al final de la cola | pass | La cola crece y contiene la pista de prueba |
| folder-menu | Añadir a una cola distinta | pass | Abre queue-destination con las pistas |
| folder-menu | Añadir a playlist | pass | Comprobación completada |
| folder-menu | Seleccionar canciones | pass | La selección contiene la pista |
| folder-menu | Excluir del escaneo — confirmación y cancelación | pass | La confirmación se muestra; cancelar conserva los datos |
| folder-menu | Excluir del escaneo | pass | La exclusión elimina la entidad desechable de SQLite |
| playlist-menu | Cancelar | pass | Comprobación completada |
| playlist-menu | Fijar en la biblioteca | pass | isPinned actualizado |
| playlist-menu | Añadir a playlist | pass | Comprobación completada |
| playlist-menu | Seleccionar canciones | pass | La selección contiene la pista |
| playlist-menu | Ver playlist | pass | Comprobación completada |
| batch-menu | Cancelar | pass | Comprobación completada |
| batch-menu | Añadir a continuación | pass | La cola crece y contiene la pista de prueba |
| batch-menu | Añadir al final de la cola | pass | La cola crece y contiene la pista de prueba |
| batch-menu | Añadir a una cola distinta | pass | Abre queue-destination con las pistas |
| batch-menu | Editar Metadatos (Lote) | pass | Comprobación completada |
| batch-menu | Cambiar vídeo de fondo (Canvas) | pass | Comprobación completada |
| batch-menu | Gestionar etiquetas | pass | Comprobación completada |
| batch-menu | Añadir a playlist | pass | Comprobación completada |
| batch-menu | Compartir selección como ZIP | pass | Boton pulsado y archivo real guardado (3946 bytes) (evidencia: ALL: archivo fisico Compartir selección como ZIP) |
| batch-menu | Añadir a favoritos | pass | Estado favorito actualizado en el modelo |
| batch-menu | Excluir del aleatorio | pass | Modelo persistido actualizado |
| batch-menu | Excluir canción — confirmación y cancelación | pass | La confirmación se muestra; cancelar conserva los datos |
| batch-menu | Excluir canción | pass | La exclusión elimina la entidad desechable de SQLite |
| tag-menu | Cancelar | pass | Comprobación completada |
| tag-menu | Editar etiqueta | pass | Comprobación completada |
| tag-menu | Añadir a playlist | pass | Comprobación completada |
| tag-menu | Eliminar Etiqueta — confirmación y cancelación | pass | La confirmación se muestra; cancelar conserva los datos |
| tag-menu | Eliminar Etiqueta | pass | Comprobación completada |
| lyrics-menu | Cancelar | pass | Comprobación completada |
| lyrics-menu | Más info | pass | Abre menú de la canción |
| lyrics-menu | Compartir letras | pass | Verifica preparación y apertura; no envía a terceros |
| lyrics-menu | Importar archivo .LRC | pass | Selector DOM, lectura del archivo y persistencia comprobados |
| lyrics-menu | Exportar archivo .LRC | pass | Boton pulsado y archivo real guardado (67 bytes) (evidencia: ALL: archivo fisico Exportar archivo .LRC) |
| lyrics-menu | Buscar letras en internet | unverified | Búsqueda intentada; proveedor no verificable: HTTP 503 |
| lyrics-menu | Editar letras | pass | Editar y persistir texto real; reapertura, cancelar salida, descartar por barra lateral y volver sin cambios (evidencia: REPAIR: editar guardar reabrir y proteger cambios) |
| lyrics-menu | Sincronizar letras | pass | Cancion real del reproductor, seek, dos marcas, deshacer, reinicio cancelado/confirmado y LRC persistido (evidencia: REPAIR: sincronizar marcar deshacer reiniciar y guardar LRC) |
| lyrics-menu | Eliminar letras — confirmación y cancelación | pass | La confirmación se muestra; cancelar conserva los datos |
| lyrics-menu | Eliminar letras | pass | Elimina las letras de la pista de prueba y se restauran tras verificarlo |
| sleep-timer | 5 min | pass | Activa 5 minutos y se cancela |
| sleep-timer | 10 min | pass | Activa 10 minutos y se cancela |
| sleep-timer | 20 min | pass | Activa 20 minutos y se cancela |
| sleep-timer | 30 min | pass | Activa 30 minutos y se cancela |
| sleep-timer | 45 min | pass | Activa 45 minutos y se cancela |
| sleep-timer | 1 hora | pass | Activa 60 minutos y se cancela |
| swipe-action | Añadir a continuación (left) | pass | Comprobación completada |
| swipe-action | Añadir a continuación (right) | pass | Comprobación completada |
| swipe-action | Añadir a la cola (left) | pass | Comprobación completada |
| swipe-action | Añadir a la cola (right) | pass | Comprobación completada |
| swipe-action | Añadir a playlist (left) | pass | Comprobación completada |
| swipe-action | Añadir a playlist (right) | pass | Comprobación completada |
| swipe-action | Alternar favorito (left) | pass | Comprobación completada |
| swipe-action | Alternar favorito (right) | pass | Comprobación completada |
| swipe-action | Ninguna (left) | pass | Comprobación completada |
| swipe-action | Ninguna (right) | pass | Comprobación completada |
| artists-list | Artista desconocido | pass | Comprobación completada |
| queue-destination | Cola 2 | pass | Comprobación completada |
| queue-destination | Cola 3 | pass | Comprobación completada |
| queue-destination | Cola 4 | pass | Comprobación completada |
| queue-destination | Cola 5 | pass | Comprobación completada |
| player-menu | Carátula Original | pass | playerCoverStyle=cover |
| player-menu | CD Giratorio | pass | playerCoverStyle=cd |
| player-menu | Vinilo Giratorio | pass | playerCoverStyle=vinyl |
| player-menu | Casete | pass | playerCoverStyle=cassette |
| player-menu | Carátula Difuminada | pass | playerBackgroundStyle=cover |
| player-menu | Degradado de Color | pass | playerBackgroundStyle=gradient |
| player-menu | Barras de Ecualizador | pass | playerVisualizerType=bars |
| player-menu | Onda Oscilante | pass | playerVisualizerType=wave |
| player-menu | Espectro Completo | pass | playerVisualizerType=spectrum |
| player-menu | Círculo Pulsante | pass | playerVisualizerType=circle |
| player-menu | Adaptarse a Portada | pass | playerVisualizerColorMode=cover |
| player-menu | Color de acento | pass | playerVisualizerColorMode=accent |
| player-menu | Arcoíris | pass | playerVisualizerColorMode=rainbow |
| player-menu | Color personalizado | pass | Abre el selector de color |
| player-menu | Mostrar nombre del álbum en casete | pass | Comprobación completada |
| player-menu | Mostrar Canvas | pass | Comprobación completada |
| player-menu | Visualizador Activo | pass | Comprobación completada |
| edit-alias | Guardar alias | pass | Comprobación completada |
| tag-manager | Sheet audit tag | pass | Comprobación completada |
| tag-manager | Crear nueva etiqueta | pass | Comprobación completada |
| playlist-selector | Crear nueva playlist | pass | Comprobación completada |
| playlist-selector | Sheet audit playlist Sin descripción | pass | Selecciona playlist y confirma adición |
| library-tabs-order | Reordenar y guardar | pass | Arrastre DOM y persistencia del orden comprobados |
| app-tabs-order | Reordenar y guardar | pass | Arrastre DOM y persistencia del orden comprobados |
| home-sections | Reordenar y guardar | pass | Arrastre DOM y persistencia del orden comprobados |
| notification-settings | Interruptores y guardar | pass | 7 interruptores modificados y guardados |
| home-sections | Interruptores y guardar | pass | 10 interruptores modificados y guardados |
| advanced-tag-search | Sheet audit tag | pass | Comprobación completada |
| advanced-tag-search | Borrar todo | pass | Comprobación completada |
| speed-pitch | Velocidad y restablecer | pass | Entrada de ratón de Electron y estado del motor comprobados |
| speed-pitch | Tono y restablecer | pass | Entrada de ratón de Electron y estado del motor comprobados |
| speed-pitch | Modo Vinilo / Hi-Fi | pass | Comprobación completada |
| sort-modal | Ordenación y filtros (albums) | pass | Cambia orden/filtro, aplica y limpia |
| sort-modal | Orden 1 (albums) | pass | albumSort=rating_desc |
| sort-modal | Orden 2 (albums) | pass | albumSort=rating_asc |
| sort-modal | Orden 3 (albums) | pass | albumSort=name_asc |
| sort-modal | Orden 4 (albums) | pass | albumSort=name_desc |
| sort-modal | Orden 5 (albums) | pass | albumSort=year_desc |
| sort-modal | Orden 6 (albums) | pass | albumSort=year_asc |
| sort-modal | Ordenación y filtros (artists) | pass | Cambia orden/filtro, aplica y limpia |
| sort-modal | Orden 1 (artists) | pass | artistSort=rating_desc |
| sort-modal | Orden 2 (artists) | pass | artistSort=rating_asc |
| sort-modal | Orden 3 (artists) | pass | artistSort=name_asc |
| sort-modal | Orden 4 (artists) | pass | artistSort=name_desc |
| sort-modal | Ordenación y filtros (tracks) | pass | Cambia orden/filtro, aplica y limpia |
| sort-modal | Orden 1 (tracks) | pass | trackSort=name_asc |
| sort-modal | Orden 2 (tracks) | pass | trackSort=name_desc |
| sort-modal | Orden 3 (tracks) | pass | trackSort=duration_desc |
| sort-modal | Orden 4 (tracks) | pass | trackSort=duration_asc |
| sort-modal | Ordenación y filtros (playlists) | pass | Cambia orden/filtro, aplica y limpia |
| sort-modal | Orden 1 (playlists) | pass | playlistSort=recent_desc |
| sort-modal | Orden 2 (playlists) | pass | playlistSort=recent_asc |
| sort-modal | Orden 3 (playlists) | pass | playlistSort=name_asc |
| sort-modal | Orden 4 (playlists) | pass | playlistSort=name_desc |
| sort-modal | Ordenación y filtros (folders) | pass | Cambia orden/filtro, aplica y limpia |
| advanced-tag-search | Excluir etiqueta / neutral / interruptores | pass | Comprobación completada |
| metadata-editor | Guardar metadatos individuales | pass | Escritura física y actualización de biblioteca comprobadas |
| metadata-editor | Guardar lote MP3/FLAC y autonumeración | pass | Escritura real de género y números en MP3 y FLAC |
| canvas-manager | Subir nuevo vídeo | pass | Vídeo WebM generado en Chromium, copiado a almacenamiento y asignado a la pista |
| track-menu | Eliminar vídeo de fondo (Canvas) | pass | Comprobación completada |
| track-menu | Valoración: medias estrellas, completas y borrar | pass | Comprobación completada |
| clear-queue | Borrar cola manual | pass | Elimina próximas pistas del tipo solicitado |
| clear-queue | Borrar cola context | pass | Elimina próximas pistas del tipo solicitado |
| queue | queue-tab-upcoming | pass | Comprobación completada |
| queue | queue-tab-recent | pass | Comprobación completada |
| queue | Guardar cola completa en playlist | pass | Comprobación completada |
| queue | Gestionar cola y cancelar | pass | Comprobación completada |
| track-details | Copiar campo 1 | pass | Texto copiado coincide con la propiedad mostrada |
| track-details | Copiar campo 2 | pass | Texto copiado coincide con la propiedad mostrada |
| track-details | Copiar campo 3 | pass | Texto copiado coincide con la propiedad mostrada |
| track-details | Copiar campo 4 | pass | Texto copiado coincide con la propiedad mostrada |
| track-details | Copiar campo 5 | pass | Texto copiado coincide con la propiedad mostrada |
| track-details | Copiar campo 6 | pass | Texto copiado coincide con la propiedad mostrada |
| clear-queue | Parar la reproducción | pass | Comprobación completada |
| metadata-editor | Buscar carátula en internet | pass | Búsqueda real en Deezer y previsualización de la carátula descargada |
| app-tabs-order | Pantalla de inicio: Inicio | pass | Comprobación completada |
| app-tabs-order | Pantalla de inicio: Biblioteca | pass | Comprobación completada |
| app-tabs-order | Pantalla de inicio: Buscar | pass | Comprobación completada |
| app-tabs-order | Pantalla de inicio: Etiquetas | pass | Comprobación completada |
| app-tabs-order | Pantalla de inicio: Actividad | pass | Comprobación completada |
| lyrics-menu | Traducciones de confirmación | pass | Comprobación completada |
| folder-menu | Fijar en la biblioteca | pass | Comprobación completada (evidencia: ALL: fijar y desfijar desde el mismo menu) |
| tag-menu | Fijar en la biblioteca | pass | Comprobación completada (evidencia: ALL: fijar y desfijar desde el mismo menu) |
| tag-menu | ALL: fijar y desfijar desde el mismo menu | pass | Comprobación completada |
| folder-menu | ALL: fijar y desfijar desde el mismo menu | pass | Comprobación completada |
| playlist-menu | ALL: fijar y desfijar desde el mismo menu | pass | Comprobación completada |
| album-menu | ALL: fijar y desfijar desde el mismo menu | pass | Comprobación completada |
| artist-menu | ALL: fijar y desfijar desde el mismo menu | pass | Comprobación completada |
| tag-form | ALL: crear y editar color 1 | pass | Paleta pulsada, alta y edicion persistidas en SQLite |
| tag-form | ALL: crear y editar color 2 | pass | Paleta pulsada, alta y edicion persistidas en SQLite |
| tag-form | ALL: crear y editar color 3 | pass | Paleta pulsada, alta y edicion persistidas en SQLite |
| tag-form | ALL: crear y editar color 4 | pass | Paleta pulsada, alta y edicion persistidas en SQLite |
| tag-form | ALL: crear y editar color 5 | pass | Paleta pulsada, alta y edicion persistidas en SQLite |
| tag-form | ALL: crear y editar color 6 | pass | Paleta pulsada, alta y edicion persistidas en SQLite |
| tag-form | ALL: nombre vacio duplicado y cancelar subnivel | pass | Comprobación completada |
| color-picker | ALL: color personalizado cancel | pass | Comprobación completada |
| color-picker | ALL: color personalizado save | pass | Comprobación completada |
| playlist-selector | ALL: duplicados parciales Cancelar | pass | Comprobación completada |
| playlist-selector | ALL: duplicados parciales Solo nuevas | pass | Comprobación completada |
| playlist-selector | ALL: duplicados parciales Añadir todas | pass | Comprobación completada |
| playlist-selector | ALL: editar nombre descripcion y cancelar creacion | pass | Comprobación completada |
| queue-manage | ALL: manual | pass | Comprobación completada |
| queue-manage | ALL: context | pass | Comprobación completada |
| queue-manage | ALL: stop | pass | Comprobación completada |
| queue-manage | ALL: cancel | pass | Comprobación completada |
| queue-save | ALL: opcion 1 | pass | Comprobación completada |
| queue-save | ALL: opcion 2 | pass | Comprobación completada |
| queue-save | ALL: opcion 3 | pass | Comprobación completada |
| queue-save | ALL: opcion 4 | pass | Comprobación completada |
| queue-selector | ALL: seleccionar y renombrar cola 1 | pass | Comprobación completada |
| queue-selector | ALL: seleccionar y renombrar cola 2 | pass | Comprobación completada |
| queue-selector | ALL: seleccionar y renombrar cola 3 | pass | Comprobación completada |
| queue-selector | ALL: seleccionar y renombrar cola 4 | pass | Comprobación completada |
| queue-selector | ALL: seleccionar y renombrar cola 5 | pass | Comprobación completada |
| queue-selector | ALL: restablecer todas cancelar y confirmar | pass | Comprobación completada |
| sort-modal | ALL: todos los filtros y subniveles albums | pass | 31 interacciones: desplegables, chips, limites, ampliacion, fechas y guardar/limpiar |
| sort-modal | ALL: todos los filtros y subniveles artists | pass | 32 interacciones: desplegables, chips, limites, ampliacion, fechas y guardar/limpiar |
| sort-modal | ALL: todos los filtros y subniveles tracks | pass | 31 interacciones: desplegables, chips, limites, ampliacion, fechas y guardar/limpiar |
| sort-modal | ALL: todos los filtros y subniveles playlists | pass | 24 interacciones: desplegables, chips, limites, ampliacion, fechas y guardar/limpiar |
| sort-modal | ALL: todos los filtros y subniveles folders | pass | 22 interacciones: desplegables, chips, limites, ampliacion, fechas y guardar/limpiar |
| track-menu | ALL: archivo fisico Compartir | fail | No solicita guardar archivo |
| batch-menu | ALL: archivo fisico Compartir selección como ZIP | pass | Boton pulsado y archivo real guardado (3946 bytes) |
| lyrics-menu | ALL: archivo fisico Exportar archivo .LRC | pass | Boton pulsado y archivo real guardado (67 bytes) |
| metadata-editor | ALL: elegir y quitar caratula y botones de copiar campos | pass | Comprobación completada |
| canvas-duplicate | ALL: cancel | pass | Comprobación completada |
| canvas-duplicate | ALL: existing | pass | Comprobación completada |
| canvas-duplicate | ALL: upload | pass | Comprobación completada |
| custom-date | ALL: calendario meses dias inicio fin aplicar y cancelar | pass | Navegacion mensual, selector rapido, dias habilitados, aplicar y cancelar |
| track-menu | ALL: quitar de playlist y alternar favoritos y aleatorio | pass | Comprobación completada |
| tag-manager | ALL: asociar y desasociar album | pass | Comprobación completada |
| tag-manager | ALL: asociar y desasociar batch | pass | Comprobación completada |
| queue | ALL: eliminar deshacer reordenar reproducir e interruptor final | pass | Comprobación completada |
| track-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| album-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| artist-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| folder-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| playlist-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| lyrics-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| artists-list | ALL: cerrar con X y Escape | pass | Comprobación completada |
| sleep-timer | ALL: cerrar con X y Escape | pass | Comprobación completada |
| speed-pitch | ALL: cerrar con X y Escape | pass | Comprobación completada |
| library-tabs-order | ALL: cerrar con X y Escape | pass | Comprobación completada |
| app-tabs-order | ALL: cerrar con X y Escape | pass | Comprobación completada |
| home-sections | ALL: cerrar con X y Escape | pass | Comprobación completada |
| swipe-action | ALL: cerrar con X y Escape | pass | Comprobación completada |
| sort-modal | ALL: cerrar con X y Escape | pass | Comprobación completada |
| metadata-editor | ALL: cerrar con X y Escape | pass | Comprobación completada |
| playlist-selector | ALL: cerrar con X y Escape | pass | Comprobación completada |
| tag-manager | ALL: cerrar con X y Escape | pass | Comprobación completada |
| tag-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| player-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| batch-menu | ALL: cerrar con X y Escape | pass | Comprobación completada |
| advanced-tag-search | ALL: cerrar con X y Escape | pass | Comprobación completada |
| edit-alias | ALL: cerrar con X y Escape | pass | Comprobación completada |
| clear-queue | ALL: cerrar con X y Escape | pass | Comprobación completada |
| canvas-manager | ALL: cerrar con X y Escape | pass | Comprobación completada |
| track-details | ALL: cerrar con X y Escape | pass | Comprobación completada |
| notification-settings | ALL: cerrar con X y Escape | pass | Comprobación completada |
| queue-destination | ALL: cerrar con X y Escape | pass | Comprobación completada |
| player | Canvas fits panel and preserves colors | pass | Canvas llena el panel, conserva color arriba y oscurece controles; galería de tres columnas en tres niveles de zoom |
| layout | Panel boundaries across zoom levels | pass | Comprobación completada |
| tag-manager | Tag form contextual sublevel lifecycle | pass | Comprobación completada |
| player | Desktop shared transport and easter egg | pass | Un único transporte en footer; thumb y color del álbum verificados y restaurados |
| switches | Transparent hit targets keep track and thumb visible | pass | Pantalla y sheet: clic funcional, pista y círculo visibles; píxeles reales encendido/apagado al 70%, 100% y 130% |
| sidebar | Pinned shortcuts navigation persistence and live updates | pass | Cinco tipos de acceso, menús reales, rutas, persistencia, renombrado, orden y modo compacto |
| collaborators | Snapshot player and Windows media metadata update | pass | SQLite real → snapshot → barra inferior, PlayerScreen y Media Session de Windows; actualización sin cambiar canción |
| notifications | Automatic summaries preferences unread state and navigation | pass | Ciclo real de PC con reloj aislado: resúmenes según historial, preferencias desde sheet, sin duplicados, contador reactivo, lectura y navegación al resumen y cambio de año |
| sharing | Song lyrics and activity cards export complete PNG files | pass | Tres pantallas reales exportan PNG 1440×2560 en distintos zooms; portada, texto y marca inferior completos. También captura JPEG sin portada con icono |
| lyrics | Physical LRC roundtrip and automatic queue prefetch | pass | Importación desde sheet y LRC físico UTF-8 con BOM, exportación nativa sin alterar tiempos, cancelación, precarga automática y reutilización de caché al avanzar/cambiar cola |
| storage | Real disk, category sizes, file filters and existence | pass | Capacidad real, desglose exacto por bytes, filtros mínimo/máximo, rutas de audio virtuales y físicas, archivos borrados y pantalla de almacenamiento |
| backup | JSON and ZIP export, restore and music ZIP import | pass | Exportación nativa JSON/ZIP, medios restaurados, reemplazo y fusión con conflictos en SQLite e importación y escaneo de ZIP musical |
| lyrics-documents | REPAIR: editar guardar reabrir y proteger cambios | pass | Editar y persistir texto real; reapertura, cancelar salida, descartar por barra lateral y volver sin cambios |
| lyrics-documents | REPAIR: sincronizar marcar deshacer reiniciar y guardar LRC | pass | Cancion real del reproductor, seek, dos marcas, deshacer, reinicio cancelado/confirmado y LRC persistido |
| lyrics-documents | REPAIR: confirmacion de borrado traducida en tres idiomas | pass | Comprobación completada |
| metadata-editor | REPAIR: buscar caratula real guardar y cancelar sustitucion | pass | Deezer real, descarga, previsualizacion, guardado fisico y confirmacion de reemplazo cancelada |
| player-appearance | APPEARANCE: cover visible sin parpadeo al redimensionar y volver | pass | Pixeles reales, imagen de album, 454 frames vigilados, tres zooms, arrastres y retorno de ventana sin remontar ni ocultar |
| player-appearance | APPEARANCE: cd visible sin parpadeo al redimensionar y volver | pass | Pixeles reales, imagen personalizada de CD, 458 frames vigilados, tres zooms, arrastres y retorno de ventana sin remontar ni ocultar |
| player-appearance | APPEARANCE: vinyl visible sin parpadeo al redimensionar y volver | pass | Pixeles reales, imagen de album, 466 frames vigilados, tres zooms, arrastres y retorno de ventana sin remontar ni ocultar |
| player-appearance | APPEARANCE: cassette visible sin parpadeo al redimensionar y volver | pass | Pixeles reales, imagen de album, 476 frames vigilados, tres zooms, arrastres y retorno de ventana sin remontar ni ocultar |
| player-appearance | APPEARANCE: cd animacion reproduce pausa y progreso | pass | Giro en reproduccion y congelacion en pausa |
| player-appearance | APPEARANCE: vinyl animacion reproduce pausa y progreso | pass | Giro en reproduccion y congelacion en pausa |
| player-appearance | APPEARANCE: cassette animacion reproduce pausa y progreso | pass | Giro en reproduccion y congelacion en pausa; cinta transferida segun progreso |
| player-appearance | APPEARANCE: canvas estable al redimensionar y volver | pass | 490 frames sin recrear ni recargar el video |

## Ejecuciones de evidencia

La pasada completa se complementa con recomprobaciones tras ajustar el test o corregir la app. Los informes originales se conservan; cada resultado recomprobado identifica su ejecución en el JSON.

- [Informe original](C:/Users/peper/Desktop/mmplayer/.tmp/desktop-sheets/audit-2026-10-29-repairs/report.json)
- [Informe original](C:/Users/peper/Desktop/mmplayer/.tmp/desktop-sheets/1793285714071/report.json)
