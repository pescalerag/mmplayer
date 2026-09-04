import { openTrackMenu, openPlaylistSelector } from '@/store/useUIStore';
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { Image } from "expo-image";
import React, { memo } from "react";
import { Keyboard, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { State } from "react-native-track-player";
import { usePlaybackState } from "../../hooks/usePlaybackState";
import { scheduleOnRN } from 'react-native-worklets';
import Track from "../../database/models/Track";
import { HistoryService } from "../../services/HistoryService";
import { usePlayerStore } from "../../store/usePlayerStore";

import { formatTrackTime } from "../../utils/time";
import { PlayingIndicator } from '@/components/common/PlayingIndicator';

import { useAppTheme } from "@/hooks/useAppTheme";
import i18n from "../../constants/i18n";
import { useMultiSelectStore } from "../../store/useMultiSelectStore";

import { SwipeAction, useSettingsStore } from "../../store/useSettingsStore";
import { useToastStore } from "../../store/useToastStore";
interface TrackRowProps {
  readonly track: Track;
  readonly contextId: string;
  readonly index?: number;
  readonly coverUrl?: string | null;
  readonly artistName?: string;
  readonly playlistId?: string;
  readonly onPress?: (trackId: string) => void;
  readonly preventAutoHistory?: boolean;
  readonly isLyricMatch?: boolean;
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
  isLyricMatch,
}: Readonly<TrackRowProps>) {
  const { colors, fonts, layout, spacing, radii, fontWeights } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights), [colors, fonts, layout, spacing, radii, fontWeights]);
  const openMenu = openTrackMenu;

  const activeTrack = usePlayerStore((state) => state.activeTrack);
  const playbackContext = usePlayerStore((state) => state.playbackContext);

  const playbackStateRN = usePlaybackState();
  const isActuallyPlaying = playbackStateRN.state === State.Playing || playbackStateRN.state === State.Buffering;

  const excludedSongs = useSettingsStore((state) => state.excludedSongs) || [];
  const isExcluded = excludedSongs.includes(track.fileUrl);

  const isSelectionMode = useMultiSelectStore(state => state.isSelectionMode);
  const isSelected = useMultiSelectStore(state => state.selectedTracks.some(t => t.id === track.id));

  const isCurrentTrack = activeTrack?.id === track.id &&
    (playbackContext === contextId || contextId === 'queue');

  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [track.id]);

  const swipeLeftAction = useSettingsStore((state) => state.swipeLeftAction);
  const swipeRightAction = useSettingsStore((state) => state.swipeRightAction);

  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);
  const SWIPE_LIMIT = 80;
  const SWIPE_THRESHOLD = 55;

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSwipeAction = React.useCallback(async (action: SwipeAction) => {
    const showToast = useToastStore.getState().showToast;
    if (action === 'add_next') {
      usePlayerStore.getState().addToQueueNext(track);
      showToast(i18n.t('toasts.playing_next'), 'return-down-forward');
    } else if (action === 'add_last') {
      usePlayerStore.getState().addToQueueEnd(track);
      showToast(i18n.t('toasts.added_to_queue'), 'list');
    } else if (action === 'add_to_playlist') {
      openPlaylistSelector(track);
    } else if (action === 'toggle_favorite') {
      const wasFavorite = track.isFavorite;
      await track.toggleLike();
      if (wasFavorite) {
        showToast(i18n.t('actions.success'), 'heart-dislike');
      } else {
        showToast(i18n.t('toasts.added_to_favourites'), 'heart');
      }
    }
  }, [track]);

  const panGesture = Gesture.Pan()
    .enabled(!isSelectionMode)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      const canSwipeRight = swipeRightAction !== 'none';
      const canSwipeLeft = swipeLeftAction !== 'none';

      let newTranslateX = event.translationX;
      if (!canSwipeRight && newTranslateX > 0) newTranslateX = 0;
      if (!canSwipeLeft && newTranslateX < 0) newTranslateX = 0;

      translateX.value = clamp(newTranslateX, -SWIPE_LIMIT, SWIPE_LIMIT);

      if (Math.abs(translateX.value) > SWIPE_THRESHOLD && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        scheduleOnRN(triggerHaptic);
      } else if (Math.abs(translateX.value) <= SWIPE_THRESHOLD) {
        hasTriggeredHaptic.value = false;
      }
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
        const action = translateX.value > 0 ? swipeRightAction : swipeLeftAction;
        scheduleOnRN(handleSwipeAction, action);
      }
      translateX.value = withSpring(0, {
        stiffness: 400,
        damping: 30,
        mass: 1,
      });
      hasTriggeredHaptic.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const leftIconStyle = useAnimatedStyle(() => {
    return {
      opacity: translateX.value > 0 ? 1 : 0,
      transform: [{ scale: translateX.value > SWIPE_THRESHOLD ? 1.2 : 1 }],
    };
  });

  const rightIconStyle = useAnimatedStyle(() => {
    return {
      opacity: translateX.value < 0 ? 1 : 0,
      transform: [{ scale: translateX.value < -SWIPE_THRESHOLD ? 1.2 : 1 }],
    };
  });

  const getActionIcon = (action: SwipeAction): any => {
    switch (action) {
      case 'add_next': return 'return-down-forward';
      case 'add_last': return 'list';
      case 'add_to_playlist': return 'add-circle-outline';
      case 'toggle_favorite': return 'heart';
      default: return 'close';
    }
  };

  if (isExcluded) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Fondo Absoluto (Underlay) */}
      <View style={[styles.underlay, { backgroundColor: colors.accent }]}>
        {swipeRightAction !== 'none' && (
          <Animated.View style={[styles.underlayIconContainer, styles.underlayIconLeft, leftIconStyle]}>
            <Ionicons name={getActionIcon(swipeRightAction)} size={24} color="#FFFFFF" />
          </Animated.View>
        )}
        {swipeLeftAction !== 'none' && (
          <Animated.View style={[styles.underlayIconContainer, styles.underlayIconRight, rightIconStyle]}>
            <Ionicons name={getActionIcon(swipeLeftAction)} size={24} color="#FFFFFF" />
          </Animated.View>
        )}
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[animatedStyle, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.row, isCurrentTrack && !isSelectionMode && styles.rowActive]}
            delayPressIn={85}
            onPress={() => {
              if (isSelectionMode) {
                useMultiSelectStore.getState().toggleTrack(track);
                return;
              }
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
              if (isSelectionMode) return;
              Keyboard.dismiss();
              openMenu(track, {}, playlistId);
            }}
            delayLongPress={300}
            activeOpacity={0.6}
          >
            {isSelectionMode && (
              <View style={{ marginRight: 12 }}>
                <Ionicons
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={isSelected ? colors.accent : colors.textSecondary}
                />
              </View>
            )}

            {/* Imagen o número de pista */}
            <View style={styles.leftCol}>
              {coverUrl && !imageError ? (
                <Image
                  key={track.id}
                  source={{ uri: coverUrl }}
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
              {contextId === 'search' && (isLyricMatch ?? (track as any).isLyricMatch) && (
                <View style={styles.lyricCoverBadge}>
                  <Ionicons name="document-text" size={10} color="#FFFFFF" />
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
              {artistName ? (
                <Text style={styles.artist} numberOfLines={1}>
                  {artistName}
                </Text>
              ) : null}
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
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default memo(TrackRow);

const DEFAULT_SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const DEFAULT_RADII = { sm: 4, md: 8, lg: 12, full: 9999 };
const DEFAULT_FONT_WEIGHTS = { regular: '400', semiBold: '600', bold: '700' };

const getStyles = (colors: any, fonts: any, layout: any, spacing: any = DEFAULT_SPACING, radii: any = DEFAULT_RADII, fontWeights: any = DEFAULT_FONT_WEIGHTS) => StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  underlay: {
    ...StyleSheet.absoluteFillObject,
  },
  underlayIconContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  underlayIconLeft: {
    left: spacing.lg || 20,
  },
  underlayIconRight: {
    right: spacing.lg || 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: layout.MINI_PLAYER_HEIGHT,
    paddingHorizontal: spacing.lg || 20,
    backgroundColor: colors.background,
  },
  rowActive: {
    backgroundColor: colors.accentAlpha10, // El "moradito" de la cola
  },
  leftCol: {
    position: 'relative',
    marginRight: spacing.sm || 12, // 12 can fallback to sm
  },
  lyricCoverBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(139, 92, 246, 0.75)',
    borderRadius: 4,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
