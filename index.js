import 'react-native-gesture-handler';
// index.js
import { registerRootComponent } from 'expo';
import * as SystemUI from 'expo-system-ui';
import TrackPlayer from 'react-native-track-player';
import notifee, { EventType } from '@notifee/react-native';
import './src/services/TrackPlayerFade';
import App from './App';
import { PlaybackService } from './src/services/PlaybackService';
import { NotificationService } from './src/services/NotificationService';
SystemUI.setBackgroundColorAsync('#000000');

// Registramos el servicio en segundo plano primero
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Manejador en segundo plano para notificaciones de Notifee (disparadores y pulsaciones)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.DELIVERED || type === EventType.PRESS) {
    try {
      await NotificationService.checkAndGenerateSummaries();
      if (detail?.notification?.id === 'summary_weekly') {
        const hasSummary = await NotificationService.hasCurrentWeeklySummary();
        if (!hasSummary) {
          await notifee.cancelNotification('summary_weekly');
        }
      }
    } catch (e) {
      console.warn('[index.js] Error in Notifee background event:', e);
    }
  }
});

// Luego registramos el componente principal de la app
registerRootComponent(App);