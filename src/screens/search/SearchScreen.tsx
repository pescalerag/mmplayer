import { openAlbumMenu, openArtistMenu, openPlaylistMenu, openTagMenu, useUIStore } from '@/store/useUIStore';
import { Ionicons } from "@expo/vector-icons";
import withObservables from "@nozbe/with-observables";
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Q } from '@nozbe/watermelondb';
import { useNavigation, useScrollToTop, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LibraryCard from '@/components/cards/LibraryCard';
import SectionHeader from '@/components/common/SectionHeader';
import TopMatchCard from '@/components/cards/TopMatchCard';
import TrackRow from '@/components/player/TrackRow';
import { database } from "../../database";
import Album from "../../database/models/Album";
import Artist from "../../database/models/Artist";
import Tag from "../../database/models/Tag";
import Track from "../../database/models/Track";
import Playlist from "../../database/models/Playlist";
import TrackTag from "../../database/models/TrackTag";
import PlaylistTrack from "../../database/models/PlaylistTrack";
import { TopMatch, useMusicSearch } from "../../hooks/useMusicSearch";
import { useSearchHistory } from "../../hooks/useSearchHistory";
import { SearchStackParamList } from "../../navigation/types";


import { usePlayerStore } from "../../store/usePlayerStore";


import { useSettingsStore } from "../../store/useSettingsStore";
import { Colors, Layout } from "../../theme/theme";
import { useAppTheme } from '../../hooks/useAppTheme';
import { getDynamicTagTextColor } from '../../utils/color';

import { useTranslation } from "react-i18next";
import { HistoryService } from "../../services/HistoryService";

type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

type FilterOption = "all" | "artists" | "albums" | "tracks" | "playlists" | "tags";

const FILTER_TABS: { id: FilterOption }[] = [
  { id: "all" },
  { id: "artists" },
  { id: "albums" },
  { id: "tracks" },
  { id: "playlists" },
  { id: "tags" },
];

// --- ENHANCED COMPONENTS FOR SEARCH ---

const HistoryItem = ({
  query,
  onDelete,
  onPress,
}: {
  query: string;
  onDelete: () => void;
  onPress: () => void;
}) => (
  <View style={styles.historyItem}>
    <TouchableOpacity style={styles.historyTextContainer} onPress={onPress}>
      <Ionicons
        name="time-outline"
        size={18}
        color="#666"
        style={styles.historyIcon}
      />
      <Text style={styles.historyText}>{query}</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onDelete} style={styles.historyDelete}>
      <Ionicons name="close" size={18} color="#666" />
    </TouchableOpacity>
  </View>
);

const SearchTrackRowBase = ({
  track,
  album,
  artists,
  onPress,
}: {
  track: Track;
  album: Album | null;
  artists: Artist[];
  onPress?: () => void;
}) => {
  const { t } = useTranslation();
  const artistNames =
    artists.length > 0
      ? artists.map((a) => a.name).join(", ")
      : t('actions.unknown');

  const handlePress = () => {
    onPress?.();
    usePlayerStore.getState().playSingleTrack(track, "search");
  };

  return (
    <TrackRow
      track={track}
      contextId="search"
      coverUrl={album?.coverUrl}
      artistName={artistNames}
      isLyricMatch={(track as any).isLyricMatch}
      onPress={handlePress}
    />
  );
};

const SearchTrackRow = withObservables(
  ["track"],
  ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe().pipe(catchError(() => of(null))),
    artists: track.queryCollaborators.observe() as any, // Cast to any to match Artist[] expectation
  }),
)(SearchTrackRowBase);
SearchTrackRow.displayName = "SearchTrackRow";

const SearchAlbumCardBase = memo(function SearchAlbumCardBase({
  album,
  artist,
  onPress,
}: {
  album: Album;
  artist: Artist | null;
  onPress: (albumId: string) => void;
}) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => onPress(album.id), [onPress, album.id]);
  const handleLongPress = useCallback(() => {
    Keyboard.dismiss();
    openAlbumMenu(album);
  }, [album]);

  return (
    <View style={styles.cardContainer}>
      <LibraryCard
        title={album.title}
        subtitle={artist?.name || t('actions.unknown')}
        imageUrl={album.coverUrl}
        placeholderIcon="albums"
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    </View>
  );
});

const SearchAlbumCard = withObservables(
  ["album"],
  ({ album }: { album: Album }) => ({
    album: album.observe(),
    artist: album.artist.observe().pipe(catchError(() => of(null))),
  }),
)(SearchAlbumCardBase);
SearchAlbumCard.displayName = "SearchAlbumCard";

const SearchArtistCard = memo(function SearchArtistCard({
  artist,
  onPress,
}: {
  artist: Artist;
  onPress: (artistId: string) => void;
}) {
  const handlePress = useCallback(() => onPress(artist.id), [onPress, artist.id]);
  const handleLongPress = useCallback(() => {
    Keyboard.dismiss();
    openArtistMenu(artist);
  }, [artist]);

  return (
    <View style={styles.cardContainer}>
      <LibraryCard
        title={artist.name}
        imageUrl={artist.imageUrl}
        placeholderIcon="person"
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    </View>
  );
});

const SearchPlaylistCardBase = memo(function SearchPlaylistCardBase({
  playlist,
  onPress,
}: {
  playlist: Playlist;
  onPress: (playlistId: string, playlistName: string) => void;
}) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => onPress(playlist.id, playlist.name), [onPress, playlist.id, playlist.name]);
  const handleLongPress = useCallback(() => {
    Keyboard.dismiss();
    openPlaylistMenu(playlist);
  }, [playlist]);

  return (
    <View style={styles.cardContainer}>
      <LibraryCard
        title={playlist.name}
        subtitle={t('library.playlist_singular')}
        imageUrl={playlist.coverCustomUrl}
        placeholderIcon="musical-notes"
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    </View>
  );
});

const SearchPlaylistCard = withObservables(
  ["playlist"],
  ({ playlist }: { playlist: Playlist }) => ({
    playlist: playlist.observe(),
  }),
)(SearchPlaylistCardBase);
SearchPlaylistCard.displayName = "SearchPlaylistCard";

const SearchTagCardBase = ({ tag, onPress, isCompact = true }: { tag: Tag; onPress: () => void; isCompact?: boolean }) => {
  const { colors } = useAppTheme();
  const tagBg = tag.color || colors.accent;
  const textColor = getDynamicTagTextColor(tagBg);
  if (isCompact) {
    return (
      <TouchableOpacity
        style={[styles.tagCard, { backgroundColor: tagBg }]}
        onPress={onPress}
        onLongPress={() => {
          Keyboard.dismiss();
          openTagMenu(tag);
        }}
      >
        <Ionicons name="pricetag" size={14} color={textColor} style={styles.tagCardIcon} />
        <Text style={[styles.tagCardText, { color: textColor }]} numberOfLines={1}>{tag.name}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.tagCardNormal, { backgroundColor: tagBg }]}
      onPress={onPress}
      onLongPress={() => {
        Keyboard.dismiss();
        openTagMenu(tag);
      }}
    >
      <Text style={[styles.tagCardTextNormal, { color: textColor }]} numberOfLines={2}>
        {tag.name}
      </Text>
    </TouchableOpacity>
  );
};

const SearchTagCard = withObservables(['tag'], ({ tag }: { tag: Tag }) => ({
  tag: tag.observe()
}))(SearchTagCardBase);
SearchTagCard.displayName = "SearchTagCard";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NORMAL_CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2;

// --- MAIN SCREEN ---

function SearchScreen({ tags }: { tags: Tag[] }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SearchNavigationProp>();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // A brief delay to allow WatermelonDB query to settle and populate tags
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { isCompactTags, setIsCompactTags } = useSettingsStore();

  // Advanced Tag Search States
  const [isAdvancedSearching, setIsAdvancedSearching] = useState(false);
  const [advancedIncludes, setAdvancedIncludes] = useState<string[]>([]);
  const [advancedExcludes, setAdvancedExcludes] = useState<string[]>([]);
  const [advancedMatchAll, setAdvancedMatchAll] = useState(false);
  const [advancedNoPlaylists, setAdvancedNoPlaylists] = useState(false);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<Track[]>([]);
  const [isAdvancedLoading, setIsAdvancedLoading] = useState(false);

  const executeAdvancedTagSearch = useCallback(async (includes: string[], excludes: string[], matchAll: boolean, noPlaylists: boolean) => {
    setIsAdvancedLoading(true);
    try {
      // 1. Get excluded track IDs from tags
      let excludedTrackIds: string[] = [];
      if (excludes.length > 0) {
        const excludedRelations = await database.collections.get<TrackTag>('track_tags')
          .query(Q.where('tag_id', Q.oneOf(excludes)))
          .fetch();
        excludedTrackIds = excludedRelations.map(r => (r as any)._raw.track_id);
      }

      // 2. Get tracks in playlists if noPlaylists is active
      if (noPlaylists) {
        const playlistTracks = await database.collections.get<PlaylistTrack>('playlist_tracks').query().fetch();
        const trackIdsInPlaylists = playlistTracks.map(pt => (pt as any)._raw.track_id);
        excludedTrackIds = Array.from(new Set([...excludedTrackIds, ...trackIdsInPlaylists]));
      }

      // 3. Get included track IDs
      let matchingTrackIds: string[] = [];
      if (includes.length > 0) {
        if (matchAll) {
          let tempIds: string[] | null = null;
          for (const tagId of includes) {
            const tagRelations = await database.collections.get<TrackTag>('track_tags')
              .query(Q.where('tag_id', tagId))
              .fetch();
            const ids = tagRelations.map(r => (r as any)._raw.track_id);
            if (tempIds === null) {
              tempIds = ids;
            } else {
              tempIds = tempIds.filter(id => ids.includes(id));
            }
            if (tempIds.length === 0) break;
          }
          matchingTrackIds = tempIds || [];
        } else {
          const tagRelations = await database.collections.get<TrackTag>('track_tags')
            .query(Q.where('tag_id', Q.oneOf(includes)))
            .fetch();
          matchingTrackIds = Array.from(new Set(tagRelations.map(r => (r as any)._raw.track_id)));
        }
      } else {
        // No includes: match all tracks in database except excluded ones
        const allTracks = await database.collections.get<Track>('tracks').query().fetch();
        matchingTrackIds = allTracks.map(t => t.id);
      }

      // 4. Subtract excluded IDs
      if (excludedTrackIds.length > 0) {
        matchingTrackIds = matchingTrackIds.filter(id => !excludedTrackIds.includes(id));
      }

      // 5. Fetch actual Track records
      if (matchingTrackIds.length === 0) {
        setAdvancedSearchResults([]);
      } else {
        const tracks = await database.collections.get<Track>('tracks')
          .query(Q.where('id', Q.oneOf(matchingTrackIds)))
          .fetch();
        setAdvancedSearchResults(tracks);
      }
    } catch (e) {
      console.error('Error executing advanced tag search:', e);
      setAdvancedSearchResults([]);
    } finally {
      setIsAdvancedLoading(false);
    }
  }, []);

  const handleClearAdvancedSearch = useCallback(() => {
    setIsAdvancedSearching(false);
    setAdvancedIncludes([]);
    setAdvancedExcludes([]);
    setAdvancedNoPlaylists(false);
    setAdvancedSearchResults([]);
  }, []);

  const openAdvancedSearchSheet = useCallback(() => {
    useUIStore.getState().openSheet('advanced-tag-search', {
      initialIncludes: advancedIncludes,
      initialExcludes: advancedExcludes,
      initialMatchAll: advancedMatchAll,
      initialNoPlaylists: advancedNoPlaylists,
      onSearch: ({ includes, excludes, matchAll, noPlaylists }: any) => {
        setAdvancedIncludes(includes);
        setAdvancedExcludes(excludes);
        setAdvancedMatchAll(matchAll);
        setAdvancedNoPlaylists(noPlaylists);
        setIsAdvancedSearching(true);
        executeAdvancedTagSearch(includes, excludes, matchAll, noPlaylists);
      }
    });
  }, [advancedIncludes, advancedExcludes, advancedMatchAll, advancedNoPlaylists, executeAdvancedTagSearch]);

  const {
    results,
    topMatch,
    isLoading: isTextSearchLoading,
    isSearching: isTextSearching,
    loadMoreTracks,
    isLoadingMore,
  } = useMusicSearch(query);

  const isSearching = isTextSearching;
  const isCurrentlySearching = isSearching || isAdvancedSearching;
  const isLoading = isTextSearchLoading || isAdvancedLoading;

  // Clear advanced search if query text changes
  useEffect(() => {
    if (query.trim().length > 0 && isAdvancedSearching) {
      handleClearAdvancedSearch();
    }
  }, [query, isAdvancedSearching, handleClearAdvancedSearch]);

  const { history, saveSearch, clearHistory, deleteHistoryItem } =
    useSearchHistory();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const [headerHeight, setHeaderHeight] = useState(150);
  const { colors } = useAppTheme();

  const getFilterLabel = (id: FilterOption) => {
    switch (id) {
      case "all": return t("actions.all");
      case "artists": return t("library.artists");
      case "albums": return t("library.albums");
      case "tracks": return t("library.songs");
      case "playlists": return t("library.playlists");
      case "tags": return t("navigation.tags");
      default: return "";
    }
  };

  // --- NUEVA LÓGICA: ¿ES EL ÚNICO RESULTADO? ---
  const totalResultsCount =
    results.artists.length + results.albums.length + results.tracks.length + results.playlists.length + results.tags.length;
  const isOnlyTopMatch = totalResultsCount === 1 && !!topMatch;

  // --- MEJOR RESULTADO POR CATEGORÍA ---
  const getLocalTopMatch = (): TopMatch | null => {
    if (!isSearching) return null;
    if (activeFilter === "all") return topMatch;
    if (activeFilter === "artists" && results.artists.length > 0)
      return { type: "artist", item: results.artists[0] };
    if (activeFilter === "albums" && results.albums.length > 0)
      return { type: "album", item: results.albums[0] };
    if (activeFilter === "tracks" && results.tracks.length > 0)
      return { type: "track", item: results.tracks[0] };
    if (activeFilter === "playlists" && results.playlists.length > 0)
      return { type: "playlist", item: results.playlists[0] };
    return null;
  };
  const currentTopMatch = getLocalTopMatch();

  const flatListRef = useRef<any>(null);
  useScrollToTop(flatListRef);

  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleResultClick = useCallback(
    (text?: string) => {
      const textToSave = text || queryRef.current;
      if (textToSave.trim()) {
        saveSearch(textToSave);
        Keyboard.dismiss();
      }
    },
    [saveSearch],
  );

  const handleAlbumPress = useCallback((albumId: string) => {
    handleResultClick();
    navigation.navigate("AlbumDetail", { albumId });
  }, [handleResultClick, navigation]);

  const handleArtistPress = useCallback((artistId: string) => {
    handleResultClick();
    navigation.navigate("ArtistDetail", { artistId });
  }, [handleResultClick, navigation]);

  const handleTrackPress = useCallback(() => {
    handleResultClick();
  }, [handleResultClick]);

  const handlePlaylistPress = useCallback((playlistId: string) => {
    handleResultClick();
    navigation.navigate("PlaylistDetail", { playlistId });
  }, [handleResultClick, navigation]);

  const handleTopMatchPress = useCallback(() => {
    if (!currentTopMatch) return;

    handleResultClick();

    if (currentTopMatch.type === "artist") {
      navigation.navigate("ArtistDetail", {
        artistId: (currentTopMatch.item as Artist).id,
      });
    } else if (currentTopMatch.type === "album") {
      navigation.navigate("AlbumDetail", {
        albumId: (currentTopMatch.item as Album).id,
      });
    } else if (currentTopMatch.type === "playlist") {
      navigation.navigate("PlaylistDetail", {
        playlistId: (currentTopMatch.item as Playlist).id,
      });
    } else if (currentTopMatch.type === "track") {
      const track = currentTopMatch.item as Track;
      (async () => {
        try {
          const album = await track.album.fetch();
          const collaborators = await track.queryCollaborators.fetch() as Artist[];
          const artistNames = collaborators.length > 0
            ? collaborators.map(a => a.name).join(', ')
            : t('actions.unknown');

          HistoryService.updateUIRecents({
            id: track.id,
            type: "track",
            context: "manual",
            title: track.title,
            subtitle: artistNames,
            imageUrl: album?.coverUrl || null,
          });
        } catch (error) {
          console.error("Error al actualizar recientes para top match:", error);
        }
      })();

      usePlayerStore.getState().playSingleTrack(track, "search");
    }
  }, [currentTopMatch, handleResultClick, navigation, t]);

  useEffect(() => {
    const tabNavigator: any = navigation.getParent();
    if (!tabNavigator) return;

    const unsubscribe = tabNavigator.addListener("tabPress", (e: any) => {
      const state = tabNavigator.getState();
      const currentRoute = state.routes[state.index];

      if (currentRoute.key === e.target) {
        setQuery("");
        setActiveFilter("all");
        handleClearAdvancedSearch();
        Keyboard.dismiss();
      }
    });

    return unsubscribe;
  }, [navigation, handleClearAdvancedSearch]);

  const handleSearchSubmit = useCallback(() => {
    if (query.trim()) {
      saveSearch(query);
      Keyboard.dismiss();
    }
  }, [query, saveSearch]);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    Keyboard.dismiss();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      {isAdvancedSearching && (
        <View style={[styles.advancedFilterStrip, { borderColor: colors.accentAlpha30 }]}>
          <View style={styles.advancedFilterTextContainer}>
            <Ionicons name="color-filter" size={18} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={styles.advancedFilterTitle}>
              {t('search.advanced_search_active') || "Búsqueda de etiquetas activa"}
              {` (${advancedSearchResults.length})`}
            </Text>
          </View>
          <View style={styles.advancedFilterActions}>
            <TouchableOpacity onPress={openAdvancedSearchSheet} style={[styles.advancedFilterEditBtn, { backgroundColor: colors.accent }]}>
              <Text style={[styles.advancedFilterEditBtnText, { color: colors.onAccent }]}>
                {t('actions.edit') || "Editar"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearAdvancedSearch} style={styles.advancedFilterCloseBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isCurrentlySearching && isKeyboardVisible && history.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.sectionHeaderWithAction}>
            <SectionHeader title={t('search.recent')} />
            <TouchableOpacity onPress={clearHistory}>
              <Text style={[styles.clearHistoryText, { color: colors.accent }]}>{t('actions.clear_all')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyList}>
            {history.map((item) => (
              <HistoryItem
                key={item.id}
                query={item.query}
                onDelete={() => deleteHistoryItem(item.id)}
                onPress={() => {
                  setQuery(item.query);
                  saveSearch(item.query);
                  Keyboard.dismiss();
                }}
              />
            ))}
          </View>
        </View>
      )}

      {/* Botón de búsqueda avanzada de etiquetas */}
      {!isCurrentlySearching && (
        <TouchableOpacity
          style={styles.advancedSearchButton}
          onPress={openAdvancedSearchSheet}
        >
          <Ionicons name="options-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.advancedSearchButtonText}>
            {t('search.advanced_tag_search_btn') || "Búsqueda avanzada de etiquetas"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Explorar por etiquetas (en lugar de sugerencias genéricas) */}
      {!isCurrentlySearching && (
        <View style={styles.tagsSection}>
          <View style={styles.tagsSectionHeader}>
            <Text style={styles.tagsSectionTitle}>{t('search.explore_tags')}</Text>
            <View style={styles.layoutSwitchContainer}>
              <Text style={styles.layoutSwitchLabel}>
                {isCompactTags ? t('search.compact') : t('search.normal')}
              </Text>
              <Switch
                value={isCompactTags}
                onValueChange={setIsCompactTags}
                trackColor={{ false: '#282828', true: colors.accent }}
                thumbColor={isCompactTags ? '#FFFFFF' : '#888888'}
                ios_backgroundColor="#282828"
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          </View>
          {tags.length === 0 ? (
            <Text style={styles.noTagsText}>
              {t('search.no_tags')}
            </Text>
          ) : (
            <View style={isCompactTags ? styles.tagsContainer : styles.tagsContainerNormal}>
              {tags.map((tag) => (
                <SearchTagCard
                  key={tag.id}
                  tag={tag}
                  isCompact={isCompactTags}
                  onPress={() => {
                    navigation.navigate("TagDetail", {
                      tagId: tag.id,
                      tagName: tag.name,
                      tagColor: tag.color || colors.accent
                    });
                  }}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Top Match Hero Card */}
      {isSearching && currentTopMatch && (
        <>
          <Text style={styles.resultsTitle}>{t('search.top_match')}</Text>
          <TopMatchCard match={currentTopMatch} onPress={handleTopMatchPress} />
        </>
      )}

      {/* Ocultamos el título de Resultados y las listas si solo hay un Top Match en esta vista o si no estamos buscando */}
      {isSearching && !isOnlyTopMatch &&
        (activeFilter === "all" ||
          (activeFilter === "artists" && results.artists.length > 1) ||
          (activeFilter === "albums" && results.albums.length > 1) ||
          (activeFilter === "tracks" && results.tracks.length > 1) ||
          (activeFilter === "playlists" && results.playlists.length > 1) ||
          (activeFilter === "tags" && results.tags.length > 0)) && (
          <>
            <Text style={styles.resultsTitle}>{t('search.matches')}</Text>

            {/* Artists Section */}
            {(activeFilter === "all" || activeFilter === "artists") &&
              results.artists.some(
                (artist) => artist.id !== currentTopMatch?.item.id,
              ) && (
                <>
                  <SectionHeader
                    title={activeFilter === "all" ? t('library.artists') : t('search.other_artists')}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {results.artists
                      .filter((artist) => artist.id !== currentTopMatch?.item.id)
                      .map((artist) => (
                        <SearchArtistCard
                          key={artist.id}
                          artist={artist}
                          onPress={handleArtistPress}
                        />
                      ))}
                  </ScrollView>
                </>
              )}

            {/* Albums Section */}
            {(activeFilter === "all" || activeFilter === "albums") &&
              results.albums.some(
                (album) => album.id !== currentTopMatch?.item.id,
              ) && (
                <>
                  <SectionHeader
                    title={activeFilter === "all" ? t('library.albums') : t('search.other_albums')}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {results.albums
                      .filter((album) => album.id !== currentTopMatch?.item.id)
                      .map((album) => (
                        <SearchAlbumCard
                          key={album.id}
                          album={album}
                          onPress={handleAlbumPress}
                        />
                      ))}
                  </ScrollView>
                </>
              )}

            {/* Playlists Section */}
            {(activeFilter === "all" || activeFilter === "playlists") &&
              results.playlists.some(
                (playlist) => playlist.id !== currentTopMatch?.item.id,
              ) && (
                <>
                  <SectionHeader
                    title={activeFilter === "all" ? t('library.playlists') : t('search.other_playlists')}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {results.playlists
                      .filter((playlist) => playlist.id !== currentTopMatch?.item.id)
                      .map((playlist) => (
                        <SearchPlaylistCard
                          key={playlist.id}
                          playlist={playlist}
                          onPress={handlePlaylistPress}
                        />
                      ))}
                  </ScrollView>
                </>
              )}

            {/* Tags Section */}
            {(activeFilter === "all" || activeFilter === "tags") &&
              results.tags.length > 0 && (
                <>
                  <SectionHeader
                    title={t('navigation.tags')}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {results.tags.map((tag) => (
                      <View key={tag.id} style={{ marginRight: 10, alignSelf: 'center' }}>
                        <SearchTagCard
                          tag={tag}
                          isCompact={true}
                          onPress={() => {
                            navigation.navigate("TagDetail", {
                              tagId: tag.id,
                              tagName: tag.name,
                              tagColor: tag.color || colors.accent
                            });
                          }}
                        />
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

            {(activeFilter === "all" || activeFilter === "tracks") &&
              results.tracks.some(
                (track) =>
                  currentTopMatch?.type !== "track" ||
                  track.id !== currentTopMatch.item.id,
              ) && (
                <SectionHeader
                  title={activeFilter === "all" ? t('library.songs') : t('search.more_songs')}
                />
              )}
          </>
        )}
    </View>
  );

  const renderItem = useCallback(
    (info: { item: Track }) => {
      const { item } = info;
      return (
        <View style={{ minHeight: 64, width: '100%' }}>
          <SearchTrackRow track={item} onPress={handleTrackPress} />
        </View>
      );
    },
    [handleTrackPress],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 2. CAPA DEL HUMO (INTERMEDIO) */}
      <LinearGradient
        colors={[
          '#000000',
          'rgba(0, 0, 0, 0.95)',
          'rgba(0, 0, 0, 0.8)',
          'transparent'
        ]}
        locations={[0, 0.45, 0.8, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: headerHeight + 30,
          zIndex: 1,
        }}
        pointerEvents="none"
      />

      {/* 2.5 CAPA DE ILUMINACIÓN DE ACENTO (SOBRE EL HUMO) */}
      <LinearGradient
        colors={[colors.accentAlpha20, "transparent"]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
        pointerEvents="none"
      />

      {/* 3. CAPA DE LA INTERFAZ (FRENTE) */}
      <View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[styles.searchGradient, {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 10,
          zIndex: 10,
        }]}
      >
        <Text style={styles.title}>{t('search.title')}</Text>
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={20}
              color="#B3B3B3"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t('search.placeholder')}
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              selectionColor={colors.accent}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={handleClearSearch}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#B3B3B3" />
              </TouchableOpacity>
            )}
          </View>
          {isLoading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          )}
        </View>

        {/* Filtros rápidos - Solo visibles al buscar */}
        {isSearching && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
            style={styles.filtersScroll}
            keyboardShouldPersistTaps="handled"
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.filterPill,
                    isActive && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => setActiveFilter(tab.id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isActive && [styles.filterTextActive, { color: colors.onAccent }],
                    ]}
                  >
                    {getFilterLabel(tab.id)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 1. CAPA DE CONTENIDO (AL FONDO) */}
      {isReady ? (
        <FlashList
          ref={flatListRef}
          data={
            isAdvancedSearching
              ? advancedSearchResults
              : isSearching && !isOnlyTopMatch && (activeFilter === "all" || activeFilter === "tracks")
                ? results.tracks.filter(
                  (track) =>
                    currentTopMatch?.type !== "track" ||
                    track.id !== currentTopMatch.item.id,
                )
                : []
          }
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          onEndReached={() => {
            if (activeFilter === "tracks" && !isAdvancedSearching) {
              loadMoreTracks();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => {
            if (!isLoadingMore) return <View style={{ height: 20 }} />;
            return (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            );
          }}
          contentContainerStyle={{
            paddingTop: headerHeight + 10,
            paddingBottom:
              Layout.MINI_PLAYER_HEIGHT +
              Layout.TAB_BAR_HEIGHT +
              Layout.PLAYER_MARGIN +
              insets.bottom +
              20,
          }}
          ListEmptyComponent={(() => {
            if (isLoading) return null;
            if (isAdvancedSearching) {
              if (advancedSearchResults.length === 0) {
                return (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="color-filter-outline" size={64} color="#333" />
                    <Text style={styles.emptyText}>
                      {t('search.no_tag_matches') || "No se encontraron canciones con ese filtro de etiquetas."}
                    </Text>
                  </View>
                );
              }
              return null;
            }
            if (!isSearching) return null;

            const hasArtists =
              (activeFilter === "all" || activeFilter === "artists") &&
              results.artists.length > 0;
            const hasAlbums =
              (activeFilter === "all" || activeFilter === "albums") &&
              results.albums.length > 0;
            const hasTracks =
              (activeFilter === "all" || activeFilter === "tracks") &&
              results.tracks.length > 0;
            const hasPlaylists =
              (activeFilter === "all" || activeFilter === "playlists") &&
              results.playlists.length > 0;
            const hasTags =
              (activeFilter === "all" || activeFilter === "tags") &&
              results.tags.length > 0;

            if (hasArtists || hasAlbums || hasTracks || hasPlaylists || hasTags) return null;

            return (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="#333" />
                <Text style={styles.emptyText}>
                  {t('search.no_results', { query })}
                </Text>
              </View>
            );
          })()}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      ) : (
        <View style={{ flex: 1, paddingTop: headerHeight + 60, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchGradient: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Montserrat", fontWeight: '600',
    height: "100%",
  },
  clearButton: {
    padding: 4,
  },
  loaderContainer: {
    marginLeft: 12,
  },
  header: {
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontFamily: "Montserrat",
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 15,
  },
  resultsTitle: {
    fontSize: 24,
    fontFamily: "Montserrat",
    fontWeight: "900",
    color: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 5,
  },
  horizontalScroll: {
    paddingLeft: 20,
    paddingRight: 5,
  },
  cardContainer: {
    marginRight: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
    fontFamily: "Montserrat", fontWeight: '600',
    textAlign: "center",
    marginTop: 20,
  },
  historySection: {
    marginTop: 10,
    marginBottom: 20,
  },
  sectionHeaderWithAction: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 20,
  },
  clearHistoryText: {
    color: "#8B5CF6",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: "700",
  },
  historyList: {
    paddingHorizontal: 20,
    marginTop: 5,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  historyTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  historyIcon: {
    marginRight: 12,
  },
  historyText: {
    color: "#E0E0E0",
    fontSize: 16,
    fontFamily: "Montserrat", fontWeight: '600',
  },
  historyDelete: {
    padding: 5,
  },
  filtersScroll: {
    marginTop: 15,
  },
  filtersContainer: {
    paddingBottom: 4,
    flexDirection: "row",
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  filterText: {
    color: "#B3B3B3",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  tagsSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  smartListsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 10,
    width: '100%',
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  tagCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 100,
    justifyContent: "center",
  },
  tagCardIcon: {
    marginRight: 6,
  },
  tagCardText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: "700",
  },
  noTagsText: {
    color: "#666666",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 8,
  },
  tagsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 5,
  },
  tagsSectionTitle: {
    fontSize: 24,
    fontFamily: "Montserrat",
    fontWeight: "900",
    color: "#FFFFFF",
    flex: 1,
    marginRight: 10,
  },
  layoutSwitchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  layoutSwitchLabel: {
    fontSize: 12,
    fontFamily: "Montserrat",
    fontWeight: "700",
    color: "#666666",
  },
  tagsContainerNormal: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  tagCardNormal: {
    width: NORMAL_CARD_WIDTH,
    height: 80,
    borderRadius: 16,
    padding: 16,
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  tagCardTextNormal: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Montserrat",
    fontWeight: "800",
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  advancedSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  advancedSearchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
  },
  advancedFilterStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1A2A',
    borderWidth: 1,
    borderColor: '#8B5CF644',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  advancedFilterTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  advancedFilterTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
  },
  advancedFilterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  advancedFilterEditBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  advancedFilterEditBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Montserrat',
    fontWeight: '700',
  },
  advancedFilterCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default withObservables([], () => ({
  tags: database.collections.get<Tag>("tags").query().observe(),
}))(SearchScreen);
