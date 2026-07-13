import { useSheetProps } from '@/hooks/useSheetProps';

import { Ionicons } from "@expo/vector-icons";
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SortOption, useLibraryStore } from "../../store/useLibraryStore";

import { useAppTheme } from "@/hooks/useAppTheme";

type SortOptionItem = { value: SortOption; labelKey: string };

const SORT_OPTIONS: Record<string, SortOptionItem[]> = {
  albums: [
    { value: "name_asc", labelKey: "sort.az" },
    { value: "name_desc", labelKey: "sort.za" },
    { value: "year_desc", labelKey: "sort.year_desc" },
    { value: "year_asc", labelKey: "sort.year_asc" },
  ],
  artists: [
    { value: "name_asc", labelKey: "sort.az" },
    { value: "name_desc", labelKey: "sort.za" },
  ],
  tracks: [
    { value: "name_asc", labelKey: "sort.az" },
    { value: "name_desc", labelKey: "sort.za" },
    { value: "duration_desc", labelKey: "sort.duration_desc" },
    { value: "duration_asc", labelKey: "sort.duration_asc" },
  ],
  playlists: [
    { value: "recent_desc", labelKey: "sort.recent_desc" },
    { value: "recent_asc", labelKey: "sort.recent_asc" },
    { value: "name_asc", labelKey: "sort.az" },
    { value: "name_desc", labelKey: "sort.za" },
  ],
};

export default function SortModalSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
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
        <Text style={styles.title}>{t('sort.title')}</Text>
        <Text style={styles.subtitle}>
          {activeTab === "albums" && t('library.albums')}
          {activeTab === "artists" && t('library.artists')}
          {activeTab === "tracks" && t('library.songs')}
          {activeTab === "playlists" && t('library.playlists')}
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
                name={isActive ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={isActive ? colors.accent : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.optionText,
                { color: isActive ? colors.accent : colors.text, fontFamily: fonts.regular },
              ]}
            >
              {t(opt.labelKey)}
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
