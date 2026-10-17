# Android Auto: validación desde Windows

MMPlayer utiliza el servicio de reproducción existente y el catálogo de WatermelonDB. Los cambios nativos requieren instalar una nueva build; una actualización de JavaScript no basta.

## Preparación

1. Instalar MMPlayer en el móvil, conceder permiso de audio y escanear su biblioteca.
2. Actualizar Android Auto desde Google Play y activar la depuración USB del móvil.
3. En ajustes de Android Auto, pulsar diez veces la información de versión para activar su modo de desarrollador.
4. Habilitar **Orígenes desconocidos** para probar una build instalada directamente.
5. En el menú de Android Auto, seleccionar **Iniciar servidor de unidad principal**.
6. Conectar el móvil por USB y aceptar la autorización de depuración. Desbloquearlo para la primera conexión.
7. Ejecutar desde el repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-android-auto.ps1
```

Para simular un mando giratorio, añadir `-InputMode rotary`. Para varios móviles conectados, indicar `-Serial IDENTIFICADOR`.

DHU está instalado en `%LOCALAPPDATA%\Android\Sdk\extras\google\auto`. El script utiliza ADB, evitando cambiar el controlador USB a WinUSB. Solo configura temporalmente el puerto 5277 y lo libera al cerrar.

## Comprobaciones

### Si se queda cargando en un Xiaomi

En MIUI, permitir **Autoinicio en segundo plano** a MMPlayer desde Seguridad → Permisos. Se ha observado que el sistema rechaza la conexión de Android Auto con `WakePathChecker: MIUILOG-AutoStart, BindService Reject` cuando MMPlayer no está abierto. En ese caso el catálogo sí funciona al abrir previamente la app: aumentar los recursos de DHU no resuelve el bloqueo del teléfono.

Después de cambiar el permiso, abrir MMPlayer una vez y reconectar DHU. «Forzar detención» deja el paquete detenido explícitamente por Android y requiere volver a abrirlo; no equivale a retirar la app de recientes.

DHU utiliza el teléfono para ejecutar Android Auto y MMPlayer. No dispone de una asignación de RAM o CPU como un dispositivo virtual Android. Para reducir la carga de la proyección, usar la configuración de 800 × 480 a 30 fps y una prioridad de proceso superior a la normal en Windows.

### Recorrido funcional

- Abrir MMPlayer desde el coche sin haber abierto antes su interfaz. Repetir con pantalla apagada y tras recrear el proceso.
- Comprobar Inicio, Biblioteca, Playlists y Colas; favoritos, recientes, etiquetas, carpetas y listas inteligentes.
- Explorar más de 80 elementos y comprobar los grupos, incluidos grupos anidados en bibliotecas grandes.
- Reproducir una canción intermedia de un álbum y una aparición repetida en una playlist; verificar el contexto y orden restantes.
- Cambiar entre cinco colas y a una vacía. Deben conservar posición, nombres, aleatorio y repetición, entrando pausadas.
- Pausar, reanudar, avanzar, retroceder y seleccionar una entrada de la cola. Repetir rápidamente durante carga y restauración.
- Dar órdenes de voz por título, artista, álbum y playlist. Probar resultados ambiguos y búsquedas sin resultados.
- Cambiar favoritos, metadatos y carátulas desde el móvil con el catálogo abierto en el coche.
- Verificar ecualizador, graves, ReplayGain, velocidad y pitch sin interfaz montada.
- Comprobar llamadas, navegación, desconexión, reconexión y retirada de recientes durante una sesión del coche.
- Comprobar que Cast bloquea las acciones del coche y que al finalizar Cast vuelve el audio local.
- Abrir PlayerScreen durante reproducción del coche: no debe restaurar una sesión anterior ni pausar la canción.
- Comparar estadísticas antes y después de las reconexiones para detectar duplicados.

Complementar con Media Controller Test para `playFromMediaId`, `prepareFromMediaId`, `playFromSearch`, selección de entrada y búsqueda de posición. Comprobar que preparar contenido no inicia audio.

## Estado de validación

La compilación y los tests automáticos no sustituyen estas comprobaciones. DHU necesita un móvil conectado, Android Auto configurado y una build con los cambios nativos; la validación final en vehículo queda pendiente.

Referencias: [DHU](https://developer.android.com/training/cars/testing/dhu), [pruebas de Android Auto](https://developer.android.com/training/cars/testing), [Media Controller Test](https://developer.android.com/media/optimize/mct).

Validación en DHU (15/10/2026): catálogo de Inicio y Biblioteca visible, listado de canciones y pantalla de reproducción con carátula y progreso. Arranque del servicio sin Activity de MMPlayer comprobado. En el Xiaomi conectado se activó Autoinicio en segundo plano tras observar el rechazo de MIUI. Queda pendiente repetir el arranque automático tras un reinicio normal del teléfono y la validación en vehículo.
