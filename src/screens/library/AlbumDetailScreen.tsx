import { openAlbumMenu, openTagManager } from '@/store/useUIStore';
import { Ionicons } from "@expo/vector-icons";
import { Q } from "@nozbe/watermelondb";
import withObservables from "@nozbe/with-observables";
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { useNavigation, useRoute } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrackPlayer, {
  State,
} from "react-native-track-player";
import { usePlaybackState } from "../../hooks/usePlaybackState";
import DetailHeaderLayout from '@/components/layouts/DetailHeaderLayout';
import { getDynamicTagTextColor } from "../../utils/color";
import { formatAlbumDuration } from "../../utils/time";

import SectionHeader from '@/components/common/SectionHeader';
import TrackRow from '@/components/player/TrackRow';

import { useAppTheme } from "@/hooks/useAppTheme";
import { useTranslation } from "react-i18next";
import { database } from "../../database";
import Album from "../../database/models/Album";
import Artist from "../../database/models/Artist";
import Tag from "../../database/models/Tag";
import Track from "../../database/models/Track";
import { AlbumDetailRouteProp } from "../../navigation/types";
import { HistoryService } from "../../services/HistoryService";

import { usePlayerStore } from "../../store/usePlayerStore";
import { useSettingsStore } from "../../store/useSettingsStore";

import { Layout } from "../../theme/theme";

const AlbumTrackRow = withObservables(
  ["track"],
  ({ track }: { track: Track }) => ({
    track: track.observe(),
    artists: track.queryCollaborators.observe() as any,
  }),
)(function AlbumTrackRow({
  track,
  artists,
  contextId,
  index,
  onPress,
}: {
  track: Track;
  artists: Artist[];
  contextId: string;
  index?: number;
  onPress?: (trackId: string) => void;
}) {
  const { t } = useTranslation();
  const artistNames =
    artists.length > 0
      ? artists.map((a) => a.name).join(", ")
      : t('actions.unknown');
  return (
    <TrackRow
      track={track}
      contextId={contextId}
      index={index}
      artistName={artistNames}
      onPress={onPress}
      preventAutoHistory={true}
    />
  );
});

const { width } = Dimensions.get("window");
const HEADER_HEIGHT = 380;

// ─── CONTENIDO PRINCIPAL ─────────────────────────────────────────────────────
interface Props {
  album: Album;
  artist: Artist | null;
  tracks: Track[];
  tags: Tag[];
}

function AlbumDetailContent({
  album,
  artist,
  tracks: rawTracks,
  tags,
  isLoadingTracks,
}: Props & { isLoadingTracks: boolean }) {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const navigation = useNavigation<any>();
  const showTagColors = useSettingsStore((state) => state.showTagColors);
  const excludedSongs = useSettingsStore((state) => state.excludedSongs);
  const { t } = useTranslation();

  const tracks = React.useMemo(() => {
    const excluded = excludedSongs || [];
    return rawTracks.filter((t) => !excluded.includes(t.fileUrl));
  }, [rawTracks, excludedSongs]);

  // ─── ESTADOS DEL REPRODUCTOR ───
  const playbackState = usePlaybackState();
  const isPlaying =
    playbackState.state === State.Playing ||
    playbackState.state === State.Buffering;
  const playbackContext = usePlayerStore((state) => state.playbackContext);

  // Determinar si este álbum es el contexto actual
  const albumContextId = `album-${album.id}`;
  const isCurrentAlbum = playbackContext === albumContextId;
  const isCurrentAlbumPlaying = isCurrentAlbum && isPlaying;

  const handleOpenTagManager = React.useCallback(() => {
    openTagManager('album', album.id, album.title);
  }, [album]);

  const handleOpenAlbumMenu = React.useCallback(() => {
    openAlbumMenu(album);
  }, [album]);

  const totalDuration = tracks.reduce(
    (sum: number, t: Track) => sum + (t.duration || 0),
    0,
  );

  const handleBack = () => {
    navigation.goBack();
  };

  const navigateToArtist = () => {
    if (!artist) return;
    const state = navigation.getState();
    const previousRoute = state.routes[state.routes.length - 2];
    const params = previousRoute?.params as { artistId?: string } | undefined;

    if (
      previousRoute?.name === "ArtistDetail" &&
      params?.artistId === artist.id
    ) {
      navigation.goBack();
    } else {
      navigation.navigate("ArtistDetail", { artistId: artist.id });
    }
  };

  const handleTrackPress = React.useCallback(
    (trackId: string) => {
      HistoryService.updateUIRecents({
        id: album.id,
        type: "album",
        context: "manual",
        title: album.title,
        subtitle: artist?.name,
        imageUrl: album.coverUrl,
      });

      const trackIndex = tracks.findIndex((t) => t.id === trackId);
      if (trackIndex !== -1) {
        usePlayerStore.getState().loadQueue(tracks, trackIndex, albumContextId);
      }
    },
    [tracks, albumContextId, album.id, album.title, artist?.name, album.coverUrl],
  );

  // ─── LÓGICA DEL BOTÓN FLOTANTE (FAB) ───
  const handleFabPress = async () => {
    if (!tracks || tracks.length === 0) return;
    HistoryService.updateUIRecents({
      id: album.id,
      type: "album",
      context: "manual",
      title: album.title,
      subtitle: artist?.name,
      imageUrl: album.coverUrl,
    });
    if (isCurrentAlbum) {
      if (isPlaying) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } else {
      usePlayerStore.getState().loadQueue(tracks, 0, albumContextId);
    }
  };

  const handleShuffleFabPress = () => {
    if (!tracks || tracks.length === 0) return;
    HistoryService.updateUIRecents({
      id: album.id,
      type: "album",
      context: "manual",
      title: album.title,
      subtitle: artist?.name,
      imageUrl: album.coverUrl,
    });
    usePlayerStore.getState().startShuffled(tracks, albumContextId);
  };

  const listHeader = (
    <>
      <DetailHeaderLayout
        title={album.title}
        imageUrl={album.coverUrl}
        placeholderIcon="albums"
        renderHeaderPrefix={() => (
          <View style={styles.tagsRow}>
            {tags && tags.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagsScroll}
                keyboardShouldPersistTaps="handled"
              >
                {tags.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: showTagColors
                          ? t.color
                          : colors.overlayAlpha08,
                      },
                    ]}
                    onPress={handleOpenTagManager}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        {
                          color: showTagColors
                            ? getDynamicTagTextColor(t.color)
                            : colors.text,
                        },
                      ]}
                    >
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={handleOpenTagManager}
              >
                <Ionicons name="add-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.addTagText}>{t('actions.add_tag')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        subtitle={
          artist ? (
            artist.name !== "Varios Artistas" ? (
              <TouchableOpacity onPress={navigateToArtist}>
                <Text style={styles.artistNameLink}>{artist.name}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.artistName}>{artist.name}</Text>
            )
          ) : (
            <Text style={styles.artistName}>{t('actions.unknown')}</Text>
          )
        }
        metaInfo={[
          album.year,
          `${tracks.length} ${tracks.length === 1 ? t('library.song_singular') : t('library.song_plural')}`,
          !isLoadingTracks && totalDuration > 0
            ? formatAlbumDuration(totalDuration)
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        onBack={handleBack}
        onMore={handleOpenAlbumMenu}
        renderExtra={() =>
          tracks.length > 0 && (
            <>
              {/* Botón Shuffle */}
              <TouchableOpacity
                style={styles.shuffleFab}
                onPress={handleShuffleFabPress}
              >
                <Ionicons name="shuffle" size={22} color={colors.text} />
              </TouchableOpacity>

              {/* Botón Play/Pause */}
              <TouchableOpacity style={styles.playFab} onPress={handleFabPress}>
                <Ionicons
                  name={isCurrentAlbumPlaying ? "pause" : "play"}
                  size={28}
                  color={colors.text}
                  style={isCurrentAlbumPlaying ? {} : { marginLeft: 4 }}
                />
              </TouchableOpacity>
            </>
          )
        }
      />

      {/* ── SECCIÓN DE CANCIONES (FUERA DEL HEADER FIJO) ── */}
      <View style={{ marginTop: 0, marginBottom: 4 }}>
        <SectionHeader title={t('library.songs')} />
        <View style={styles.divider} />
      </View>
    </>
  );

  const renderItem = React.useCallback(
    (info: { item: Track; index: number }) => {
      const { item, index } = info;
      const showDiscHeader =
        index === 0 || tracks[index - 1].discNumber !== item.discNumber;

      return (
        <View style={{ minHeight: 64, width: '100%' }}>
          {showDiscHeader && item.discNumber && item.discNumber > 1 && (
            <View style={styles.discHeader}>
              <Ionicons name="disc-outline" size={16} color={colors.accent} />
              <Text style={styles.discText}>{t('library.disc_singular')} {item.discNumber}</Text>
            </View>
          )}
          <AlbumTrackRow
            track={item}
            contextId={`album-${album.id}`}
            index={item.trackNumber || index + 1}
            onPress={handleTrackPress}
          />
        </View>
      );
    },
    [tracks, album.id, handleTrackPress, t, colors.accent, styles.discHeader, styles.discText],
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <FlashList
        data={isLoadingTracks ? [] : tracks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          isLoadingTracks ? (
            <ActivityIndicator
              color={colors.accent}
              size="large"
              style={{ marginTop: 40 }}
            />
          ) : (
            <Text style={styles.emptyText}>
              {t('actions.no_album_songs_scanned')}
            </Text>
          )
        }
        contentContainerStyle={{
          paddingBottom:
            Layout.MINI_PLAYER_HEIGHT +
            Layout.TAB_BAR_HEIGHT +
            Layout.PLAYER_MARGIN +
            insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function AlbumDetailErrorFallback() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 16 }} />
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
        Este álbum ya no existe en tu biblioteca
      </Text>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 16 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{t('actions.back') || 'Volver'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const EnhancedAlbumDetailContent = withObservables(["album"], ({ album }: { album: Album }) => ({
  album: album.observe(),
  artist: album.artist.observe().pipe(catchError(() => of(null))),
  tracks: database.collections.get<Track>("tracks").query(
    Q.where("album_id", album.id),
    Q.sortBy("disc_number", Q.asc),
    Q.sortBy("track_number", Q.asc),
  ).observe(),
  tags: album.queryTags.observe() as any,
}))(AlbumDetailContent);

const ObservableAlbumDetailMiddle = withObservables(["albumId"], ({ albumId }: { albumId: string }) => ({
  album: database.collections.get<Album>("albums").findAndObserve(albumId).pipe(catchError(() => of(null))),
}))(function ObservableAlbumDetailMiddle({ album }: { album: Album | null }) {
  if (!album) {
    return <AlbumDetailErrorFallback />;
  }
  return <EnhancedAlbumDetailContent album={album} isLoadingTracks={false} />;
});

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
export default function AlbumDetailScreen() {
  const route = useRoute<AlbumDetailRouteProp>();
  const { albumId } = route.params;

  return <ObservableAlbumDetailMiddle albumId={albumId} />;
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    width,
    height: HEADER_HEIGHT,
    position: "relative",
  },
  headerImage: {
    width,
    height: HEADER_HEIGHT,
  },
  headerPlaceholder: {
    backgroundColor: colors.cardBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT * 0.75,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  albumTitle: {
    color: colors.text,
    fontSize: 28,
    fontFamily: fonts.regular,
    fontWeight: "bold",
    marginBottom: 4,
  },
  artistName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: "700",
    marginBottom: 4,
  },
  artistNameLink: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: "700",
  },
  albumMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: "700",
  },
  playFab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  shuffleFab: {
    position: "absolute",
    bottom: 20,
    right: 86,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBackground,
    marginHorizontal: 20,
    marginBottom: 4,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
  discHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  discText: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: "bold",
    marginLeft: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    minHeight: 24,
  },
  tagsScroll: {
    gap: 6,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    color: colors.text,
    fontSize: 11,
    fontFamily: fonts.regular,
    fontWeight: "800",
  },
  addTagButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
  },
  addTagText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.regular,
    fontWeight: "700",
  },
});
