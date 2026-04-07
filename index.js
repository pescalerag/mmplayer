// index.js
import { registerRootComponent } from 'expo';
import 'react-native-gesture-handler';
import TrackPlayer from 'react-native-track-player';

import App from './App';
import { PlaybackService } from './src/services/PlaybackService';

// Registramos el servicio en segundo plano primero
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Luego registramos el componente principal de la app
registerRootComponent(App);