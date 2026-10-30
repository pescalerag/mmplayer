# Easter eggs por álbum

Los añadimos en las actualizaciones y se activan automáticamente, sin ajustes
ni datos nuevos en la DB. La coincidencia exige el título del álbum y el artista
principal ya observados en PlayerScreen. Se normalizan mayúsculas, Unicode y
espacios; no se eliminan sufijos de edición ni se aceptan coincidencias parciales.

Para añadir otro:

1. Guardar su PNG con transparencia en `src/assets/easter-eggs/`.
2. Exportar la imagen desde `albumEasterEggAssets.ts` (asset nativo) y
   `albumEasterEggAssets.web.ts` (el mismo archivo empaquetado por Vite).
3. Añadir una entrada con un `id` único, título, artista, color y scrubber en
   `ALBUM_EASTER_EGGS`, y cubrir sus coincidencias en los tests.

La selección se memoriza por álbum/artista, fuera de las actualizaciones de
progreso. La apariencia solo afecta al slider de PlayerScreen. El transporte,
las estadísticas, los saltos y AB siguen usando los mismos controles.

En Android el slider no recibe `thumbTintColor` cuando hay imagen. También se
recrea al cambiar de estilo, porque la versión instalada de react-native-slider
conserva el drawable anterior al quitar `thumbImage`; así se recupera el círculo
normal al salir del álbum.

`patches/@react-native-community+slider+5.0.1.patch` adapta la resolución de
`thumbImage` a RN 0.81, siguiendo la corrección oficial #736. Incluye `src` y
`dist`: Metro utiliza el JavaScript ya compilado de esta dependencia. El
procesador nativo debe admitir tanto un export CommonJS como `default`.
