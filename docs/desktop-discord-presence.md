# Discord Rich Presence

## Estado

Application ID público: `1565469835033321472`, configurado en `src/config/discord.ts`. No se utiliza la llave pública ni se necesitan tokens de usuario o un bot.

La opción compartida está en **Ajustes > Otros > Discord Rich Presence**, desactivada por defecto, persistida con los demás ajustes. La pantalla, el servicio de reproducción, los metadatos, la selección de carátula y el contenido de la actividad son comunes a PC y móvil.

**PC:** transporte local IPC implementado. Busca las diez ubicaciones de Discord, negocia la conexión, procesa tramas fragmentadas y ping/pong, espera confirmaciones, limita las actualizaciones y reconecta conservando la última canción. No necesita Discord abierto al iniciar MMPlayer; vuelve a intentar la conexión si se abre después. Desactivar la opción o cerrar MMPlayer retira la actividad y desconecta. Pausar también retira la actividad. Las pruebas usan un servidor local aislado, no la cuenta real del usuario.

**Android:** configuración y lógica compartida preparadas, pero el SDK nativo todavía no está incorporado. El adaptador detecta su ausencia y muestra que la conexión aún no está disponible. No se presenta como conectado ni se recurre a tokens de usuario. Esta fase no incluye una prueba de publicación en Discord desde un dispositivo Android.

## Actividad

- `type: 2` (Listening), `name: artista principal`, `status_display_type: 0` (Name).
- `details`: título; `state`: artista principal y colaboradores sin duplicar.
- `assets.large_url`: `https://mmplayer.pescalerag.com`; botón MMPlayer con el mismo destino.
- Tiempos ajustados a posición y velocidad; se actualizan al cambiar de canción, buscar otra posición o cambiar la velocidad.
- Discord necesita una imagen accesible públicamente. Una URL HTTPS pública se usa directamente. Para carátulas locales se consulta Deezer con una coincidencia exacta de álbum y artista principal. Nunca se suben archivos locales. Si no hay coincidencia o conexión se usa el asset `mmplayer`; subir el logo con ese nombre en Rich Presence > Art Assets del portal de Discord.
- La comparación ignora puntuación, acentos y espaciado del catálogo, manteniendo todas las letras y números para distinguir secuelas y ediciones. Por ejemplo, «Hades II Original Soundtrack» coincide con «Hades II: Original Soundtrack», sin confundirse con «Hades: Original Soundtrack». Las búsquedas sin resultado no se conservan permanentemente en caché.
- No se abre una conexión RPC ni se consulta la carátula mientras la opción esté desactivada. El lookup público de carátula se realiza únicamente al activar la integración y reproducir música.

## Conexión nativa pendiente en Android

Discord ofrece Rich Presence sin autenticación en Android desde Social SDK 1.10. El SDK es nativo; no comparte el transporte IPC de Windows. Incorporar sus binarios y su inicialización Android conforme al SDK oficial y exponer un módulo React Native llamado `MMPlayerDiscordPresence` con este contrato:

```ts
configure(applicationId: string): Promise<'waiting_for_discord' | 'connected' | 'native_unavailable'>;
setActivity(activity: DiscordActivity | null): Promise<void>;
disconnect(): Promise<void>;
```

`DiscordActivity` se define en `src/services/discord/activity.ts`. El puente debe mapear `name`, `type`, `status_display_type`, `details`, `state`, `timestamps` (segundos), `assets` y `buttons` a Activity del Social SDK. Con `null`, limpiar Rich Presence; al desconectar, limpiar y liberar el cliente y sus callbacks. No llamar a Connect para la modalidad RPC sin autenticación. Aplicar como mínimo el mismo intervalo de 4,5 s, conservando la última actualización pendiente. No registrar contenido de canciones ni credenciales.

iOS no admite la misma modalidad de Rich Presence sin autenticación; ese transporte necesita un diseño aparte. El adaptador informa `native_unavailable` allí.

## Validación

- Jest: ciclo compartido desactivado/activado, artista principal y colaboradores, pausa y desactivación, cambios rápidos y carátulas tardías; selección pública y caché de carátulas.
- Pruebas de escritorio: payload Listening, tiempos, enlace y exclusión de rutas privadas; servidor IPC real con tramas fragmentadas, ping/pong, reconexión, última canción y desconexión. Suite de 40 pruebas correcta.
- Electron: entrar en Otros desde Ajustes, interruptor apagado inicialmente, activar/desactivar y persistir, reproducción de WAV real, publicación de título/artistas/enlace y retirada al pausar. Informe: `.tmp/desktop-sheets/1793307937492/report.json`, 1 prueba correcta.
- Comprobación de tipos y compilación de PC correctas. No se ha validado todavía la apariencia final en un perfil real de Discord ni un APK con el Social SDK.

### Corrección de carátula y enlace

La consulta real a Deezer para Darren Korb devuelve el título con dos puntos, que antes no coincidía con la etiqueta local. Verificada la URL pública de la carátula de Hades II (`image/jpeg`, HTTP 200) y la web de destino (HTTP 200). La actividad envía `assets.large_image` y `assets.large_url` juntos; también se añaden `details_url` y `state_url` al título y a los artistas.

Cinco pruebas Jest correctas, incluyendo la comparación de títulos, las secuelas, los fallos de caché y la actualización asíncrona de imagen y enlace. Comprobación de tipos correcta. Electron `.tmp/desktop-sheets/1793308452202/report.json`: prueba correcta con WAV real y el cliente IPC simulado recibiendo la imagen resuelta y los tres enlaces. La prueba no publica en la cuenta real de Discord ni confirma un clic en su interfaz.

## Referencias oficiales

- [RPC e IPC](https://docs.discord.com/developers/topics/rpc)
- [Rich Presence, nombre dinámico, enlaces e integración Android](https://docs.discord.com/developers/discord-social-sdk/development-guides/setting-rich-presence)
- [Campos Activity y assets](https://docs.discord.com/developers/events/gateway-events#activity-object)
