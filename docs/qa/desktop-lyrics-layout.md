# Margen de LyricsScreen en PC

El margen izquierdo pasa de 28 a 48 px en escritorio, para letras sincronizadas y texto sin sincronizar. El margen derecho sigue en 28 px y el móvil conserva sus márgenes.

Validación mediante la ventana real de Electron: 900×640, 1280×800 y 1920×1080, cada una al 70 %, 100 % y 130 % de zoom, en ambos formatos (18 combinaciones). Se comprueban los márgenes, la presencia del texto, la adaptación de frases largas y la ausencia de desbordamiento horizontal.

Resultado: 2 pruebas correctas, 0 fallos. Revisadas también capturas de la ventana estrecha al 130 % y de la amplia al 100 %. Comprobación de tipos y compilación correctas.

Comando: `npm run test:sheets --workspace=@mmplayer/desktop -- --filter LYRICS-LAYOUT`

Informe y capturas: `.tmp/desktop-sheets/1793287499852/`.
