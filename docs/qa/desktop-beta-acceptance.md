# Aceptación de MMPlayer 3.0.0-beta.1 para Windows

30 de octubre de 2026. Pruebas locales en Windows, con datos aislados.

- Comprobación de tipos y compilación correctas.
- 41 pruebas de datos/worker correctas: SQLite, biblioteca, colas, metadatos,
  copias, archivos, almacenamiento y transporte.
- Integración Electron correcta: navegación, reproducción, zoom, redimensionado,
  menús, cola, letras, escritura real de metadatos y guardado al cerrar.
- Identidad de Windows: nombre resuelto, metadatos SMTC y play/pause reales.
- 50 casos de sheets/regresiones correctos; ninguno fallido o sin verificar en
  esta selección determinista. Incluye scroll inmediato de cola, arrastre con
  autoscroll, menús contextuales, letras, cabeceras, iconos y visualizaciones.
- «Compartir» canción corregido y comprobado con archivo físico guardado. El
  worker rechaza exportar un archivo que no pertenece a la biblioteca.
- El paquete incluye el decodificador de URI 0.5.1 corregido, exclusivamente en PC.
- Corregido un rechazo temporal de Windows al reemplazar el índice: escrituras
  serializadas y reintentos limitados. Una prueba cubre bloqueos transitorios y
  errores permanentes conservando el archivo anterior.
- ASAR y controles de seguridad de Electron comprobados en el ejecutable final.
- Instalación por usuario en una ruta con espacios, ejecución del instalado,
  reinstalación conservando SQLite/preferencias y desinstalación correctas.

La prueba de navegación falló inicialmente porque suponía el orden por defecto
después de que otra prueba hubiera guardado uno personalizado. Se corrigió para
comprobar el conjunto completo de iconos en el orden persistido; la pasada conjunta
posterior dio 50/50. No se descartó el resultado original.

Evidencia local:

- `.tmp/beta-acceptance-final.log`
- `.tmp/desktop-sheets/1793370179019/report.json`
- `.tmp/beta-native-final.log`
- `.tmp/beta-installed-package-final.log`
- `apps/desktop/release/package-test-report.json`

La búsqueda de letras está aceptada manualmente por el usuario. Los proveedores
externos no forman parte de la selección determinista de CI. La prueba completa
histórica de todas las sheets permanece separada y no se presenta como una nueva
pasada exhaustiva.

El CI de Windows se ha añadido al repositorio; estos resultados corresponden a
ejecuciones locales, no a una ejecución remota de GitHub Actions.

Por decisión del titular, esta beta pública no lleva firma Authenticode. El modo
sin firma solo se admite explícitamente para la beta; los artefactos de
previsualización no se publican. Se incluyen hashes SHA-256. La actualización es
manual y «Abrir con MMPlayer»/LocalCast no forman parte de esta versión.
