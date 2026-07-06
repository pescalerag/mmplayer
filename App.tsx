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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import GlobalToast from "./src/components/GlobalToast";
import GlobalBottomSheet from "./src/components/GlobalBottomSheet";
import { TrackPlayerSync } from "./src/components/TrackPlayerSync";
import UpdatedAppModal from "./src/components/UpdatedAppModal";
import WelcomeModal from "./src/components/WelcomeModal";
import BackupBlockingModal from "./src/components/BackupBlockingModal";
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
          <UpdatedAppModal />
          <WelcomeModal />
          <GlobalToast />
          <BackupBlockingModal />
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
