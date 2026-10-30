# Menús contextuales con clic derecho

Las tarjetas y filas compartidas que ya tienen una acción de pulsación larga la exponen también mediante clic derecho en PC: Inicio, Biblioteca, búsqueda, etiquetas, detalles de artista/carpeta/etiqueta, historial y tarjetas de Canvas. La pulsación larga permanece disponible. Los controles de arrastre y A-B conservan su comportamiento específico.

El adaptador web de los componentes pulsables escucha el evento DOM `contextmenu` en el propio elemento: React Native Web sustituye el prop `onContextMenu` de TouchableOpacity por su manejador interno y por eso no bastaba con añadir ese prop. El adaptador nativo reexporta los componentes originales. Se conservan las referencias y no se añaden contenedores que alteren el diseño.

El menú raíz de un clic derecho usa un ancla puntual en `clientX/clientY`, limitada a los bordes visibles de la ventana. Los submenús siguen anclados a su menú padre. Las filas de canciones conservan su callback original y el ID de playlist; se elimina el segundo manejador global que abría otro menú asincrónicamente y perdía ese contexto.

Verificación con entrada nativa de Electron: `.tmp/desktop-sheets/1793309375053/report.json`, 2 pruebas correctas:

- Clic derecho en álbum, artista, playlist, carpeta, etiqueta y tarjeta reciente; posición del ratón, apertura única y ausencia de reproducción accidental.
- Pulsación larga en álbum y canción.
- TrackRow en una playlist abre una sola vez, conserva «Quitar de playlist» y permite abrir el selector como submenú con su padre.

Comprobación de tipos, compilación y las 40 pruebas de escritorio correctas.

Comando dirigido: `npm run test:sheets --workspace=@mmplayer/desktop -- --filter CONTEXT-MENUS:`.
