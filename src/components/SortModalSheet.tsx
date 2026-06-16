import { Ionicons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    BackHandler,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SortOption, useLibraryStore } from "../store/useLibraryStore";
import { useSortModalStore } from "../store/useSortModalStore";

import { Colors } from "../theme/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type SortOptionItem = { value: SortOption; label: string };

const SORT_OPTIONS: Record<string, SortOptionItem[]> = {
  albums: [
    { value: "name_asc", label: "A-Z" },
    { value: "name_desc", label: "Z-A" },
    { value: "year_desc", label: "Año (Reciente)" },
    { value: "year_asc", label: "Año (Antiguo)" },
  ],
  artists: [
    { value: "name_asc", label: "A-Z" },
    { value: "name_desc", label: "Z-A" },
  ],
  tracks: [
    { value: "name_asc", label: "A-Z" },
    { value: "name_desc", label: "Z-A" },
    { value: "duration_desc", label: "Mayor Duración" },
    { value: "duration_asc", label: "Menor Duración" },
  ],
  playlists: [
    { value: "recent_desc", label: "Más recientes" },
    { value: "recent_asc", label: "Más antiguas" },
    { value: "name_asc", label: "A-Z" },
    { value: "name_desc", label: "Z-A" },
  ],
};

export default function SortModalSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const insets = useSafeAreaInsets();
  const { isVisible, activeTab, activeSort, closeModal } = useSortModalStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (isVisible) {
      if (Platform.OS === "android") {
        NavigationBar.setBackgroundColorAsync("#121212").catch(() => {});
      }
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, fadeAnim, slideAnim]);

  useEffect(() => {
    if (!isVisible) return;
    const onBackPress = () => {
      closeModal();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [isVisible, closeModal]);

  const [shouldRender, setShouldRender] = useState(isVisible);
  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender && !isVisible) return null;

  const options = SORT_OPTIONS[activeTab] ?? [];

  const handleSelect = (value: SortOption) => {
    const store = useLibraryStore.getState();
    if (activeTab === "albums") store.setAlbumSort(value);
    else if (activeTab === "artists") store.setArtistSort(value);
    else if (activeTab === "tracks") store.setTrackSort(value);
    else if (activeTab === "playlists") store.setPlaylistSort(value);
    closeModal();
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
      pointerEvents={isVisible ? "auto" : "none"}
    >
      <TouchableWithoutFeedback onPress={closeModal}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheetContainer,
          {
            paddingBottom: insets.bottom + 20,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.dragIndicator} />

        <View style={styles.header}>
          <Text style={styles.title}>Ordenar por</Text>
          <Text style={styles.subtitle}>
            {activeTab === "albums" && "Álbumes"}
            {activeTab === "artists" && "Artistas"}
            {activeTab === "tracks" && "Canciones"}
            {activeTab === "playlists" && "Playlists"}
          </Text>
        </View>

        {options.map((opt) => {
          const isActive = activeSort === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={styles.optionRow}
              onPress={() => handleSelect(opt.value)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name={isActive ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={isActive ? colors.accent : "#555"}
                />
              </View>
              <Text
                style={[styles.optionText, isActive && styles.optionTextActive]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheetContainer: {
    backgroundColor: "#121212",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderTopWidth: 1,
    borderColor: colors.cardBackground,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },
  header: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBackground,
    paddingBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.regular,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    fontWeight: "700",
    marginTop: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: "700",
  },
  optionTextActive: {
    color: colors.text,
  },
});
