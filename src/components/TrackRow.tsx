import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Keyboard } from "react-native";
import Track from "../database/models/Track";
import { useTrackMenuStore } from "../store/useTrackMenuStore";
import { formatTrackTime } from "../utils/time";
import { usePlayerStore } from "../store/usePlayerStore";
import { PlayingIndicator } from "./PlayingIndicator";
import { Colors } from "../theme/theme";
import { usePlaybackState, State } from "react-native-track-player";
import { HistoryService } from "../services/HistoryService";

import { useSettingsStore } from "../store/useSettingsStore";
import { useAppTheme } from "@/hooks/useAppTheme";

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
    const { colors, fonts, layout, spacing, radii, fontWeights } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights), [colors, fonts, layout, spacing, radii, fontWeights]);
  const openMenu = useTrackMenuStore((state) => state.openMenu);
  
  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const playbackContext = usePlayerStore((state) => state.playbackContext);
  
  const playbackStateRN = usePlaybackState();
  const isActuallyPlaying = playbackStateRN.state === State.Playing || playbackStateRN.state === State.Buffering;

  const excludedSongs = useSettingsStore((state) => state.excludedSongs) || [];
  const isExcluded = excludedSongs.includes(track.fileUrl);

  const isCurrentTrack = activeTrack?.id === track.id && 
                        (playbackContext === contextId || contextId === 'queue');

  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
      setImageError(false);
  }, [track.id]);

  if (isExcluded) {
    return null;
  }

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
              <Ionicons name="musical-note" size={16} color={colors.textSecondary} />
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
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default memo(TrackRow);

const getStyles = (colors: any, fonts: any, layout: any, spacing: any = {xs: 4, sm: 8, md: 16, lg: 24, xl: 32}, radii: any = {sm: 4, md: 8, lg: 12, full: 9999}, fontWeights: any = {regular: '400', semiBold: '600', bold: '700'}) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: layout.MINI_PLAYER_HEIGHT,
    paddingHorizontal: spacing.lg || 20,
  },
  rowActive: {
    backgroundColor: colors.accentAlpha10, // El "moradito" de la cola
  },
  leftCol: {
    marginRight: spacing.sm || 12, // 12 can fallback to sm
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: radii.sm || 4,
  },
  coverPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radii.sm || 4,
    backgroundColor: colors.cardBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: fontWeights.bold,
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: fontWeights.bold,
    marginTop: 2,
  },
  duration: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: fontWeights.bold,
  },
  indexText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: fontWeights.bold,
  },
  rightCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  moreButton: {
    padding: spacing.xs || 4,
    marginLeft: spacing.xs || 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm || 8,
  },
  titleActive: {
    color: colors.accentLight, // Violet-400
    fontWeight: fontWeights.bold,
  },
});
