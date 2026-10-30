# Escritorio: accesos fijados y colaboradores (2.7 y 2.8)

## Comportamiento

- La barra lateral muestra únicamente elementos fijados, ordenados por nombre según el idioma activo. Incluye playlists, etiquetas y carpetas, además de los álbumes y artistas que ya se pueden fijar en la biblioteca.
- Cada tipo tiene un icono; en la barra compacta se conserva el icono y el nombre aparece al pasar el ratón. Pulsar abre su pantalla y el menú contextual permite desfijar.
- Playlists, álbumes y artistas usan su `isPinned` existente en SQLite. Etiquetas y carpetas tienen una nueva acción de fijar/desfijar en sus menús de PC; sus accesos se guardan en las preferencias de escritorio. No se modifica el esquema móvil. Las etiquetas reflejan cambios de nombre y desaparecen si se eliminan.
- El snapshot de canciones incluye el artista principal y todos los colaboradores existentes, sin duplicados. Esa información llega al reproductor persistente y a Media Session, que Chromium publica en los controles multimedia del sistema.
- El escáner lee también los valores múltiples de artistas y elimina relaciones antiguas cuando cambian los créditos del archivo.
- La reparación de colaboradores de PC vuelve a leer los archivos disponibles, reconstruye sus créditos y actualiza el artista principal. Conserva títulos editados, letras, valoraciones y otras propiedades de usuario. Los archivos que no se pueden leer se conservan sin cambios.
- Se corrige el paso de `route` y `navigation` a las pantallas compartidas; el detalle de etiquetas necesitaba recibir `route` como propiedad.

## Verificación

- 37 pruebas de escritorio correctas, incluida una con MP3 físico y SQLite: importación de artistas múltiples, eliminación de duplicados, sustitución de colaboradores obsoletos, reparación repetida, conservación de datos editados y eliminación de créditos tras cambiar el archivo y escanear. También verifica `isPinned`, persistencia de accesos al recargar preferencias y normalización de entradas duplicadas/inválidas.
- Electron con perfil y música aislados: fijar y abrir los cinco tipos de acceso desde sus menús reales; persistencia de etiquetas/carpetas; desfijar; actualización del nombre; orden alfabético y barra compacta.
- Electron: cambios reales en SQLite llegan al snapshot, barra inferior, PlayerScreen y `navigator.mediaSession.metadata`, incluida la eliminación de un colaborador sin cambiar de canción. Se ejecuta también la reparación a través del adaptador de escritorio y su comunicación con el proceso de biblioteca.
- Se comprueba el contenido de Media Session; no se inspecciona visualmente el panel multimedia de Windows.
- Comprobación de tipos y compilación de escritorio.

«Abrir con MMPlayer» (2.6) permanece pendiente por decisión del usuario.
