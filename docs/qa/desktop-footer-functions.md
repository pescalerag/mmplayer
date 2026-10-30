# Funciones en el reproductor persistente de PC

- Temporizador, velocidad/tono, letras, A-B, compartir y cola se muestran en ese orden, a la izquierda del volumen. Se conserva el icono compartido de A-B, sus dos puntos y la pulsación larga para desactivarlo.
- Las seis funciones dejan de duplicarse en PlayerScreen de PC. El móvil conserva su fila de controles.
- La cola abre el panel derecho cuando está cerrado. Pulsar otra vez cierra la cola conservando el panel del reproductor.
- Las dos columnas laterales de la barra tienen la misma anchura para centrar el transporte respecto a toda la ventana. En ventanas estrechas, el transporte ocupa una fila centrada y los demás elementos quedan debajo.
- El botón de añadir a playlists aparece junto al corazón y usa el selector compartido con la canción pulsada.
- PlayerScreen reserva un espacio transparente adicional de 16 px bajo la información de la canción.
- El botón de reproductor se retira del panel izquierdo. Una flecha `chevron-up` de 32 px, como la de PlayerScreen orientada hacia arriba, aparece después de la cola y abre/cierra el panel derecho. Las tres acciones inferiores de biblioteca quedan centradas en la barra compacta.

## Verificación

Tres comprobaciones en Electron correctas:

1. Orden y funcionamiento de las seis funciones, estados activos de temporizador/velocidad/letras/cola, A-B con pulsación corta/larga, apertura de compartir y de cola con el panel cerrado; adición real a una playlist mediante el nuevo botón y margen inferior.
2. Ventanas de 1400 y 900 px, con zoom del 70 %, 100 % y 130 %: transporte centrado en la barra completa, funciones antes del volumen, orden visual y ausencia de solapamientos.
3. Un único transporte y slider en el reproductor persistente, conservando el thumb y color de los easter eggs.

Comprobación de tipos y compilación correctas. Las pruebas usan canciones, perfiles y playlists desechables.

Revisión de flecha y centrado: `.tmp/desktop-sheets/1793288712288/report.json`, 3 pruebas correctas. Comprobados apertura/cierre y estado de la flecha, ausencia del botón lateral, orden de los siete controles, transporte centrado, espacio antes del volumen y centrado de las acciones inferiores. Ventanas 900/1400/1600 px y zoom 70/100/130 %. Captura del reproductor revisada.

```powershell
npm run test:sheets --workspace=@mmplayer/desktop -- --filter 'FOOTER:|Desktop shared transport'
```
