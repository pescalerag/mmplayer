import { NavigationContainer } from "@react-navigation/native";
import * as Font from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  View,
  Linking,
} from "react-native";
import TrackPlayer, { State } from "react-native-track-player";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import GlobalToast from "./src/components/common/GlobalToast";
import GlobalBottomSheet from "./src/components/sheets/GlobalBottomSheet";
import QueueSheet from "./src/components/sheets/QueueSheet";
import { TrackPlayerSync } from "./src/components/player/TrackPlayerSync";
import UpdatedAppModal from "./src/components/modals/UpdatedAppModal";
import WelcomeModal from "./src/components/modals/WelcomeModal";
import BackupBlockingModal from "./src/components/modals/BackupBlockingModal";
import ZipProgressModal from "./src/components/modals/ZipProgressModal";
import MigrationBlockingModal from "./src/components/modals/MigrationBlockingModal";
import TagFormModal from "./src/components/modals/TagFormModal";
import ActivityCustomDateModal from "./src/components/modals/ActivityCustomDateModal";
import "./src/constants/i18n";
import MainNavigator from "./src/navigation/MainNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { ScannerService } from "./src/services/ScannerService";
import { setupPlayer } from "./src/services/trackPlayerSetup";
import { usePlayerStore } from "./src/store/usePlayerStore";
import { MediaAssetService } from "./src/services/MediaAssetService";
import { ChromecastService } from "./src/services/ChromecastService";
import { PurchasesService } from "./src/services/PurchasesService";
import { NotificationService } from "./src/services/NotificationService";
import { ExternalAudioService } from "./src/services/ExternalAudioService";
import notifee, { EventType } from '@notifee/react-native';
import { getLaunchAudioUri, clearLaunchAudioUri } from "./modules/native-audio-scanner";
import { LEGENDARY_ACCENT } from "./src/hooks/useAppTheme";

const WIDGET_ACTION_REGEX = /[?&]action=([^&]+)/;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deshabilitado temporalmente: el tema legendario de la aplicación vendrá en una futura versión
  const isLegendaryTheme = false;
  const LEGENDARY_BG_IMAGE = require('./src/assets/images/legend-theme-bg.webp');

  useEffect(() => {
    const hideSplash = async () => {
      if (AppState.currentState === 'active') {
        await SplashScreen.hideAsync().catch(() => {});
      } else {
        const sub = AppState.addEventListener('change', (nextState) => {
          if (nextState === 'active') {
            sub.remove();
            SplashScreen.hideAsync().catch(() => {});
          }
        });
      }
    };

    async function prepare() {
      try {
        if (Platform.OS === "android") {
          await NavigationBar.setBackgroundColorAsync("#00000000").catch(() => {});
          await NavigationBar.setButtonStyleAsync("light").catch(() => {});
          await SystemUI.setBackgroundColorAsync('#000000').catch(() => {});
        }

        await Font.loadAsync({
          Montserrat: require("./src/assets/fonts/Montserrat-VariableFont_wght.ttf"),
          "Montserrat-Italic": require("./src/assets/fonts/Montserrat-Italic-VariableFont_wght.ttf"),
        });

        await setupPlayer();
        ChromecastService.init();
        PurchasesService.init().catch(err => console.warn('PurchasesService init warning:', err));
        NotificationService.init().catch(err => console.warn('NotificationService init warning:', err));
        // Restaurar cola persistida del último cierre de la app
        await usePlayerStore.getState().restorePlaybackState();
        // Restaurar recientes del último cierre de la app
        await usePlayerStore.getState().restoreRecentsState();

        // Ejecutar migración y Garbage Collector de archivos multimedia en segundo plano
        MediaAssetService.migrateLegacyCacheAssets();
        MediaAssetService.runGarbageCollector();

        // Ejecutar migración de last_modified en segundo plano para legacy tracks
        ScannerService.migrateLastModifiedIfNeeded().catch((err) => {
          console.error("Error al ejecutar migración de last_modified:", err);
        });
      } catch (e: any) {
        console.warn("Error en la inicialización:", e);
      } finally {
        setFontsLoaded(true);
        await hideSplash();
      }
    }
    prepare().catch(async (e: any) => {
      console.error("Error fatal en prepare():", e);
      setError(e?.message ?? "Error desconocido al arrancar");
      setFontsLoaded(true);
      await hideSplash();
    });
  }, []);

  // Escuchador en vivo para resincronizar RevenueCat y Notificaciones al volver a primer plano
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        PurchasesService.syncCustomerInfo().catch(() => {});
        NotificationService.checkAndGenerateSummaries().catch(() => {});
        NotificationService.getUnreadCount().catch(() => {});
      }
    });

    const notifeeSub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail?.notification) {
        NotificationService.checkAndGenerateSummaries().catch(() => {});
        NotificationService.handleNotificationPressEvent(detail.notification).catch(() => {});
      }
    });

    notifee.getInitialNotification().then((initial) => {
      if (initial?.notification) {
        NotificationService.checkAndGenerateSummaries().catch(() => {});
        NotificationService.handleNotificationPressEvent(initial.notification).catch(() => {});
      }
    }).catch(() => {});

    return () => {
      subscription.remove();
      notifeeSub();
    };
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    let lastHandledNotificationTimestamp = 0;

    const handleWidgetUrl = async (url: string | null) => {
      if (!url?.includes('widget')) return;
      try {
        const match = WIDGET_ACTION_REGEX.exec(url);
        const action = match ? match[1] : null;

        if (action === 'play') {
          const state = await TrackPlayer.getPlaybackState();
          if (state.state === State.Playing) {
            await TrackPlayer.pause();
          } else {
            await TrackPlayer.play();
          }
        } else if (action === 'next') {
          await TrackPlayer.skipToNext();
        } else if (action === 'prev') {
          const { position } = await TrackPlayer.getProgress();
          if (position > 3) {
            await TrackPlayer.seekTo(0);
          } else {
            await TrackPlayer.skipToPrevious();
          }
        }
      } catch (e) {
        console.error('[App] Error handling widget action url:', e);
      }
    };

    const handleNotificationClickUrl = async () => {
      try {
        clearLaunchAudioUri();

        const now = Date.now();
        if (now - lastHandledNotificationTimestamp < 1500) {
          return;
        }
        lastHandledNotificationTimestamp = now;

        // Esperar a que el contenedor de navegación esté listo
        const startTime = Date.now();
        while (!navigationRef.isReady() && Date.now() - startTime < 8000) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (!navigationRef.isReady()) return;

        // Esperar si es necesario a que el store tenga la canción activa sincronizada
        let activeTrack = usePlayerStore.getState().activeTrack;
        if (!activeTrack) {
          await usePlayerStore.getState().syncWithTrackPlayer().catch(() => {});
          activeTrack = usePlayerStore.getState().activeTrack;
        }

        if (!activeTrack) {
          const syncStartTime = Date.now();
          while (!usePlayerStore.getState().activeTrack && Date.now() - syncStartTime < 1500) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          activeTrack = usePlayerStore.getState().activeTrack;
        }

        if (!activeTrack) {
          return;
        }

        // Si ya estamos en PlayerScreen o una de sus subpantallas, no duplicar navegación
        const currentRoute = navigationRef.getCurrentRoute()?.name;
        if (
          currentRoute === 'PlayerHome' ||
          currentRoute === 'Player' ||
          currentRoute === 'Lyrics' ||
          currentRoute === 'LyricsEditor' ||
          currentRoute === 'LyricsSync' ||
          currentRoute === 'ShareSong' ||
          currentRoute === 'ShareLyrics'
        ) {
          return;
        }

        navigationRef.navigate('Player');
      } catch (e) {
        console.error('[App] Error al abrir PlayerScreen desde la notificación:', e);
      }
    };

    const handleIncomingUrl = async (url: string | null) => {
      if (!url) return;
      if (url.includes('widget')) {
        await handleWidgetUrl(url);
        return;
      }
      if (url.includes('notification.click') || url.startsWith('trackplayer://')) {
        await handleNotificationClickUrl();
        return;
      }
      if (ExternalAudioService.isAudioUrl(url)) {
        await ExternalAudioService.handleOpenedAudioUrl(url);
      }
    };

    // 1. Initial URL via React Native Linking
    Linking.getInitialURL().then(url => {
      handleIncomingUrl(url);
    });

    // 2. Initial URL via native launch intent (Android Intent.ACTION_VIEW)
    const nativeUri = getLaunchAudioUri();
    if (nativeUri) {
      handleIncomingUrl(nativeUri);
    }

    // 3. Listen for Linking events (warm start)
    const subLinking = Linking.addEventListener('url', event => {
      handleIncomingUrl(event.url);
    });

    // 4. Listen for native audio file opened events (warm start / onNewIntent)
    const subNative = ExternalAudioService.subscribeToAudioFileOpened(uri => {
      handleIncomingUrl(uri);
    });

    // 5. Escuchar cambios de estado de la app para capturar intents al volver a primer plano
    const subAppState = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const uri = getLaunchAudioUri();
        if (uri && (uri.includes('notification.click') || uri.startsWith('trackplayer://'))) {
          handleIncomingUrl(uri);
        }
      }
    });

    return () => {
      subLinking.remove();
      subNative.remove();
      subAppState.remove();
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error al cargar la aplicación:</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <ImageBackground
        source={isLegendaryTheme ? LEGENDARY_BG_IMAGE : undefined}
        style={{ flex: 1, backgroundColor: "#000000" }}
        imageStyle={{ resizeMode: 'cover' }}
      >
        <TrackPlayerSync />
        <NavigationContainer
          ref={navigationRef}
          theme={{
            dark: true,
            colors: {
              primary: isLegendaryTheme ? LEGENDARY_ACCENT : "#8B5CF6",
              background: isLegendaryTheme ? "transparent" : "#000000",
              card: isLegendaryTheme ? "transparent" : "#121212",
              text: "#FFFFFF",
              border: isLegendaryTheme ? "rgba(245, 184, 0, 0.25)" : "#282828",
              notification: isLegendaryTheme ? LEGENDARY_ACCENT : "#8B5CF6",
            },
            fonts: {
              regular: { fontFamily: "Montserrat", fontWeight: "400" },
              medium: { fontFamily: "Montserrat", fontWeight: "500" },
              bold: { fontFamily: "Montserrat", fontWeight: "bold" },
              heavy: { fontFamily: "Montserrat", fontWeight: "800" },
            },
          }}
        >
          <StatusBar style="light" />
          <MainNavigator />
          {/* Los sheets globales deben estar dentro de NavigationContainer
                        para que useNavigation() funcione en ellos */}
          <GlobalBottomSheet />
          <QueueSheet />
          <UpdatedAppModal />
          <WelcomeModal />
          <GlobalToast />
          <BackupBlockingModal />
          <ZipProgressModal />
          <MigrationBlockingModal />
          <TagFormModal />
          <ActivityCustomDateModal />
        </NavigationContainer>
      </ImageBackground>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
    padding: 24,
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 16,
    fontSize: 16,
    fontFamily: "Montserrat",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 18,
    fontFamily: "Montserrat",
    fontWeight: "bold",
    marginBottom: 8,
  },
  errorSubtext: {
    color: "#A0A0A0",
    fontSize: 14,
    fontFamily: "Montserrat",
    textAlign: "center",
  },
});
