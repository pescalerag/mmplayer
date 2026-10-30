# Vistas del reproductor de PC y estabilidad del panel

## Cambios

- CD y vinilo usan una máscara circular CSS en PC. La implementación web de MaskedView solo dibujaba la máscara y omitía el disco y su imagen. El nuevo adaptador conserva tanto el contorno como el orificio transparentes; en móvil se mantiene la máscara nativa.
- El CD respeta su imagen personalizada y usa la portada del álbum si no hay una. El vinilo usa la portada en su etiqueta y el casete conserva la imagen y la opción de mostrar el nombre del álbum.
- Las animaciones declaran sus dependencias compartidas para que se actualicen también en el renderer web, que no utiliza la transformación de worklets del build móvil. El callback de las bobinas permanece estable entre actualizaciones de progreso.
- CD, vinilo y bobinas giran al reproducir y conservan su posición al pausar. Los rollos de cinta cambian de tamaño con el progreso.
- El layout de PC conserva la medida disponible durante los cambios de tamaño. Ya no oculta la carátula mientras llega una nueva medición ni escribe una entrada persistida por cada ancho del panel.
- La recuperación visual por AppState queda reservada al móvil. PC no remonta el fondo o la carátula al recuperar la ventana ni reinicia la sincronización móvil. Sus vistas estilizadas se dibujan sin la barrera de opacidad de la animación de entrada nativa.
- La ventana principal mantiene habilitado el renderer durante la pérdida de foco, sin la suspensión de frames de Chromium en segundo plano.

## Verificación

**8 pruebas de Electron correctas**, con perfil y archivos aislados:

1. Portada: píxeles de imagen reales; tres niveles de zoom; arrastres del borde; ocultación y recuperación real de la ventana; transición controlada de AppState.
2. CD: imagen personalizada comprobada por color, SVG y máscara presentes, alternativa sin imagen y las mismas comprobaciones de estabilidad.
3. Vinilo: etiqueta con la portada real, SVG y máscara presentes, alternativa sin imagen y estabilidad.
4. Casete: cuerpo, bobinas e imagen visibles, alternativa sin imagen y estabilidad.
5. CD: giro al reproducir, congelación al pausar y estabilidad durante el redimensionado en reproducción.
6. Vinilo: giro, pausa y estabilidad en reproducción.
7. Casete: giro, pausa, estabilidad en reproducción y transferencia de cinta al buscar diferentes posiciones.
8. Canvas: mantiene el mismo elemento de vídeo, sin eventos de recarga, al arrastrar, cambiar el zoom y recuperar la ventana.

Los casos visuales vigilan más de 2.000 frames en conjunto, además de los casos de animación. Comprueban que los elementos sigan montados y que sus contenedores no se oculten. Se prueban zooms del 70 %, 100 % y 130 %. Las animaciones se verifican con un WAV real de doce segundos; los fixtures MP3/FLAC anteriores duraban aproximadamente un cuarto de segundo.

También pasan **42 pruebas de comportamiento visual/móvil**, **38 de escritorio**, la comprobación de tipos y la compilación normal. Los tests de móvil conservan la recuperación tras volver del segundo plano y las máscaras nativas.

```powershell
npm run test:sheets --workspace=@mmplayer/desktop -- --filter 'APPEARANCE:'
```

Evidencia de la pasada final: `.tmp/desktop-sheets/1793285714071/report.json`, capturas `canvas-appearance-*` y registro de consola en el mismo directorio.
