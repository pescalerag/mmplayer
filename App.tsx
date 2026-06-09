import { NavigationContainer } from "@react-navigation/native";
import * as Font from "expo-font";
import * as MediaLibrary from "expo-media-library";
import * as NavigationBar from "expo-navigation-bar";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AlbumMenuSheet from "./src/components/AlbumMenuSheet";
import ArtistMenuSheet from "./src/components/ArtistMenuSheet";
import ArtistsListSheet from "./src/components/ArtistsListSheet";
import FolderMenuSheet from "./src/components/FolderMenuSheet";
import GlobalToast from "./src/components/GlobalToast";
import PlaylistMenuSheet from "./src/components/PlaylistMenuSheet";
import PlaylistSelectorModal from "./src/components/PlaylistSelectorModal";
import QueueSheet from "./src/components/QueueSheet";
import SleepTimerSheet from "./src/components/SleepTimerSheet";
import SortModalSheet from "./src/components/SortModalSheet";
import TagFormModal from "./src/components/TagFormModal";
import TagManagerModal from "./src/components/TagManagerModal";
import TrackMenuSheet from "./src/components/TrackMenuSheet";
import { TrackPlayerSync } from "./src/components/TrackPlayerSync";
import UpdatedAppModal from "./src/components/UpdatedAppModal";
import "./src/constants/i18n";
import MainNavigator from "./src/navigation/MainNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { ScannerService } from "./src/services/ScannerService";
import { setupPlayer } from "./src/services/trackPlayerSetup";
import { usePlayerStore } from "./src/store/usePlayerStore";
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
          await MediaLibrary.requestPermissionsAsync();
        }

        await Font.loadAsync({
          Montserrat: require("./src/assets/fonts/Montserrat-VariableFont_wght.ttf"),
          "Montserrat-Italic": require("./src/assets/fonts/Montserrat-Italic-VariableFont_wght.ttf"),
        });

        await setupPlayer();
        // Restaurar cola persistida del último cierre de la app
        await usePlayerStore.getState().restorePlaybackState();
        // Restaurar recientes del último cierre de la app
        await usePlayerStore.getState().restoreRecentsState();

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
        <Text style={styles.errorTitle}>❌ Error al arrancar</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
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
          <TrackMenuSheet />
          <AlbumMenuSheet />
          <ArtistMenuSheet />
          <SortModalSheet />
          <QueueSheet />
          <TagManagerModal />
          <TagFormModal />
          <PlaylistSelectorModal />
          <PlaylistMenuSheet />
          <FolderMenuSheet />
          <UpdatedAppModal />
          <ArtistsListSheet />
          <SleepTimerSheet />
          <GlobalToast />
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
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
    color: "#aaa",
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    color: "#ff5555",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  errorText: {
    color: "#fff",
    fontSize: 13,
    textAlign: "center",
    fontFamily: "monospace",
  },
});
