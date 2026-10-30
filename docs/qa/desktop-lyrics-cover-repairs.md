# Correcciones de letras y carátulas en PC

## Cambios

- Editar y sincronizar letras usan un adaptador de protección de borradores para la navegación de escritorio. Ya no requieren el contexto del navegador móvil. Las flechas persistentes y las secciones laterales piden confirmar antes de descartar cambios; cancelar conserva el documento y guardar permite salir. La implementación móvil conserva su hook original.
- La confirmación de borrado incorpora las traducciones `actions.warning` y `actions.confirm` en español, inglés y portugués. También quedan traducidas las confirmaciones de reinicio y descarte que usan esas claves.
- La detección de la portada predeterminada admite el recurso estático de Vite sin invocar una API exclusiva de React Native. La versión nativa sigue usando su resolvedor de recursos.

## Comprobaciones

- **6 pruebas en Electron correctas**: búsqueda real y previsualización de Deezer; confirmación de borrado; editor con guardado, reapertura, cancelar, descartar y volver sin cambios; sincronizador con canción real, seek, dos marcas, deshacer, reinicio cancelado/confirmado y persistencia de LRC; traducciones en tres idiomas; descarga y guardado físico de carátula con cancelación de sustitución.
- **38 pruebas de escritorio correctas**, incluida la protección de la transición de navegación pendiente.
- **17 pruebas de carátulas correctas** en Jest, con comportamiento nativo y ausencia del resolvedor nativo en web, coincidencias de álbum/artista, errores de red, cancelación y guardado.
- Comprobación de tipos y compilación de escritorio correctas. El build de pruebas se sustituye automáticamente por el normal al terminar.

Los perfiles, canciones y cambios usados en estas comprobaciones son desechables. No se modificó la biblioteca del usuario.

Para repetir la verificación dirigida:

```powershell
npm run test:sheets --workspace=@mmplayer/desktop -- --filter 'REPAIR:|Traducciones de confirmación|Buscar carátula en internet'
```
