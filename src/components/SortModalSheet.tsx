import { useSheetProps } from '@/hooks/useSheetProps';

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SortOption, useLibraryStore } from "../store/useLibraryStore";

import { useAppTheme } from "@/hooks/useAppTheme";

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
  const { props: { activeTab = 'albums', activeSort }, close: closeModal } = useSheetProps<{ activeTab: any; activeSort: any }>('sort-modal');

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
    <View style={styles.container}>
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
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  container: {
    width: "100%",
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
    flexDirection: 'row',
    alignItems: 'center',
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
