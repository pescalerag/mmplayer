# MMPlayer Desktop

Port React Native Web + Electron, en preparación de la primera beta para Windows.
La primera beta se distribuye sin firma pública por decisión del titular.
LocalCast, Chromecast y funciones Supporter/VIP están excluidos del alcance.

> Distribución beta de Windows: se han añadido instalador y aceptación del paquete.
> La firma pública queda para una versión posterior. Véase la
> [guía actual de lanzamiento](../../docs/desktop-beta-release.md). Las listas de
> etapas de este documento son históricas y algunas funciones ya se completaron.

## Ejecutar

Desde la raíz del repositorio, con Node 24:

```sh
npm install --legacy-peer-deps
npm run desktop
```

Electron compila primero la interfaz y los procesos. No necesita Metro ni un servidor de desarrollo para ejecutarse. El primer arranque puede descargar el runtime oficial de Electron. Las compilaciones quedan en `apps/desktop/build/` y están excluidas de Git.

```sh
npm run desktop:build
npm run desktop:typecheck
npm run desktop:test
npm run test:electron --workspace=@mmplayer/desktop
```

La última orden prueba la aplicación Electron real con un WAV generado, audio silenciado y un perfil separado dentro de `.tmp/desktop-electron-test`. No utiliza la biblioteca del usuario.

## Arquitectura actual

- `src/main/main.ts`: ventana única, bandeja opcional, diálogos, IPC con comprobación de emisor y protocolos privados. Renderer aislado, sin Node ni acceso directo al disco.
- `src/main/libraryWorker.ts`: único propietario de la base de datos y escaneo fuera de la interfaz. Usa los modelos, esquema y migraciones actuales de WatermelonDB. Solo se envían datos serializables a la interfaz.
- `src/main/sqliteBinding.ts`: superficie del driver Node usada por WatermelonDB sobre `node:sqlite`, dentro del worker. No requiere addons compilados por ABI. SQLite sigue siendo experimental en Node 24; validar este adaptador antes de distribución.
- `scripts/build.mjs`: adapta en el bundle de escritorio dos incompatibilidades del driver Node de WatermelonDB con Windows (rutas de unidad y cierre de conexiones durante setup). No modifica `node_modules` ni el adaptador Android.
- `src/renderer`: marco de escritorio, navegación, menús y un único transporte. `MobileScreenHost.tsx` importa directamente las pantallas de `src/screens`: Inicio, Biblioteca, Buscar, Etiquetas, Estadísticas, Letras, PlayerScreen, Notificaciones y detalles. Se han retirado las versiones alternativas de esas pantallas que se habían creado inicialmente.
- `src/renderer/ports`: adaptadores exclusivos del bundle web para el reproductor, SQLite, planificación de consultas y navegación. Las pantallas siguen utilizando sus componentes, estilos, modelos, servicios de consulta y observables originales. Vite selecciona implementaciones `.web` de las librerías y transpila los decoradores de los modelos.
- `ports/databaseAdapter.ts`: conserva la identidad de los modelos del renderer y transmite las operaciones al único SQLite del worker; entrega los cambios externos a los observables de WatermelonDB. El enlace de notificaciones utiliza la API interna de entrega de cambios de la versión instalada: debe verificarse al actualizar WatermelonDB. El test de integración comprueba identidad, observación y ausencia de eventos duplicados.
- `packages/core`: implementación común de letras, timestamps, valoraciones y aleatorio; las importaciones antiguas de Android se conservan mediante reexportaciones.
- `packages/data`: construcción común de la DB y servicio de playlists con recursos de plataforma inyectados. Android sigue usando la misma API pública.
- `packages/ui`: primeros componentes de presentación extraídos del móvil sin dependencias de sus stores.
- `packages/platform`: contratos IPC, datos y preferencias tipados.

La aplicación móvil mantiene temporalmente su entrada y configuración en la raíz. Moverla de golpe a `apps/mobile` cambiaría rutas del proyecto nativo, scripts y plugins. Ese traslado se realizará como una etapa verificable posterior; no se ha duplicado su código.

## Disponible en esta etapa

- Ventana sin barra de título del sistema. Barra negra arrastrable con controles propios de minimizar, maximizar/restaurar y cerrar, sin título ni icono. El lateral muestra la M transparente y no incluye controles de zoom. Los controles de ventana conservan su tamaño al cambiar el zoom.

- Arranque de Electron en Windows, panel lateral, área central y reproductor derecho ocultable; barra inferior persistente.
- Paneles ajustables y preferencias persistidas. Historial por sección con Atrás/Adelante dentro de los headers originales. Biblioteca sin vista de tabla.
- Zoom nativo de Chromium persistente (50–130 %), mediante Ctrl + / Ctrl − / Ctrl 0. El 100 % es el tamaño normal, independiente de la ventana y del DPI del sistema. La interfaz ocupa toda el área cliente, sin lienzo fijo ni bandas sobrantes; redimensionar redistribuye el contenido sin cambiar el zoom. La biblioteca calcula las columnas con un mínimo de 180 píxeles CSS por tarjeta y conserva las portadas cuadradas. Los paneles se ajustan al espacio disponible, el lateral pasa a iconos y el reproductor derecho se contrae temporalmente cuando no caben ambos; sus anchos y visibilidad preferidos se conservan al ampliar. Se usa [el zoom nativo de Electron](https://www.electronjs.org/docs/latest/api/web-contents#contentssetzoomfactorfactor), también para menús, modales y coordenadas del puntero, sin multiplicar otra vez las métricas React Native.
- Selector de archivos/carpetas, lectura de metadatos y carátulas, escaneo al arrancar y manual. Archivos referenciados, sin copiarlos.
- Persistencia SQLite, recuperación entre sesiones y canciones no disponibles al desconectar carpetas, conservando anotaciones.
- Pantallas originales de Biblioteca y Buscar, con sus listas virtualizadas, tarjetas, carruseles y filtros. Álbumes, artistas principales, playlists, favoritas, etiquetas, listas inteligentes y estadísticas consultan la DB mediante los servicios existentes. Los filtros dependientes del tamaño físico del archivo requieren todavía el adaptador de filesystem.
- Crear playlists/etiquetas, asignar etiquetas, valorar y quitar varias canciones de una playlist. Las playlists usan el servicio compartido y conservan su portada inicial.
- Transporte de audio local mediante Chromium, progreso, volumen, controles multimedia del sistema mediante Media Session, cinco colas guardadas y cambio pausado.
- Cola con la misma `QueueSheet` del móvil, integrada sobre toda la altura del panel derecho: pestañas de cola/historial, selector de cinco colas, renombrado, reset, guardado en playlists, gestión manual/contextual, borrado con deshacer, arrastre y aleatorio al finalizar. El adaptador publica los metadatos completos y mantiene identidades distintas para canciones repetidas. Sin canción, el fondo del panel es morado, coherente con Inicio.
- SMTC de Windows con título, artista, álbum, carátula, posición y velocidad. Anterior/reproducir/pausa/siguiente en la miniatura de la barra de tareas. Ambos controles utilizan el mismo transporte, sin atajos globales que compitan con otras aplicaciones.
- Arrastre externo de archivos o carpetas (también anidadas) sobre cualquier zona: añade a la biblioteca, sin copiar los originales ni modificar las colas o la reproducción. La ruta se obtiene en preload mediante `webUtils.getPathForFile`; no se habilita Node en el renderer.
- Editor de metadatos original, individual y por lote, con escritura física mediante `node-taglib-sharp`, lectura mediante `music-metadata` y actualización incremental de la DB. La planificación de cambios y autonumeración se comparte con Android. Cada archivo se copia a un temporal, se escribe y verifica antes del reemplazo; un fallo conserva el original y continúa con los demás. Se muestra el detalle de los fallos. El progreso se publica durante la escritura; cancelar detiene los siguientes archivos sin deshacer los ya guardados. El rescaneo y la reconciliación de la DB se realizan una sola vez al finalizar el lote.
- PlayerScreen y Letras originales en el panel derecho y central, respectivamente. Barra inferior persistente de escritorio. Letras guardadas, editor de texto, presentación LRC, puntos de salto, seek manual dentro de un tramo y AB básicos.
- Menús flotantes y submenús que cambian de lado al llegar al borde, diálogos y traducciones español/inglés/portugués.
- Prueba inicial de velocidad y ecualización Web Audio. No equivalen aún a todo el motor de Android.

## Pendiente para la paridad acordada

- Validar/seleccionar el backend definitivo de audio para todos los formatos y funciones: pitch independiente, ReplayGain, graves, fades, comportamiento de fin de cola y casos avanzados de AB/timestamps.
- Ampliar la validación de las colas manual/contextual y su historial en todos los recorridos y al recuperar sesiones guardadas.
- Ampliar la validación de escritura de etiquetas a los formatos adicionales: las pruebas verifican MP3 y FLAC, campos no modificados, audio comprimido idéntico, archivos dañados y solo lectura. Completar los selectores de recursos de escritorio para carátulas externas.
- Completar el escaneo de créditos colaboradores, filtros físicos de archivos y acciones de personalización; el escáner ya registra el crédito principal que esperan las filas originales.
- Completar las acciones de las pantallas reutilizadas y los menús de entidades/lotes. Las acciones todavía sin adaptador muestran un aviso explícito. Ajustes comparte `SettingsScreenView` con Android; importación/exportación y varias subpantallas siguen pendientes.
- Importación/exportación JSON y ZIP, traslado de recursos y reasignación de rutas de copias Android.
- Obtención de letras y carátulas, editor de sincronización de letras, perfil, notificaciones internas y demás funciones aplicables.
- Efectos de visualización permitidos para el tier gratuito y opciones correspondientes; las funciones de pago permanecen ocultas.
- Asociación de archivos y apertura por sistema.
- Instaladores, actualizaciones estable/beta, pruebas reales en Linux y mediciones con 10.000 canciones en el equipo mínimo.

No anunciar paridad de formatos por aceptar una extensión en el selector: el decodificador debe validarse por formato. Esta etapa tampoco acredita bit-perfect, salida exclusiva ni reproducción sin cortes.

## Datos y pruebas

La escritura física usa `node-taglib-sharp` 6.0.3, con licencia LGPL-2.1-or-later. Se mantiene como dependencia externa del bundle nativo y su licencia se conserva en `third-party/node-taglib-sharp-LICENSE`; el instalador deberá incluir la dependencia y sus avisos junto al resto de componentes externos. Los dos tonos de prueba son sintéticos y se documentan en `test/fixtures/README.md`.

La sesión SMTC se comprobó también mediante la API de Windows: la fuente `com.pescalerag.mmplayer.desktop` aceptó reproducir y pausar y devolvió `Playing` y `Paused`. La prueba normal de Electron permanece silenciada. Para la comprobación específica del sistema, `MMPLAYER_DESKTOP_SMTC_HOLD=1` permite mantener brevemente el tono de prueba audible y consultar esa sesión; sigue usando su propio perfil de pruebas.

Referencias de estas integraciones: [Media Session](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession), [barra de tareas de Electron](https://www.electronjs.org/docs/latest/tutorial/windows-taskbar), [rutas de archivos arrastrados](https://www.electronjs.org/docs/latest/api/web-utils) y [TagLib para Node](https://github.com/benrr101/node-taglib-sharp).

Las sheets reutilizan sus componentes de Android y se presentan en un portal fuera del diseño de la ventana. En escritorio, `DesktopMenuStack` conserva cada padre con sus propios datos; `useSheetProps` se adapta mediante Vite para que un hijo no sustituya las propiedades del padre. Los menús se anclan al control pulsado, continúan hacia el lado disponible y se limitan al tamaño de la ventana, con scroll sin barras visibles. Escape cierra un nivel y pulsar fuera cierra el recorrido. Los formularios compartidos de etiquetas, color, fechas y nombres de cola usan otra capa sobre los menús. Android conserva su ciclo de cierre y transición.

El recorrido TrackMenu → playlists → crear playlist está cubierto en Electron: conserva los tres componentes, comprueba sus límites, el cierre por niveles y que la geometría de la pantalla principal no cambia. Las pruebas de estado comprueban también sustitución de hermanos y aislamiento de datos entre aperturas.

El perfil normal se guarda en la carpeta de datos de usuario `MMPlayer Desktop`, separada de Android. Contiene `library.db`, `library-files.json`, carátulas y `settings.json`.

Las pruebas de integración usan una carpeta propia en `.tmp`, crean WAVs y una DB reales y comprueban rangos HTTP, conservación tras desconectar/reconectar, favoritos, notas, playlists, etiquetas, persistencia, identidad de modelos y observación de cambios entre renderer y worker. La prueba Electron recorre las pantallas originales y un detalle de álbum, reproduce desde TrackRow, comprueba el favorito en PlayerScreen, mide la carátula cuadrada dentro del panel y verifica el guardado al cerrar. Los artefactos de pruebas no se añaden al repositorio.

Referencias oficiales: [Electron](https://www.electronjs.org/docs/latest/tutorial/process-model), [React Native Web](https://necolas.github.io/react-native-web/docs/), [WatermelonDB](https://watermelondb.dev/docs/Installation), [Node SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).
