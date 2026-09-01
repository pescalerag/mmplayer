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
import TagFormModal from "./src/components/modals/TagFormModal";
import "./src/constants/i18n";
import MainNavigator from "./src/navigation/MainNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { ScannerService } from "./src/services/ScannerService";
import { setupPlayer } from "./src/services/trackPlayerSetup";
import { usePlayerStore } from "./src/store/usePlayerStore";
import { MediaAssetService } from "./src/services/MediaAssetService";
import { ChromecastService } from "./src/services/ChromecastService";
import { PurchasesService } from "./src/services/PurchasesService";
SystemUI.setBackgroundColorAsync('#000000');

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        if (Platform.OS === "android") {
          await NavigationBar.setBackgroundColorAsync("black");
          await NavigationBar.setButtonStyleAsync("light");
        }

        await Font.loadAsync({
          Montserrat: require("./src/assets/fonts/Montserrat-VariableFont_wght.ttf"),
          "Montserrat-Italic": require("./src/assets/fonts/Montserrat-Italic-VariableFont_wght.ttf"),
        });

        await setupPlayer();
        ChromecastService.init();
        PurchasesService.init().catch(err => console.warn('PurchasesService init warning:', err));
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
        await SplashScreen.hideAsync().catch(() => { });
      }
    }
    prepare().catch((e: any) => {
      console.error("Error fatal en prepare():", e);
      setError(e?.message ?? "Error desconocido al arrancar");
      setFontsLoaded(true);
      SplashScreen.hideAsync().catch(() => { });
    });
  }, []);

  // Escuchador en vivo para resincronizar RevenueCat al volver a primer plano (reembolsos, compras)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        PurchasesService.syncCustomerInfo().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    const handleWidgetUrl = async (url: string | null) => {
      if (!url || !url.includes('widget')) return;
      try {
        const match = url.match(/[?&]action=([^&]+)/);
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

    Linking.getInitialURL().then(url => {
      handleWidgetUrl(url);
    });

    const subscription = Linking.addEventListener('url', event => {
      handleWidgetUrl(event.url);
    });

    return () => {
      subscription.remove();
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
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <TrackPlayerSync />
        <NavigationContainer
          ref={navigationRef}
          theme={{
            dark: true,
            colors: {
              primary: "#8B5CF6",
              background: "#000000",
              card: "#121212",
              text: "#FFFFFF",
              border: "#282828",
              notification: "#8B5CF6",
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
          <TagFormModal />
        </NavigationContainer>
      </View>
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
