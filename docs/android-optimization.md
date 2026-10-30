# Optimización de Android con R8

La configuración persistente está en `plugins/withAndroidOptimization.js`, registrado
en `app.json`. Los archivos Gradle generados se ignoran en Git: los cambios deben
aplicarse mediante el plugin para conservarlos después de un prebuild.

## Configuración de release

- Android Gradle Plugin 8.13.2, compatible con el wrapper Gradle 8.14.3 actual.
- Minificación y reducción de recursos activadas.
- Archivo predeterminado `proguard-android-optimize.txt`. El anterior,
  `proguard-android.txt`, añade `-dontoptimize` y desactiva la optimización aunque
  `minifyEnabled` esté activado.
- R8 en modo completo y `android.r8.optimizedResourceShrinking=true`. AGP 8.12 y
  8.13 requieren activar explícitamente esta última opción.

Se conservan las reglas particulares de ProGuard. No se deben retirar las
protecciones de los puentes nativos sin probar las llamadas por reflexión de
NativeEqualizer a TrackPlayer y Android Auto, además de los módulos Expo.
Estos cambios no modifican la reproducción ni el código JavaScript y no permiten
cuantificar un ahorro de RAM sin medir una build release en un dispositivo.

## Validación

Desde `android`, con Java y el SDK de Android configurados:

```powershell
.\gradlew.bat :app:minifyReleaseWithR8 --configure-on-demand --console=plain
.\gradlew.bat app:assembleRelease -x lint -x test --configure-on-demand --build-cache
```

En esta configuración, la reducción optimizada de recursos se integra en R8.
Revisar `app/build/outputs/mapping/release/configuration.txt` para confirmar que no
hay una directiva `-dontoptimize` activa. Conservar `mapping.txt` para interpretar
errores de producción. Antes de publicar, probar reproducción, Android Auto,
LocalCast, ecualizador, imágenes e iconos alternativos en una build release.

La compilación completa también comprueba los metadatos AAR de las librerías con
AGP 8.13. El parche de `react-native-http-bridge-refurbished` hace que su
`compileSdkVersion` herede el de la app: el valor fijo anterior (33) era inferior
al requerido por sus dependencias AndroidX (34). No cambia su SDK mínimo ni su
código de LocalCast.

## Migración pendiente a AGP 9

Se pospone la recomendación de Play Console de usar AGP 9 para una migración
coordinada del entorno Expo/React Native. La app usa Expo 54 y React Native 0.81.5;
sus plugins Gradle utilizan interfaces antiguas de Android. AGP 9 requiere como
mínimo Gradle 9.1 y cambia tanto estas interfaces como la integración de Kotlin.
Las opciones temporales de compatibilidad no sustituyen las pruebas de todos
los módulos nativos. No basta con cambiar el número de versión.

## Documentación oficial

- [Activar la optimización de R8](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
- [AGP 8.13 y requisitos de compatibilidad](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
- [Cambios y requisitos de AGP 9](https://developer.android.com/build/releases/agp-9-0-0-release-notes)
- [Soporte de AGP 9 en React Native 0.87](https://reactnative.dev/blog/2026/08/11/react-native-0.87)
