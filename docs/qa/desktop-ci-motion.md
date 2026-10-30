# CD/vinilo y movimiento reducido en el runner de Windows

El job `124136538350` del run `41077231680` falló en dos de los 50 casos de sheets.
El audio estaba reproduciéndose (`playing:true`, sin error), pero las transformaciones
de CD y vinilo quedaban en 360°/720°: matrices identidad en ambas muestras.

Se reprodujo localmente forzando `prefers-reduced-motion: reduce` en el proceso
aislado de Electron. Antes del arreglo: **0 correctas, 2 fallidas**, con el mismo
mensaje y transformaciones que CI. Evidencia:
`.tmp/desktop-sheets/1793373391529/report.json`.

El test presuponía animaciones permitidas, mientras Reanimated seguía la preferencia
de accesibilidad del sistema. El harness ahora monta el componente público
`ReducedMotionConfig` exclusivamente en el renderer inyectado de pruebas. La
comprobación de giro usa modo `Never`; la segunda pasada usa modo `System` con la
preferencia reducida forzada para comprobar que CD y vinilo permanecen quietos.
El modo se configura solo durante cada caso de animación y se restaura a `System`
al terminar, conservando el entorno del resto de la auditoría.
El audio, play/pausa y la estabilidad al redimensionar/cambiar de ventana se siguen
verificando en ambos recorridos. No se omiten tests ni se cambia el código de la app.

La comprobación de giro espera un cambio real de transformación dentro de un
límite, sin depender de capturar dos fotogramas a intervalos fijos de 60/220 ms.
Las pausas conservan su comprobación de inmovilidad.

Los clics contextuales esperan a que la capa anterior desaparezca y a que el
destino esté estable y reciba realmente el punto de entrada. Esto evita medir el
menú enviando eventos a una escena inactiva o tapada después de las transiciones.

No se modifica ningún ajuste de Windows. En producción, MMPlayer conserva el
comportamiento de accesibilidad del usuario. El build normal se restaura al terminar
y no contiene el controlador de movimiento de las pruebas.

Comando de aceptación, que incluye ambos modos:

```powershell
npm run desktop:test:beta
```

Modos disponibles para una ejecución individual:

- `MMPLAYER_SHEET_SYSTEM_REDUCED_MOTION=1`: emula el runner mediante un argumento
  del proceso de Electron de pruebas.
- `MMPLAYER_SHEET_MOTION_MODE=never|system|always`: configura Reanimated solo en
  el renderer de auditoría. Valor predeterminado: `never`.

El informe y el log `SHEET_MOTION` registran el modo y la preferencia real del
navegador, para identificar futuras diferencias de entorno.

Referencia: [ReducedMotionConfig de Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/).
