# Limpieza de ajustes exclusivos de PC

Se ocultan en escritorio, conservándolos en móvil:

- Gestos de deslizamiento en el menú de Ajustes.
- Mantener la pantalla encendida en Visualización (el adaptador de PC no aplica ese ajuste).
- Registros/pruebas del diagnóstico móvil en Depuración (la captura de errores nativos Android y su runner no están integrados en PC).
- Reparación de carátulas vacías: el adaptador de escritorio devuelve cero sin realizar ninguna reparación.
- Borrado total: la acción invoca un método que no existe en el adaptador del escáner de PC.

Se conservan normalización, ReplayGain, ecualizador, atenuación, crossfade, exclusiones, descarga de imágenes/carátulas, almacenamiento, backups e importación ZIP, idioma, Discord, cierre a bandeja, historial y reparación de colaboradores. En Visualización se mantienen las letras, los colores, la posición del perfil, el orden de biblioteca, el orden de navegación lateral y las secciones de Inicio, que sí tienen efecto en PC.

Los textos de almacenamiento, navegación y depuración se adaptan al escritorio en ES/EN/PT.

Verificación con la interfaz real de Electron: `.tmp/desktop-sheets/1793309783394/report.json`, una prueba correcta en los tres idiomas. Comprueba la ausencia de opciones retiradas y la presencia de las útiles, y abre realmente la sheet de orden de navegación. Comprobación de tipos y compilación correctas.

Comando: `npm run test:sheets --workspace=@mmplayer/desktop -- --filter SETTINGS-PC:`.
