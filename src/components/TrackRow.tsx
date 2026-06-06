import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Keyboard } from "react-native";
import Track from "../database/models/Track";
import { useTrackMenuStore } from "../store/useTrackMenuStore";
import { formatTrackTime } from "../utils/time";
import { usePlayerStore } from "../store/usePlayerStore";
import { PlayingIndicator } from "./PlayingIndicator";
import { usePlaybackState, State } from "react-native-track-player";
import { HistoryService } from "../services/HistoryService";

interface TrackRowProps {
  readonly track: Track;
  readonly contextId: string;
  readonly index?: number;
  readonly coverUrl?: string | null;
  readonly artistName?: string;
  readonly playlistId?: string;
  readonly onPress?: (trackId: string) => void;
  readonly preventAutoHistory?: boolean;
}

function TrackRow({
  track,
  contextId,
  index,
  coverUrl,
  artistName,
  playlistId,
  onPress,
  preventAutoHistory,
}: Readonly<TrackRowProps>) {
  const openMenu = useTrackMenuStore((state) => state.openMenu);
  
  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const playbackContext = usePlayerStore((state) => state.playbackContext);
  
  const playbackStateRN = usePlaybackState();
  const isActuallyPlaying = playbackStateRN.state === State.Playing || playbackStateRN.state === State.Buffering;

  const isCurrentTrack = activeTrack?.id === track.id && 
                        (playbackContext === contextId || contextId === 'queue');

  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
      setImageError(false);
  }, [track.id]);

  return (
    <TouchableOpacity
      style={[styles.row, isCurrentTrack && styles.rowActive]}
      onPress={() => {
        if (!preventAutoHistory) {
          HistoryService.updateUIRecents({
            id: track.id,
            type: "track",
            context: "manual",
            title: track.title,
            subtitle: artistName || "Artista desconocido",
            imageUrl: coverUrl || null,
          });
        }
        onPress?.(track.id);
      }}
      onLongPress={() => {
        Keyboard.dismiss();
        openMenu(track, {}, playlistId);
      }}
      delayLongPress={300}
      activeOpacity={0.6}
    >
      {/* Imagen o número de pista */}
      <View style={styles.leftCol}>
        {coverUrl && !imageError ? (
          <Image
            key={track.id}
            source={{ uri: coverUrl as string }}
            style={styles.cover}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            {index ? (
              <Text style={styles.indexText}>{index}</Text>
            ) : (
              <Ionicons name="musical-note" size={16} color="#B3B3B3" />
            )}
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text 
            style={[styles.title, isCurrentTrack && styles.titleActive]} 
            numberOfLines={1}
          >
            {track.title}
          </Text>
          {isCurrentTrack && <PlayingIndicator isPaused={!isActuallyPlaying} />}
        </View>
        {artistName && (
          <Text style={styles.artist} numberOfLines={1}>
            {artistName}
          </Text>
        )}
      </View>

      {/* Duración y Más */}
      <View style={styles.rightCol}>
        <Text style={styles.duration}>{formatTrackTime(track.duration)}</Text>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            Keyboard.dismiss();
            openMenu(track, {}, playlistId);
          }}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#B3B3B3" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default memo(TrackRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    paddingHorizontal: 20,
  },
  rowActive: {
    backgroundColor: "rgba(139, 92, 246, 0.1)", // El "moradito" de la cola
  },
  leftCol: {
    marginRight: 12,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 4,
  },
  coverPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: "#282828",
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Montserrat",
    fontWeight: "700",
  },
  artist: {
    color: "#CCCCCC",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: "700",
    marginTop: 2,
  },
  duration: {
    color: "#CCCCCC",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: "700",
  },
  indexText: {
    color: "#B3B3B3",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: "700",
  },
  rightCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  moreButton: {
    padding: 4,
    marginLeft: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleActive: {
    color: "#A78BFA", // Violet-400
    fontWeight: "700",
  },
});
