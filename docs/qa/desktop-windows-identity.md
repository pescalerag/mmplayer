# Identificación de MMPlayer en los controles de Windows

El proceso ya publicaba metadatos mediante Media Session y usaba el identificador
`com.pescalerag.mmplayer.desktop`, pero no tenía una entrada correspondiente en el
catálogo de aplicaciones de Windows. Los controles podían mostrar «Unknown app».

Al arrancar en Windows, antes de crear la ventana, MMPlayer registra un acceso
`MMPlayer.lnk` en el menú Inicio del usuario con ese mismo identificador, nombre y
un ICO generado desde su icono. El acceso usa el ejecutable instalado o Electron
con la ruta absoluta del proyecto en desarrollo. Repara rutas obsoletas y evita
reescribir archivos cuando no cambian. Los detalles de la ventana comparten el
identificador y el icono. Los perfiles aislados de pruebas no reemplazan el acceso
real. No requiere permisos de administrador ni asociaciones de archivos.

Comprobación reproducible en Windows:

```text
npm run test:windows-identity --workspace=@mmplayer/desktop
```

La prueba ejecuta Electron y crea una identidad temporal independiente. Verifica
el acceso y su reparación, el ICO, una reproducción real publicada en SMTC, sus
metadatos y las órdenes de pausar/reproducir desde la API de Windows. Resuelve el
identificador de esa sesión al nombre de la app mediante `shell:AppsFolder`.
Elimina el acceso y los archivos temporales al terminar. Resultado: correcto.

No automatiza una inspección visual del panel emergente de Windows. La instancia
normal debe reiniciarse para registrar su identidad antes de crear su sesión.

Referencias: [accesos directos de Electron](https://www.electronjs.org/docs/latest/api/shell#shellwriteshortcutlinkshortcutpath-operation-options-windows),
[AppUserModelID de Microsoft](https://learn.microsoft.com/en-us/windows/win32/shell/enable-desktop-toast-with-appusermodelid).
