# Notificaciones internas en PC (sección 2.5)

## Implementado

- Inicialización tras cargar SQLite, las preferencias y el idioma del usuario, sin bloquear la apertura de la aplicación.
- Generación de resúmenes semanales, mensuales y anuales usando los últimos períodos completos del servicio compartido y únicamente si existen escuchas en el período.
- Revisión al recuperar el foco, al volver a estar visible y cada minuto mientras la ventana esté visible. El arranque recupera los resúmenes que correspondan aunque la aplicación haya estado cerrada.
- Las preferencias de la sheet se respetan y sus cambios disparan una nueva revisión.
- Las solicitudes simultáneas se agrupan; la creación de un ID ya existente se vuelve a comprobar dentro de la escritura de SQLite para evitar duplicados.
- El contador de no leídas observa SQLite y responde a creación, lectura y eliminación, incluido el historial restaurado desde una copia.
- Al abrir un resumen, se marca como leído y se abre su pantalla de estadísticas con el rango correcto.
- Temporizador y observadores se eliminan al desmontar la aplicación.

## Alcance del servicio existente

El catálogo compartido define avisos de biblioteca, tres tipos de resumen y actualización de la aplicación. No existe un sistema de hitos de escucha con reglas o umbrales en el código compartido, por lo que esta sección no inventa nuevas categorías de hitos. El feed de actualización móvil apunta a Play Store y no se ejecuta desde esta inicialización de PC.

Son notificaciones internas. La comprobación periódica funciona con MMPlayer abierto; no instala tareas del sistema para ejecutar la aplicación cerrada.

## Verificación

- npm run desktop:typecheck y npm run desktop:build: correctos.
- npm run desktop:test: 36 pruebas correctas.
- npx jest src/__tests__/desktopNotificationLifecycle.test.ts src/__tests__/notifications.test.ts src/__tests__/notificationFailures.test.ts src/__tests__/notificationDateBoundaries.test.ts --runInBand: 64 pruebas correctas.
- Los tests de ciclo verifican inicio, foco, visibilidad, preferencias, minuto transcurrido, agrupación de solicitudes y limpieza al detenerse.
- npm run test:sheets --workspace=@mmplayer/desktop -- --filter "Automatic summaries": correcto en Electron real con perfil aislado. Usa historial y SQLite reales y un reloj simulado solo dentro del renderer de prueba. Comprueba resúmenes según el historial, activación semanal desde la sheet, ausencia de duplicados, contador, lectura, navegación y cambio de año sin generar un mes sin escuchas. No cambia el reloj de Windows.

Evidencia: .tmp/desktop-sheets/1793199371051/report.json.
