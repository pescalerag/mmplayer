import { openPlaylistMenu, openPlaylistSelectorEdit } from '@/store/useUIStore';
import { Ionicons } from "@expo/vector-icons";
import { Q } from "@nozbe/watermelondb";
import withObservables from "@nozbe/with-observables";
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAppTheme } from '@/hooks/useAppTheme';
import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import PlaylistCover from '@/components/player/PlaylistCover';
import SectionHeader from '@/components/common/SectionHeader';
import TrackRow from '@/components/player/TrackRow';
import { database } from "../../database";
import Album from "../../database/models/Album";
import Artist from "../../database/models/Artist";
import Playlist from "../../database/models/Playlist";
import PlaylistTrack from "../../database/models/PlaylistTrack";
import Track from "../../database/models/Track";
import { HistoryService } from "../../services/HistoryService";
import { PlaylistService } from "../../services/PlaylistService";
import { usePlayerStore } from "../../store/usePlayerStore";


import { useSettingsStore } from "../../store/useSettingsStore";
import { Colors, Layout } from "../../theme/theme";
import { formatAlbumDuration } from "../../utils/time";

const { width } = Dimensions.get("window");

// ─── PLAYLIST TRACK ROW WITH METADATA ───
const PlaylistTrackRowWithMetadata = withObservables(
  ["track"],
  ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe().pipe(catchError(() => of(null))),
    artists: track.queryCollaborators.observe() as any,
  }),
)(function PlaylistTrackRowWithMetadata({
  track,
  album,
  artists,
  playlistId,
  index,
  onPress,
}: {
  track: Track;
  album: Album | null;
  artists: Artist[];
  playlistId: string;
  index: number;
  onPress: (trackId: string) => void;
}) {
  const { t } = useTranslation();
  const artistNames =
    artists.length > 0
      ? artists.map((a) => a.name).join(", ")
      : t('actions.unknown');
  return (
    <TrackRow
      track={track}
      contextId={`playlist-${playlistId}`}
      index={index}
      coverUrl={album?.coverUrl}
      artistName={artistNames}
      playlistId={playlistId}
      onPress={onPress}
      preventAutoHistory={true}
    />
  );
});

// ─── PLAYLIST TRACK ROW WRAPPER ───
const PlaylistTrackRow = withObservables(
  ["playlistTrack"],
  ({ playlistTrack }: { playlistTrack: PlaylistTrack }) => ({
    playlistTrack: playlistTrack.observe(),
    track: playlistTrack.track.observe().pipe(catchError(() => of(null))),
  }),
)(function PlaylistTrackRow({
  playlistTrack,
  track,
  playlistId,
  index,
  onPress,
}: {
  playlistTrack: PlaylistTrack;
  track: Track | null;
  playlistId: string;
  index: number;
  onPress: (trackId: string) => void;
}) {
  if (!track) return null;
  return (
    <PlaylistTrackRowWithMetadata
      track={track}
      playlistId={playlistId}
      index={index}
      onPress={onPress}
    />
  );
});

// ─── MAIN PLAYLIST SCREEN CONTENT ───
interface PlaylistDetailContentProps {
  playlist: Playlist;
  playlistTracks: PlaylistTrack[];
}

function PlaylistDetailContent({
  playlist,
  playlistTracks,
}: PlaylistDetailContentProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [rawTracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const excludedSongs = useSettingsStore((state) => state.excludedSongs);

  const tracks = React.useMemo(() => {
    const excluded = excludedSongs || [];
    return rawTracks.filter((t) => !excluded.includes(t.fileUrl));
  }, [rawTracks, excludedSongs]);

  // Resolve Track records from PlaylistTrack relation
  useEffect(() => {
    let isMounted = true;
    const loadTracks = async () => {
      setLoadingTracks(true);
      try {
        // Obtenemos todas las promesas a la vez y las resolvemos en paralelo
        const resolvedTracks = await Promise.all(
          playlistTracks.map(async (pt) => {
            try {
              return await pt.track.fetch();
            } catch (e) {
              console.warn("Error cargando pista huerfana en playlist", e);
              return null;
            }
          }),
        );

        // Filtramos por si alguna canción fue borrada del dispositivo
        const validTracks = resolvedTracks.filter(
          (t): t is Track => t !== null,
        );

        if (isMounted) {
          setTracks(validTracks);
          setLoadingTracks(false);
        }
      } catch (err) {
        console.error("Error loading playlist tracks:", err);
        if (isMounted) setLoadingTracks(false);
      }
    };
    loadTracks();
    return () => {
      isMounted = false;
    };
  }, [playlistTracks]);

  // Player States
  const playbackState = usePlaybackState();
  const isPlaying =
    playbackState.state === State.Playing ||
    playbackState.state === State.Buffering;
  const playbackContext = usePlayerStore((state) => state.playbackContext);

  const playlistContextId = `playlist-${playlist.id}`;
  const isCurrentPlaylist = playbackContext === playlistContextId;
  const isCurrentPlaylistPlaying = isCurrentPlaylist && isPlaying;

  const totalDuration = tracks.reduce(
    (sum: number, t: Track) => sum + (t.duration || 0),
    0,
  );

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDelete = () => {
    Alert.alert(
      t('actions.delete_playlist_title'),
      t('actions.delete_playlist_confirm', { name: playlist.name }),
      [
        { text: t('actions.cancel'), style: "cancel" },
        {
          text: t('actions.delete'),
          style: "destructive",
          onPress: async () => {
            try {
              navigation.goBack();
              await PlaylistService.deletePlaylist(playlist.id);
              usePlayerStore.getState().removePlaylistFromRecents(playlist.id);
            } catch (err) {
              console.error("Error al eliminar la playlist:", err);
              Alert.alert(
                t('actions.error'),
                t('actions.delete_playlist_error'),
              );
            }
          },
        },
      ],
    );
  };

  const handleEdit = () => {
    openPlaylistSelectorEdit(playlist);
  };

  const handleOpenPlaylistMenu = useCallback(() => {
    openPlaylistMenu(playlist);
  }, [playlist]);

  const handleTrackPress = useCallback(
    (trackId: string) => {
      HistoryService.updateUIRecents({
        id: playlist.id,
        type: "playlist",
        context: "manual",
        title: playlist.name,
        subtitle: playlist.description || t('actions.custom_playlist_subtitle'),
        imageUrl: playlist.coverCustomUrl || null,
      });

      const trackIndex = tracks.findIndex((t) => t.id === trackId);
      if (trackIndex !== -1) {
        usePlayerStore
          .getState()
          .loadQueue(tracks, trackIndex, playlistContextId);
      }
    },
    [tracks, playlistContextId, playlist.id, playlist.name, playlist.description, playlist.coverCustomUrl, t],
  );

  const handleFabPress = async () => {
    HistoryService.updateUIRecents({
      id: playlist.id,
      type: "playlist",
      context: "manual",
      title: playlist.name,
      subtitle: playlist.description || t('actions.custom_playlist_subtitle'),
      imageUrl: playlist.coverCustomUrl || null,
    });
    if (isCurrentPlaylist) {
      if (isPlaying) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } else if (tracks.length > 0) {
      usePlayerStore.getState().loadQueue(tracks, 0, playlistContextId);
    }
  };

  const handleShuffleFabPress = () => {
    if (tracks.length > 0) {
      HistoryService.updateUIRecents({
        id: playlist.id,
        type: "playlist",
        context: "manual",
        title: playlist.name,
        subtitle: playlist.description || t('actions.custom_playlist_subtitle'),
        imageUrl: playlist.coverCustomUrl || null,
      });
      usePlayerStore.getState().startShuffled(tracks, playlistContextId);
    }
  };

  const handlePickPhoto = useCallback(async () => {
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });
    } catch (error) {
      console.error("PickPhoto: Error al lanzar explorador:", error);
      Alert.alert(t('actions.error'), t('actions.pick_photo_error'));
      return;
    }

    const asset = result.assets?.[0];
    if (!asset) return;

    try {
      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) throw new Error("No se pudo acceder al directorio local");

      const sanitized = playlist.name
        .toLowerCase()
        .normalize("NFD")
        .replaceAll(/[\u0300-\u036f]/g, "")
        .replaceAll(/[^a-z0-9]/g, "_")
        .replaceAll(/_+/g, "_")
        .trim();
      const fileName = `playlist_${playlist.id}_${sanitized}_${Date.now()}.jpg`;
      const newPath = baseDir.endsWith("/")
        ? `${baseDir}${fileName}`
        : `${baseDir}/${fileName}`;

      const oldPath = playlist.coverCustomUrl;
      if (oldPath && oldPath !== newPath && oldPath.startsWith("file://")) {
        try {
          await FileSystem.deleteAsync(oldPath, { idempotent: true });
        } catch (e) {
          console.warn("Error deleting old image:", e);
        }
      }

      await FileSystem.copyAsync({ from: asset.uri, to: newPath });
      try {
        await FileSystem.deleteAsync(asset.uri, { idempotent: true });
      } catch (e) {
        console.warn("Error deleting temp image from cache:", e);
      }

      await database.write(async () => {
        await playlist.update((p) => {
          p.coverCustomUrl = newPath;
        });
      });
      usePlayerStore.getState().updatePlaylistCoverInRecents(playlist.id, newPath);
    } catch (error) {
      console.error("Error guardando imagen:", error);
      Alert.alert(t('actions.error'), t('actions.save_photo_error'));
    }
  }, [playlist, t]);

  const listHeader = (
    <>
      <DetailHeaderLayout
        title={playlist.name}
        placeholderIcon="musical-notes"
        renderCover={() => (
          <PlaylistCover
            playlistId={playlist.id}
            customCoverUrl={playlist.coverCustomUrl}
            width={width}
            height={380}
            borderRadius={0}
          />
        )}
        subtitle={playlist.description || t('actions.custom_playlist_subtitle')}
        metaInfo={`${playlistTracks.length} ${playlistTracks.length === 1 ? t('library.song_singular') : t('library.song_plural')} · ${formatAlbumDuration(totalDuration)}`}
        onBack={handleBack}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onPickPhoto={handlePickPhoto}
        onMore={handleOpenPlaylistMenu}
        renderExtra={() =>
          tracks.length > 0 && (
            <>
              {/* Shuffle Button */}
              <TouchableOpacity
                style={styles.shuffleFab}
                onPress={handleShuffleFabPress}
              >
                <Ionicons name="shuffle" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Play/Pause Button */}
              <TouchableOpacity style={styles.playFab} onPress={handleFabPress}>
                <Ionicons
                  name={isCurrentPlaylistPlaying ? "pause" : "play"}
                  size={28}
                  color="#FFFFFF"
                  style={!isCurrentPlaylistPlaying ? { marginLeft: 4 } : {}}
                />
              </TouchableOpacity>
            </>
          )
        }
      />

      <View style={{ marginTop: 0, marginBottom: 4 }}>
        <SectionHeader title={t('actions.songs_in_playlist')} />
        <View style={styles.divider} />
      </View>
    </>
  );

  const renderItem = useCallback(
    (info: { item: PlaylistTrack; index: number }) => {
      const { item, index } = info;
      return (
        <View style={{ minHeight: 64, width: '100%' }}>
          <PlaylistTrackRow
            playlistTrack={item}
            playlistId={playlist.id}
            index={index + 1}
            onPress={handleTrackPress}
          />
        </View>
      );
    },
    [handleTrackPress, playlist.id],
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={playlistTracks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loadingTracks ? (
            <ActivityIndicator
              color="#8B5CF6"
              size="large"
              style={{ marginTop: 40 }}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={60} color="#555" />
              <Text style={styles.emptyText}>{t('actions.playlist_empty')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('actions.playlist_empty_desc')}
              </Text>
            </View>
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

// ─── ENHANCED COMPONENT WITH WATERMELONDB OBSERVABLE ───
function PlaylistDetailErrorFallback() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 16 }} />
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
        Esta playlist ya no existe en tu biblioteca
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

const ObservablePlaylistDetail = withObservables(
  ["playlistId"],
  ({ playlistId }: { playlistId: string }) => ({
    playlist: database.collections
      .get<Playlist>("playlists")
      .findAndObserve(playlistId)
      .pipe(catchError(() => of(null))),
    playlistTracks: database.collections
      .get<PlaylistTrack>("playlist_tracks")
      .query(Q.where("playlist_id", playlistId), Q.sortBy("order", Q.asc))
      .observe(),
  }),
)(function ObservablePlaylistDetail({ playlist, playlistTracks }: { playlist: Playlist | null; playlistTracks: PlaylistTrack[] }) {
  if (!playlist) {
    return <PlaylistDetailErrorFallback />;
  }
  return <PlaylistDetailContent playlist={playlist} playlistTracks={playlistTracks} />;
});

export default function PlaylistDetailScreen() {
  const route = useRoute<any>();
  const { playlistId } = route.params;

  return <ObservablePlaylistDetail playlistId={playlistId} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  divider: {
    height: 1,
    backgroundColor: "#282828",
    marginHorizontal: 20,
    marginBottom: 4,
  },
  playFab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#8B5CF6",
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Montserrat",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 16,
  },
  emptySubtitle: {
    color: "#888",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: '700',
    textAlign: "center",
    marginTop: 8,
  },
});
