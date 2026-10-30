# Distribución de MMPlayer para Windows

Versión de escritorio: `3.0.0-beta.1`. La versión móvil conserva su numeración.

El titular ha autorizado publicar esta beta **sin firma pública**. El instalador
público se identifica como `UNSIGNED`; la firma queda para una versión posterior.
Las notas de descarga explican los posibles avisos de Windows.

```powershell
npm run desktop:installer:beta
npm run test:package --workspace=@mmplayer/desktop -- --installer --unsigned-beta
```

## Generar y comprobar

Desde la raíz, en Windows con Node 24:

```powershell
npm ci --legacy-peer-deps
npm run desktop:typecheck
npm run desktop:test:beta
npm run desktop:installer:preview
npm run test:package --workspace=@mmplayer/desktop -- --installer
```

La última prueba instala y desinstala el paquete real en una carpeta de pruebas.
Debe ejecutarse en una cuenta Windows limpia sin otra instalación de MMPlayer.
Rechaza una instalación ya registrada para no sustituirla. Los perfiles, canciones
y escrituras de metadatos son aislados; nunca utiliza la biblioteca personal.

El instalador NSIS tiene asistente de bienvenida, licencia, selección de carpeta,
progreso y finalización. Usa la M y el morado de MMPlayer; ofrece inglés, español
y portugués según el idioma del sistema. Instala para el usuario sin elevar permisos,
crea accesos y desinstalador y conserva los datos al desinstalar. La identidad de
instalación permanece estable entre betas para permitir reinstalaciones.

El paquete contiene Electron, la app y sus dependencias de ejecución; no requiere
Node ni herramientas de desarrollo en el equipo del usuario. Excluye mapas de
código y el renderer inyectado de auditoría. Se incluyen licencias e inventarios de
dependencias empaquetadas. TagLib permanece reemplazable fuera de ASAR.

Los controles de seguridad de Electron desactivan RunAsNode, NODE_OPTIONS y la
inspección mediante argumentos, y activan la validación de integridad de ASAR.

`release/` contiene el instalador, el blockmap, SHA-256 y el informe de aceptación.
Los archivos con `UNSIGNED-PREVIEW` son exclusivamente para pruebas locales:
**no son el artefacto de la beta pública**. El comando `installer:beta` genera el
artefacto `UNSIGNED` autorizado para esta primera publicación.

## Firma pública

No hay un certificado de firma configurado actualmente. La integración admite:

- Certificado accesible en el almacén de Windows mediante
  `MMPLAYER_CERT_SHA1`, con su dispositivo/HSM o proveedor habilitado.
- Certificado compatible en un almacén PFX mediante `CSC_LINK` y
  `CSC_KEY_PASSWORD`, solamente cuando el proveedor permita ese uso. Los
  certificados públicos modernos suelen requerir hardware o firma en la nube;
  no debe suponerse que entregarán un PFX exportable.

Con credenciales válidas:

```powershell
npm run desktop:installer
npm run test:package --workspace=@mmplayer/desktop -- --installer --require-signed
```

El comando público falla antes de compilar si no hay configuración de firma.
Electron-builder firma la app y el instalador y añade el sello de tiempo. La
aceptación exige firmas Authenticode válidas para el ejecutable y el instalador.
No añadir certificados, contraseñas ni claves al repositorio.

Para un particular en España hay que elegir un proveedor que admita esa identidad:
[Certum](https://www.certum.eu/en/code-signing-certificates/) y
[SSL.com](https://www.ssl.com/products/software-integrity/code-signing/) publican
opciones para particulares. Otra posibilidad, sujeta a aprobación y a sus propias
reglas de compilación/firma, es [SignPath Foundation](https://signpath.org/terms)
para proyectos abiertos. Su integración necesita adaptarse al proceso aprobado;
no se debe presentar la plantilla PFX de CI como una integración con SignPath.

La contratación y verificación de identidad corresponden al titular. Una firma
válida no garantiza ausencia inmediata de avisos de SmartScreen:
[explicación de Microsoft](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).

## CI y publicación

`.github/workflows/desktop-windows.yml` ejecuta en Windows:

1. Comprobación de tipos y pruebas del worker/datos.
2. Electron real y Media Session/identificación del sistema.
3. Casos de sheets, documentos, cola, menús contextuales, navegación, resoluciones
   y visualizaciones. Los proveedores externos se validan aparte.
4. Generación del instalador y aceptación del ejecutable empaquetado.
5. Instalación real en una ruta con espacios, reinstalación conservando SQLite y
   preferencias, desinstalación y conservación de datos.

`.github/workflows/desktop-release.yml` se ejecuta manualmente indicando un tag
`desktop-v*-beta.*`: repite las comprobaciones, valida que versión y tag coinciden
y publica una **prerelease** de GitHub con instalador, hashes e informe. No sustituye
una publicación estable ni publica artefactos de previsualización. Actualmente
acepta la beta sin firma autorizada por el titular; la ruta de firma permanece
preparada para cuando haya certificado.

Antes del primer lanzamiento:

1. Para futuras versiones firmadas, configurar la firma en GitHub o adaptar el paso al proveedor elegido. La
   plantilla actual usa los secretos `WINDOWS_CERTIFICATE` y
   `WINDOWS_CERTIFICATE_PASSWORD` para un PFX compatible.
2. Configurar el entorno GitHub `desktop-beta`, idealmente con revisión requerida.
3. Subir y revisar el código completo de escritorio y los workflows.
4. Crear el tag `desktop-v3.0.0-beta.1` sobre ese commit aprobado y ejecutar el
   workflow de publicación, o publicar el paquete ya aceptado con el script local.
5. Tras el éxito, enlazar la prerelease desde la web de MMPlayer.

El script local `npm run publish:beta --workspace=@mmplayer/desktop` comprueba el
informe y los hashes sin publicar. Añadir `-- --publish` publica: conserva el código
en una rama `codex/windows-beta-*`, sube el tag de escritorio, prepara una release
en borrador, carga los archivos y finalmente la convierte en prerelease. Nunca
sobrescribe una versión ya publicada ni mezcla el lanzamiento con Android o main.

No hay actualización automática dentro de esta beta: se descarga y ejecuta el
instalador nuevo. El blockmap no implica que exista ya un cliente de actualización.

## Aceptación manual de letras

El 30 de octubre de 2026 el usuario confirmó haber probado con éxito la búsqueda
de letras. El HTTP 503 de una ejecución anterior se conserva en su informe como
evidencia histórica; no representa un fallo funcional confirmado de esta beta.
