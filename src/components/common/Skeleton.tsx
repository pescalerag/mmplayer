import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SkeletonProps {
  readonly width?: number | `${number}%` | '100%';
  readonly height?: number | `${number}%` | '100%';
  readonly borderRadius?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly color?: string;
}

/**
 * Base pulsing Skeleton block.
 * Uses native-driven animated opacity for smooth 60fps rendering without jank.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  color,
}: SkeletonProps) {
  const { colors } = useAppTheme();
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacityAnim]);

  const defaultBg = color || colors.overlayAlpha08 || 'rgba(255, 255, 255, 0.08)';

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: defaultBg,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
}

/**
 * Single Track Row Skeleton (matches TrackRow layout).
 */
export function SkeletonTrackRow({ style }: Readonly<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[styles.trackRow, style]}>
      {/* Cover thumbnail */}
      <Skeleton width={44} height={44} borderRadius={6} />
      <View style={styles.trackInfo}>
        {/* Title */}
        <Skeleton width="65%" height={14} borderRadius={4} />
        {/* Subtitle / Artist */}
        <Skeleton width="40%" height={11} borderRadius={4} style={{ marginTop: 6 }} />
      </View>
      {/* Duration placeholder */}
      <Skeleton width={32} height={12} borderRadius={4} />
    </View>
  );
}

/**
 * 3-Column Grid Card Skeleton (matches LibraryCard layout for Albums, Artists, Playlists, Folders).
 */
export function SkeletonGridCard({
  type = 'album',
  cardWidth = (SCREEN_WIDTH - 70) / 3,
}: Readonly<{
  type?: 'album' | 'artist' | 'playlist' | 'folder';
  cardWidth?: number;
}>) {
  const isCircle = type === 'artist';
  return (
    <View style={[styles.gridCard, { width: cardWidth }]}>
      <Skeleton
        width={cardWidth}
        height={cardWidth}
        borderRadius={isCircle ? cardWidth / 2 : 10}
      />
      <Skeleton
        width="75%"
        height={12}
        borderRadius={4}
        style={{ marginTop: 8, alignSelf: isCircle ? 'center' : 'flex-start' }}
      />
      <Skeleton
        width="45%"
        height={10}
        borderRadius={4}
        style={{ marginTop: 5, alignSelf: isCircle ? 'center' : 'flex-start' }}
      />
    </View>
  );
}

/**
 * Recent Media Card Skeleton (matches HomeScreen 2-column cards).
 */
export function SkeletonRecentCard({
  cardWidth = (SCREEN_WIDTH - 42) / 2,
}: Readonly<{
  cardWidth?: number;
}>) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.recentCard,
        {
          width: cardWidth,
          backgroundColor: colors.cardBackground,
          borderColor: colors.overlayAlpha08,
        },
      ]}
    >
      <Skeleton width={54} height={54} borderRadius={0} />
      <View style={styles.recentInfo}>
        <Skeleton width="80%" height={12} borderRadius={3} />
        <Skeleton width="50%" height={10} borderRadius={3} style={{ marginTop: 5 }} />
      </View>
    </View>
  );
}

/**
 * Tag Card Skeleton (matches TagManagementScreen layout).
 */
export function SkeletonTagCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.tagCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.overlayAlpha05,
        },
      ]}
    >
      <Skeleton width={14} height={14} borderRadius={7} />
      <Skeleton width="40%" height={14} borderRadius={4} style={{ marginLeft: 12 }} />
      <View style={{ flex: 1 }} />
      <Skeleton width={18} height={18} borderRadius={9} />
    </View>
  );
}

/* =========================================================================
   COMPOSITE SKELETON SCREENS
   ========================================================================= */

/**
 * HomeScreen Skeleton.
 * Replaces the initial loading spinner with realistic layout placeholders:
 * - Greeting skeleton
 * - Recent 2-column cards grid
 * - Horizontal carousel section
 * - Track list section
 */
export function SkeletonHomeScreen({ topOffset = 100 }: Readonly<{ topOffset?: number }>) {
  const recentCardWidth = (SCREEN_WIDTH - 42) / 2;

  return (
    <View style={[styles.screenContainer, { paddingTop: topOffset }]}>
      {/* Greeting line */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <Skeleton width={180} height={26} borderRadius={6} />
      </View>

      {/* 2x2 Recent cards */}
      <View style={styles.recentGrid}>
        <SkeletonRecentCard cardWidth={recentCardWidth} />
        <SkeletonRecentCard cardWidth={recentCardWidth} />
        <SkeletonRecentCard cardWidth={recentCardWidth} />
        <SkeletonRecentCard cardWidth={recentCardWidth} />
      </View>

      {/* Section 1 Header */}
      <View style={{ paddingHorizontal: 16, marginTop: 26, marginBottom: 12 }}>
        <Skeleton width={150} height={18} borderRadius={4} />
      </View>

      {/* Horizontal Carousel Cards */}
      <View style={styles.horizontalRow}>
        <View style={styles.carouselItem}>
          <Skeleton width={130} height={130} borderRadius={10} />
          <Skeleton width={100} height={12} borderRadius={4} style={{ marginTop: 8 }} />
          <Skeleton width={70} height={10} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.carouselItem}>
          <Skeleton width={130} height={130} borderRadius={10} />
          <Skeleton width={90} height={12} borderRadius={4} style={{ marginTop: 8 }} />
          <Skeleton width={60} height={10} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.carouselItem}>
          <Skeleton width={130} height={130} borderRadius={10} />
          <Skeleton width={110} height={12} borderRadius={4} style={{ marginTop: 8 }} />
          <Skeleton width={75} height={10} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* Section 2 Header */}
      <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 10 }}>
        <Skeleton width={130} height={18} borderRadius={4} />
      </View>

      {/* Track rows */}
      <View style={{ paddingHorizontal: 16 }}>
        <SkeletonTrackRow />
        <SkeletonTrackRow />
        <SkeletonTrackRow />
      </View>
    </View>
  );
}

/**
 * SearchScreen Skeleton.
 * Displays placeholders for quick tags and explore/genre grid.
 */
export function SkeletonSearchScreen({ topOffset = 100 }: Readonly<{ topOffset?: number }>) {
  const genreCardWidth = (SCREEN_WIDTH - 48) / 2;

  return (
    <View style={[styles.screenContainer, { paddingTop: topOffset }]}>
      {/* Quick filter pills */}
      <View style={styles.pillsRow}>
        <Skeleton width={60} height={32} borderRadius={16} />
        <Skeleton width={80} height={32} borderRadius={16} />
        <Skeleton width={70} height={32} borderRadius={16} />
        <Skeleton width={90} height={32} borderRadius={16} />
      </View>

      {/* Explore Section Title */}
      <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 14 }}>
        <Skeleton width={140} height={18} borderRadius={4} />
      </View>

      {/* 2-column Explore Cards */}
      <View style={styles.exploreGrid}>
        <View style={{ width: genreCardWidth, marginBottom: 14 }}>
          <Skeleton width={genreCardWidth} height={genreCardWidth} borderRadius={12} />
          <Skeleton width="70%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
        <View style={{ width: genreCardWidth, marginBottom: 14 }}>
          <Skeleton width={genreCardWidth} height={genreCardWidth} borderRadius={12} />
          <Skeleton width="60%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
        <View style={{ width: genreCardWidth, marginBottom: 14 }}>
          <Skeleton width={genreCardWidth} height={genreCardWidth} borderRadius={12} />
          <Skeleton width="80%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
        <View style={{ width: genreCardWidth, marginBottom: 14 }}>
          <Skeleton width={genreCardWidth} height={genreCardWidth} borderRadius={12} />
          <Skeleton width="65%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
      </View>
    </View>
  );
}

/**
 * Library TrackList Tab Skeleton.
 */
export function SkeletonLibraryList({ topOffset = 100 }: Readonly<{ topOffset?: number }>) {
  return (
    <View style={[styles.screenContainer, { paddingTop: topOffset, paddingHorizontal: 16 }]}>
      {/* Header bar / shuffle button placeholder */}
      <View style={styles.libraryHeaderPlaceholder}>
        <Skeleton width={100} height={14} borderRadius={4} />
        <Skeleton width={80} height={30} borderRadius={15} />
      </View>
      <SkeletonTrackRow />
      <SkeletonTrackRow />
      <SkeletonTrackRow />
      <SkeletonTrackRow />
      <SkeletonTrackRow />
      <SkeletonTrackRow />
      <SkeletonTrackRow />
    </View>
  );
}

/**
 * Library Grid Tab Skeleton (Albums, Artists, Playlists, Folders).
 */
export function SkeletonLibraryGrid({
  topOffset = 100,
  type = 'album',
}: Readonly<{
  topOffset?: number;
  type?: 'album' | 'artist' | 'playlist' | 'folder';
}>) {
  const cardWidth = (SCREEN_WIDTH - 70) / 3;

  return (
    <View style={[styles.screenContainer, { paddingTop: topOffset, paddingHorizontal: 20 }]}>
      {/* Header sort bar placeholder */}
      <View style={[styles.libraryHeaderPlaceholder, { marginBottom: 18 }]}>
        <Skeleton width={80} height={14} borderRadius={4} />
        <Skeleton width={70} height={24} borderRadius={6} />
      </View>

      {/* 3 rows of 3 columns */}
      <View style={styles.threeColumnGrid}>
        <SkeletonGridCard type={type} cardWidth={cardWidth} />
        <SkeletonGridCard type={type} cardWidth={cardWidth} />
        <SkeletonGridCard type={type} cardWidth={cardWidth} />

        <SkeletonGridCard type={type} cardWidth={cardWidth} />
        <SkeletonGridCard type={type} cardWidth={cardWidth} />
        <SkeletonGridCard type={type} cardWidth={cardWidth} />

        <SkeletonGridCard type={type} cardWidth={cardWidth} />
        <SkeletonGridCard type={type} cardWidth={cardWidth} />
        <SkeletonGridCard type={type} cardWidth={cardWidth} />
      </View>
    </View>
  );
}

/**
 * TagManagementScreen Skeleton.
 */
export function SkeletonTagList({ topOffset = 100 }: Readonly<{ topOffset?: number }>) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.screenContainer, { paddingTop: topOffset, paddingHorizontal: 20 }]}>
      {/* Create tag button placeholder */}
      <Skeleton
        width="100%"
        height={48}
        borderRadius={12}
        color={colors.accentAlpha20 || 'rgba(139, 92, 246, 0.2)'}
        style={{ marginBottom: 20 }}
      />
      {/* Tag rows */}
      <SkeletonTagCard />
      <SkeletonTagCard />
      <SkeletonTagCard />
      <SkeletonTagCard />
      <SkeletonTagCard />
      <SkeletonTagCard />
    </View>
  );
}

/**
 * ActivityMainScreen Skeleton.
 */
export function SkeletonActivityScreen({ topOffset = 12 }: Readonly<{ topOffset?: number }>) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.screenContainer, { paddingTop: topOffset, paddingHorizontal: 16 }]}>
      {/* Hero card skeleton */}
      <View
        style={[
          styles.activityHero,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.overlayAlpha08,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width={120} height={32} borderRadius={6} />
        </View>
        <Skeleton width={180} height={12} borderRadius={4} style={{ marginTop: 12 }} />
      </View>

      {/* Option tabs selector skeleton */}
      <View style={styles.optionTabsPlaceholder}>
        <Skeleton width="22%" height={28} borderRadius={6} />
        <Skeleton width="22%" height={28} borderRadius={6} />
        <Skeleton width="22%" height={28} borderRadius={6} />
        <Skeleton width="22%" height={28} borderRadius={6} />
      </View>

      {/* Top highlight card */}
      <View style={{ marginTop: 22, marginBottom: 12 }}>
        <Skeleton width={120} height={14} borderRadius={4} />
      </View>
      <View
        style={[
          styles.activityHighlightCard,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.overlayAlpha08,
          },
        ]}
      >
        <Skeleton width={60} height={60} borderRadius={30} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Skeleton width="70%" height={16} borderRadius={4} />
          <Skeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      </View>

      {/* Track rows */}
      <SkeletonTrackRow style={{ marginTop: 12 }} />
      <SkeletonTrackRow />
      <SkeletonTrackRow />
    </View>
  );
}

/* =========================================================================
   STYLES
   ========================================================================= */

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    width: '100%',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    justifyContent: 'center',
  },
  gridCard: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    justifyContent: 'space-between',
  },
  recentCard: {
    height: 54,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  recentInfo: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  tagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  horizontalRow: {
    flexDirection: 'row',
    paddingLeft: 16,
    gap: 14,
  },
  carouselItem: {
    width: 130,
  },
  pillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 6,
  },
  exploreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
    justifyContent: 'space-between',
  },
  libraryHeaderPlaceholder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  threeColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  activityHero: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  optionTabsPlaceholder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  activityHighlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
});
