import { useSheetProps } from '@/hooks/useSheetProps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from "@expo/vector-icons";
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SortOption, useLibraryStore } from "../../store/useLibraryStore";

import { useAppTheme } from "@/hooks/useAppTheme";
import { AlbumFilterControls } from '../library/AlbumFilterControls';
import { LibraryFilterControls } from '../library/LibraryFilterControls';
import { FilterSection, createSectionDraft, EMPTY_SECTION_FILTERS, parseSectionDraft } from '../../utils/libraryFilters';
import { createAlbumFilterDraft, EMPTY_ALBUM_FILTERS, parseAlbumFilterDraft } from '../../utils/albumFilters';
import { FilterDisclosure } from '../library/FilterDisclosure';

type SortOptionItem = { value: SortOption; labelKey: string };

const SORT_OPTIONS: Record<string, SortOptionItem[]> = {
  albums: [
    { value: "rating_desc", labelKey: "sort.rating_desc" },
    { value: "rating_asc", labelKey: "sort.rating_asc" },
    { value: "name_asc", labelKey: "sort.az" },
    { value: "name_desc", labelKey: "sort.za" },
    { value: "year_desc", labelKey: "sort.year_desc" },
    { value: "year_asc", labelKey: "sort.year_asc" },
  ],
  artists: [
    { value: "rating_desc", labelKey: "sort.rating_desc" },
    { value: "rating_asc", labelKey: "sort.rating_asc" },
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
  const insets = useSafeAreaInsets();
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { props: { activeTab = 'albums', activeSort }, close: closeModal } = useSheetProps<{ activeTab: any; activeSort: any }>('sort-modal');

  const options = SORT_OPTIONS[activeTab] ?? [];
  const [albumSort, setAlbumSort] = React.useState<SortOption>(activeSort ?? useLibraryStore.getState().albumSort);
  const { height } = useWindowDimensions();
  const [albumDraft, setAlbumDraft] = React.useState(() => createAlbumFilterDraft(useLibraryStore.getState().albumFilters));
  const [sectionDraft, setSectionDraft] = React.useState(() => createSectionDraft(useLibraryStore.getState().sectionFilters[activeTab as FilterSection] ?? EMPTY_SECTION_FILTERS));
  const [error, setError] = React.useState(false);
  const sheetHeight = height * 0.70;
  const apply = () => {
    const store = useLibraryStore.getState();
    if (activeTab === 'albums') {
      const filters = parseAlbumFilterDraft(albumDraft);
      if (!filters) { setError(true); return; }
      store.setAlbumSort(albumSort); store.setAlbumFilters(filters);
    } else {
      const filters = parseSectionDraft(activeTab as FilterSection, sectionDraft);
      if (!filters) { setError(true); return; }
      if (activeTab === 'artists') store.setArtistSort(albumSort);
      else if (activeTab === 'tracks') store.setTrackSort(albumSort);
      else if (activeTab === 'playlists') store.setPlaylistSort(albumSort);
      store.setSectionFilters(activeTab as FilterSection, filters);
    }
    closeModal();
  };

  const handleSelect = (value: SortOption) => {
    setAlbumSort(value);
  };

  return (
    <View style={[styles.container, { height: sheetHeight }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('library_filters.sheet_title')}</Text>
        <Text style={styles.subtitle}>
          {activeTab === "albums" && t('library.albums')}
          {activeTab === "artists" && t('library.artists')}
          {activeTab === "tracks" && t('library.songs')}
          {activeTab === "playlists" && t('library.playlists')}
          {activeTab === "folders" && t('library.folders')}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator bounces={false}>
      {!!options.length && <FilterDisclosure title={t('sort.title')} summary={t(options.find(option => option.value === albumSort)?.labelKey ?? 'sort.az')}>
      {options.map((opt) => {
        const isActive = albumSort === opt.value;
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
      </FilterDisclosure>}
      {activeTab === 'albums' && <AlbumFilterControls onApply={apply} draft={albumDraft} setDraft={setAlbumDraft} hideActions />}
      {activeTab !== 'albums' && <LibraryFilterControls section={activeTab as FilterSection} onApply={apply} draft={sectionDraft} setDraft={setSectionDraft} hideActions />}
      </ScrollView>
      {error && <Text accessibilityRole="alert" style={{ color: colors.accent }}>{t('library_filters.invalid')}</Text>}
      <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12 }}>
        <TouchableOpacity style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }} onPress={() => {
          setAlbumDraft(createAlbumFilterDraft(EMPTY_ALBUM_FILTERS)); setSectionDraft(createSectionDraft(EMPTY_SECTION_FILTERS)); setError(false);
        }}><Text style={{ color: colors.text, fontFamily: fonts.bold }}>{t('album_filters.reset')}</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10, backgroundColor: colors.accent }} onPress={apply}>
          <Text style={{ color: colors.onAccent, fontFamily: fonts.bold }}>{t('album_filters.apply')}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: insets.bottom + 16, flexShrink: 0, backgroundColor: colors.sheetBackground, marginHorizontal: -24 }} />
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  container: {
    width: "100%",
    flexShrink: 1,
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
