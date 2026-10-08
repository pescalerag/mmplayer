import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { DisplayStats, SmartListItem } from '../../screens/activity/utils/activityStatUtils';
import LibraryCard from '../cards/LibraryCard';
import Animated from 'react-native-reanimated';
import { useCascadeEntry } from '@/hooks/useCascadeEntry';

interface HighlightItemCardProps {
  readonly label: string;
  readonly title: string;
  readonly stat: string;
  readonly imageUrl: string | null;
  readonly placeholderIcon: keyof typeof Ionicons.glyphMap;
  readonly isAvatar?: boolean;
  readonly actionIcon?: keyof typeof Ionicons.glyphMap;
  readonly actionIconColor?: string;
  readonly hasId: boolean;
  readonly onPress: () => void;
}

function HighlightItemCard({
  label,
  title,
  stat,
  imageUrl,
  placeholderIcon,
  isAvatar = false,
  actionIcon,
  actionIconColor,
  hasId,
  onPress,
}: HighlightItemCardProps) {
  const { colors, fonts, radii } = useAppTheme();
  const cardBorderRadius = radii.md || 8;
  const imageBorderRadius = isAvatar ? 32 : (radii.sm || 4);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!hasId}
      activeOpacity={0.8}
      style={[
        styles.highlightCard,
        { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: cardBorderRadius },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[isAvatar ? styles.avatar : styles.cover, { borderRadius: imageBorderRadius }]}
        />
      ) : (
        <View
          style={[
            isAvatar ? styles.avatarPlaceholder : styles.coverPlaceholder,
            { borderRadius: imageBorderRadius, backgroundColor: colors.accentAlpha30 },
          ]}
        >
          <Ionicons name={placeholderIcon} size={28} color={colors.accentLight} />
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={[styles.cardLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.cardTitle, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.cardStat, { fontFamily: fonts.regular, color: colors.textSecondary }]} numberOfLines={1}>
          {stat}
        </Text>
      </View>
      {hasId && actionIcon && (
        <Ionicons
          name={actionIcon}
          size={20}
          color={actionIconColor || colors.textSecondary}
          style={styles.arrow}
        />
      )}
    </TouchableOpacity>
  );
}

interface ActivityHighlightsTabProps {
  readonly sectionLabel: string;
  readonly stats: DisplayStats;
  readonly artistStatLabel: string;
  readonly albumStatLabel: string;
  readonly songStatLabel: string;
  readonly onArtistPress: () => void;
  readonly onAlbumPress: () => void;
  readonly onSongPress: () => void;
  readonly visibleSmartLists: readonly SmartListItem[];
  readonly onSmartListPress: (id: string) => void;
  readonly smartListsRef: React.RefObject<any>;
  readonly smartListsLayout: React.RefObject<any>;
}

export function ActivityHighlightsTab({
  sectionLabel,
  stats,
  artistStatLabel,
  albumStatLabel,
  songStatLabel,
  onArtistPress,
  onAlbumPress,
  onSongPress,
  visibleSmartLists,
  onSmartListPress,
  smartListsRef,
  smartListsLayout,
}: ActivityHighlightsTabProps) {
  const cascade = useCascadeEntry();
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();

  const handleSmartListsLayout = (e: LayoutChangeEvent) => {
    if (e?.nativeEvent?.layout) {
      smartListsLayout.current = e.nativeEvent.layout;
    }
  };

  const noneText = t('activity.none');

  return (
    <>
      <Text style={[styles.sectionHeading, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
        {sectionLabel}
      </Text>

      <Animated.View entering={cascade.item(0)}>
        <HighlightItemCard
          label={t('home.weekly_stats_artist')}
          title={stats.topArtist || noneText}
          stat={artistStatLabel}
          imageUrl={stats.topArtistImg}
          placeholderIcon="person"
          isAvatar
          actionIcon="chevron-forward"
          hasId={Boolean(stats.topArtistId)}
          onPress={onArtistPress}
        />
      </Animated.View>

      <Animated.View entering={cascade.item(1)}>
        <HighlightItemCard
          label={t('home.weekly_stats_album')}
          title={stats.topAlbum || noneText}
          stat={albumStatLabel}
          imageUrl={stats.topAlbumImg}
          placeholderIcon="albums"
          actionIcon="chevron-forward"
          hasId={Boolean(stats.topAlbumId)}
          onPress={onAlbumPress}
        />
      </Animated.View>

      <Animated.View entering={cascade.item(2)}>
        <HighlightItemCard
          label={t('home.weekly_stats_song')}
          title={stats.topSong || noneText}
          stat={songStatLabel}
          imageUrl={stats.topSongImg}
          placeholderIcon="musical-note"
          actionIcon="play"
          actionIconColor={colors.accentLight}
          hasId={Boolean(stats.topSongId)}
          onPress={onSongPress}
        />
      </Animated.View>

      {visibleSmartLists.length > 0 && (
        <Animated.View entering={cascade.item(3)}>
          <View ref={smartListsRef} onLayout={handleSmartListsLayout} style={styles.smartListsSection}>
            <Text
              style={[
                styles.sectionHeading,
                { fontFamily: fonts.bold, color: colors.textSecondary, marginTop: 24, marginBottom: 12 },
              ]}
            >
              Playlists para ti
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {visibleSmartLists.map((list) => {
                const countText = `${list.trackCount} ${
                  list.trackCount === 1 ? t('library.song_singular') : t('library.song_plural')
                }`;
                return (
                  <View key={list.id} style={{ marginRight: 15 }}>
                    <LibraryCard
                      title={list.name}
                      subtitle={countText}
                      placeholderIcon={list.placeholderIcon as any}
                      smartListId={list.id}
                      onPress={() => onSmartListPress(list.id)}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeading: {
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 6,
    marginBottom: 2,
    fontWeight: '700',
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginVertical: 4,
  },
  avatar: {
    width: 64,
    height: 64,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cover: {
    width: 64,
    height: 64,
  },
  coverPlaceholder: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardStat: {
    fontSize: 12,
  },
  arrow: {
    marginLeft: 12,
  },
  smartListsSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  horizontalScroll: {
    paddingRight: 20,
    marginTop: 5,
  },
});
