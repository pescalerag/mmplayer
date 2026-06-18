import { Ionicons } from "@expo/vector-icons";
import { getDynamicTagTextColor } from '../utils/color';
import withObservables from "@nozbe/with-observables";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/theme";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { FlashList } from '@shopify/flash-list';
import {
    ActivityIndicator,
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LibraryCard from "../components/LibraryCard";
import SectionHeader from "../components/SectionHeader";
import TopMatchCard from "../components/TopMatchCard";
import TrackRow from "../components/TrackRow";
import Album from "../database/models/Album";
import Artist from "../database/models/Artist";
import Tag from "../database/models/Tag";
import Track from "../database/models/Track";
import { database } from "../database";
import { useMusicSearch, TopMatch } from "../hooks/useMusicSearch";
import { useSearchHistory } from "../hooks/useSearchHistory";
import { SearchStackParamList } from "../navigation/types";
import { usePlayerStore } from "../store/usePlayerStore";
import { useAlbumMenuStore } from "../store/useAlbumMenuStore";
import { useArtistMenuStore } from "../store/useArtistMenuStore";
import { Layout } from "../theme/theme";
import { HistoryService } from "../services/HistoryService";
import { useTranslation } from "react-i18next";

type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

type FilterOption = "all" | "artists" | "albums" | "tracks";

const FILTER_TABS: { id: FilterOption }[] = [
  { id: "all" },
  { id: "artists" },
  { id: "albums" },
  { id: "tracks" },
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
  album: Album;
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
      onPress={handlePress}
    />
  );
};

const SearchTrackRow = withObservables(
  ["track"],
  ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe(),
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
  artist: Artist;
  onPress: (albumId: string) => void;
}) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => onPress(album.id), [onPress, album.id]);
  const handleLongPress = useCallback(() => {
    Keyboard.dismiss();
    useAlbumMenuStore.getState().openMenu(album);
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
    artist: album.artist.observe(),
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
    useArtistMenuStore.getState().openMenu(artist);
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

const SearchTagCardBase = ({ tag, onPress }: { tag: Tag; onPress: () => void }) => {
  const textColor = getDynamicTagTextColor(tag.color || '#8B5CF6');
  return (
    <TouchableOpacity
      style={[styles.tagCard, { backgroundColor: tag.color || '#8B5CF6' }]}
      onPress={onPress}
    >
      <Ionicons name="pricetag" size={14} color={textColor} style={styles.tagCardIcon} />
      <Text style={[styles.tagCardText, { color: textColor }]} numberOfLines={1}>{tag.name}</Text>
    </TouchableOpacity>
  );
};

const SearchTagCard = withObservables(['tag'], ({ tag }: { tag: Tag }) => ({
  tag: tag.observe()
}))(SearchTagCardBase);
SearchTagCard.displayName = "SearchTagCard";

// --- MAIN SCREEN ---

function SearchScreen({ tags }: { tags: Tag[] }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SearchNavigationProp>();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const {
    results,
    topMatch,
    isLoading,
    isSearching,
    loadMoreTracks,
    isLoadingMore,
  } = useMusicSearch(query);
  const { history, saveSearch, clearHistory, deleteHistoryItem } =
    useSearchHistory();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const [headerHeight, setHeaderHeight] = useState(150);

  const getFilterLabel = (id: FilterOption) => {
    switch (id) {
      case "all": return t("actions.all");
      case "artists": return t("library.artists");
      case "albums": return t("library.albums");
      case "tracks": return t("library.songs");
      default: return "";
    }
  };

  // --- NUEVA LÓGICA: ¿ES EL ÚNICO RESULTADO? ---
  const totalResultsCount =
    results.artists.length + results.albums.length + results.tracks.length;
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
    return null;
  };
  const currentTopMatch = getLocalTopMatch();

  const flatListRef = useRef<any>(null);
  useScrollToTop(flatListRef);

  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

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
        Keyboard.dismiss();
      }
    });

    return unsubscribe;
  }, [navigation]);

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
      {!isSearching && history.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.sectionHeaderWithAction}>
            <SectionHeader title={t('search.recent')} />
            <TouchableOpacity onPress={clearHistory}>
              <Text style={styles.clearHistoryText}>{t('actions.clear_all')}</Text>
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

      {/* Explorar por etiquetas (en lugar de sugerencias genéricas) */}
      {!isSearching && (
        <View style={styles.tagsSection}>
          <Text style={styles.resultsTitle}>{t('search.explore_tags')}</Text>
          {tags.length === 0 ? (
            <Text style={styles.noTagsText}>
              {t('search.no_tags')}
            </Text>
          ) : (
            <View style={styles.tagsContainer}>
              {tags.map((tag) => (
                <SearchTagCard
                  key={tag.id}
                  tag={tag}
                  onPress={() => {
                    navigation.navigate("TagDetail", {
                      tagId: tag.id,
                      tagName: tag.name,
                      tagColor: tag.color || '#8B5CF6'
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
          (activeFilter === "tracks" && results.tracks.length > 1)) && (
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
    <View style={styles.container}>
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

      {/* 2.5 CAPA DE ILUMINACIÓN MORADA (SOBRE EL HUMO) */}
      <LinearGradient
        colors={["#8B5CF633", "transparent"]}
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
              selectionColor="#8B5CF6"
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
              <ActivityIndicator size="small" color="#8B5CF6" />
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
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.filterPill,
                    isActive && styles.filterPillActive,
                  ]}
                  onPress={() => setActiveFilter(tab.id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isActive && styles.filterTextActive,
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
      <FlashList
        ref={flatListRef}
        data={
          isSearching && !isOnlyTopMatch && (activeFilter === "all" || activeFilter === "tracks")
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
          if (activeFilter === "tracks") {
            loadMoreTracks();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => {
          if (!isLoadingMore) return <View style={{ height: 20 }} />;
          return (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#8B5CF6" />
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
          if (isLoading || !isSearching) return null;

          // Verificar si hay algún resultado visible según el filtro activo
          const hasArtists =
            (activeFilter === "all" || activeFilter === "artists") &&
            results.artists.length > 0;
          const hasAlbums =
            (activeFilter === "all" || activeFilter === "albums") &&
            results.albums.length > 0;
          const hasTracks =
            (activeFilter === "all" || activeFilter === "tracks") &&
            results.tracks.length > 0;

          if (hasArtists || hasAlbums || hasTracks) return null;

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
});

export default withObservables([], () => ({
  tags: database.collections.get<Tag>("tags").query().observe(),
}))(SearchScreen);
