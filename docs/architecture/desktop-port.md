# MMPlayer: especificación del port de escritorio

Fecha: 20 de octubre de 2026.

Estado: decisiones de producto y arquitectura registradas. El usuario ha indicado expresamente que NO se inicie todavía la implementación. Esta especificación y sus referencias visuales no autorizan a modificar código, reorganizar el repositorio ni instalar dependencias.

## Plataforma y mantenimiento

- React Native Web + Electron para una aplicación instalable de Windows y Linux. Priorizar Windows y comprobar Linux durante los hitos del desarrollo.
- Un mismo repositorio para facilitar el mantenimiento de ambas aplicaciones.
- Organización acordada: aplicaciones separadas y paquetes compartidos; propuesta de estructura `apps/mobile`, `apps/desktop` y `packages/` para lógica, datos, contratos de plataforma, UI y traducciones. El reparto final de paquetes se concretará durante el diseño técnico.
- Compartir tanta lógica TypeScript como sea posible. Priorizar también la reutilización de pantallas; usar pantallas específicas de escritorio cuando su adaptación no permita una reutilización adecuada. Compartir componentes y lógica incluso en esos casos.
- Desarrollo y actualizaciones de Android y escritorio en conjunto. La primera versión de escritorio debe cubrir todas las funcionalidades de Android aplicables, incluyendo las prestaciones de audio avanzadas, con las exclusiones explícitas de casting y funciones Supporter/VIP que se detallan a continuación.
- LocalCast y Chromecast quedan excluidos de la versión de escritorio. No mostrar sus controles ni inicializar sus servicios en escritorio; conservarlos en Android.
- De momento no se desarrolla una versión de navegador independiente.
- La aplicación puede usarse sin cuenta. No se implementará sincronización PC/móvil en esta fase; conservar una arquitectura que permita incorporarla en el futuro.
- El sistema de tiers, su presentación comercial y todas las funciones Supporter/VIP quedan ocultos en escritorio de momento. No desbloquearlas gratuitamente como sustitución del sistema de compras. Monetización por definir. La implementación debe identificar las restricciones actuales de Android y aplicar esa exclusión en la composición de escritorio sin eliminar el código compartido que necesita el móvil.
- Mantener Android funcional durante la extracción de código común y conservar su sistema comercial actual; los cambios de tiers descritos se refieren a escritorio.

## Biblioteca y persistencia

- Referenciar los archivos de música en su ubicación original, sin copiarlos a una biblioteca administrada.
- Escaneo al iniciar la aplicación y botón de sincronización manual, como en móvil. No añadir seguimiento continuo de carpetas en esta fase.
- Conservar las canciones de discos desconectados, marcándolas como no disponibles. Mantener etiquetas, valoraciones e historial; la desconexión no equivale a un borrado.
- El editor de metadatos modifica los archivos físicos. Indicar explícitamente este comportamiento en la interfaz.
- Mantener las funciones actuales de backup/importación/exportación dentro del alcance de paridad; no confundir transferencia mediante archivos con sincronización automática.
- La selección del motor de datos y audio requiere pruebas de compatibilidad. React Native Web/Electron no garantiza por sí mismo las capacidades actuales de los módulos Android.

## Reproducción e integración del sistema

- Port completo del audio de Android, incluidos ecualizador, graves, velocidad/pitch y demás funciones aplicables. No limitar la primera versión al transporte básico.
- Utilizar la salida de audio predeterminada del sistema en la primera versión.
- Una ventana principal y una instancia de aplicación. Abrir archivos dirige la acción a esa instancia; el comportamiento de cola concreto aún no se ha especificado.
- Cerrar la ventana cierra la aplicación de forma predeterminada; ofrecer en ajustes cerrar a la bandeja.
- El reproductor compacto es la barra inferior persistente descrita a continuación; no se ha aprobado una ventana adicional independiente.
- Restaurar la última sección abierta y su estado cuando sea posible. Esto no implica reanudar el audio automáticamente.
- Cada sección conserva su recorrido de navegación; disponer de Atrás/Adelante.

## Diseño e interacción acordados

- Navegación lateral izquierda, pantalla actual en el centro y PlayerScreen ocultable a la derecha.
- Reproductor inferior persistente siempre abierto, también con PlayerScreen derecho visible. Controles confirmados: carátula, título/artista, anterior, play/pausa, siguiente, progreso, volumen y corazón de me gusta. Ambos reproductores reflejan y controlan una misma sesión de reproducción.
- Barra lateral: secciones principales y accesos fijados a playlists, etiquetas o carpetas.
- LyricsScreen se abre en el panel central.
- La cola y las sheets/opciones de PlayerScreen se superponen al reproductor derecho, en lugar de sustituir el contenido central.
- Presentación de biblioteca con selector entre vista como en móvil (predeterminada) y tabla.
- Un clic en una canción reproduce. La selección utiliza casillas o un modo explícito.
- Opciones como menús contextuales flotantes por niveles, calculando su posición según el espacio disponible. Cuando sea necesario, modal flotante por encima de la UI.
- Los mockups muestran identidad visual de MMPlayer, menús oscuros, colores de acento, degradados y fondo del reproductor adaptado a la portada. Su implementación respeta la exclusión temporal de funciones Supporter/VIP; los mockups no desbloquean funciones restringidas.
- Los textos auxiliares del primer mockup describen zonas de la interfaz. Los textos accidentales, valores de ejemplo o claves de traducción visibles en las imágenes no se consideran requisitos literales.
- Paneles redimensionables con persistencia de sus anchuras. En ventanas estrechas, compactar la barra izquierda y permitir ocultar el reproductor derecho, conservando espacio útil para el panel central.
- Al abrir la cola desde la barra inferior con el reproductor derecho oculto, desplegar primero ese panel y presentar la cola por encima de él. Aplicar el mismo criterio a las opciones del reproductor que se alojan en ese panel; no se ha añadido un botón de cola a la lista de controles inferiores confirmados.

## Validación y distribución

- Equipo mínimo de referencia aceptado para pruebas: 8 GB de RAM, gráfica integrada, pantalla de 1366 × 768 y biblioteca de 10.000 canciones; ampliar con pruebas de estrés.
- Estos valores son una referencia de validación, no un compromiso medido de consumo ni un bloqueo técnico a otros equipos.
- Distribución inicial: instalador Windows y un formato Linux por acordar; canales estable/beta; avisar de actualizaciones y aplicarlas al reiniciar, sin interrumpir la reproducción.
- Mantener aislamiento de Electron, comunicación tipada, propiedad clara de las escrituras y trabajo pesado fuera de la interfaz. El reparto de procesos se justificará en pruebas; no multiplicarlos innecesariamente.

## Referencias visuales aportadas por el usuario

Se conservan copias dentro del repositorio para no depender de rutas temporales del portapapeles.

1. [Distribución general](desktop-mockups/01-layout.png): barra lateral, contenido central, reproductor derecho ocultable y reproductor inferior siempre abierto.
2. [Inicio y reproductor](desktop-mockups/02-home-player.png): secciones de Home, biblioteca local, degradado y reproductor derecho.
3. [Letras en el centro](desktop-mockups/03-lyrics.png): LyricsScreen central con reproductor derecho persistente.
4. [Menús por niveles](desktop-mockups/04-context-menus.png): menú de canción, selector de playlists y creación como superficies flotantes encadenadas.

## Aclaraciones cerradas antes de implementar

Las cuatro dudas planteadas se han resuelto: funciones Supporter/VIP ocultas, Chromecast excluido, controles y persistencia de la barra inferior confirmados, y adaptación de paneles aprobada. No hay dudas bloqueantes de producto en este punto.

Siguen requiriendo diseño técnico y validación la elección de motores y adaptadores, los límites de anchura y el formato concreto de distribución Linux. Esto no modifica los acuerdos anteriores ni autoriza a empezar la implementación: se mantiene la instrucción de esperar.

## Documentación de referencia del análisis previo

- [React Native Web](https://necolas.github.io/react-native-web/docs/).
- [Modelo de procesos de Electron](https://www.electronjs.org/docs/latest/tutorial/process-model).
- [Aislamiento de Electron](https://www.electronjs.org/docs/latest/tutorial/security).
- [Monorepos con Expo](https://docs.expo.dev/guides/monorepos/).
- [WatermelonDB: Windows experimental y SQLite en Node](https://watermelondb.dev/docs/Installation).
- [Spotify: organización de biblioteca y panel de reproducción](https://newsroom.spotify.com/2023-06-20/spotify-desktop-experience-redesign-your-library-now-playing-views-customize/).
- [Discord: móvil React Native y escritorio React](https://discord.com/blog/supercharging-discord-mobile-our-journey-to-a-faster-app).
- [VS Code: aislamiento y separación de procesos](https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox).
