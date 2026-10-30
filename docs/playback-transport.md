# Fundido de play/pausa

En Android, `TrackPlayerFade.ts` envía una sola orden a
`NativeEqualizer.setTransportPlaying`. El puente la ejecuta en el hilo principal
del servicio de TrackPlayer. `TransportFadeController` controla el volumen con
el reloj monotónico de Android y un `Handler` del reproductor, durante 400 ms.
No consulta el estado a través del puente ni espera temporizadores JavaScript
para cada paso. El tiempo se mide desde el inicio de la orden nativa; si un paso
llega tarde, utiliza el tiempo transcurrido en lugar de prolongar el fundido.

- Play cancela una pausa pendiente y parte del volumen alcanzado.
- Las órdenes duplicadas no reinician el plazo.
- Con fade desactivado o bypass explícito, la orden es inmediata.
- Parar, vaciar, cargar otra pista o destruir el servicio cancela sus callbacks.
- Silenciar el reproductor para Cast cancela el fundido y conserva el silencio.
- El botón acepta órdenes contrarias mientras la anterior espera confirmación.
- La indicación visual de pausa nativa termina con el estado real, una nueva
  orden o un error; no cambia por un temporizador de seguridad de JavaScript.

LocalCast y Chromecast mantienen sus rutas de transporte. Otras plataformas
conservan el fundido JavaScript anterior. Los módulos nativos se conservan en
el parche de `react-native-track-player`; cambiar únicamente JavaScript no basta:
es necesario recompilar e instalar la app. La entrada nativa lleva `@Keep` para
proteger la llamada por reflexión durante la optimización de R8.

## Validación

```powershell
npx jest --runInBand --runTestsByPath src/__tests__/trackPlayerFade.test.ts src/__tests__/playPauseButton.test.ts
cd android
.\gradlew.bat :react-native-track-player:testDebugUnitTest
.\gradlew.bat app:assembleRelease -x lint -x test --configure-on-demand --build-cache
```

Antes de publicar, comprobar en dispositivo pulsaciones rápidas, pausa desde la
notificación con pantalla apagada, interrupciones de audio y cambio de cola.
