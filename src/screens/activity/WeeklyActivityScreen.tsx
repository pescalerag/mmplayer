import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useStatsStore } from '../../store/useStatsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { useDelayedLoader } from '@/hooks/useDelayedLoader';
import { SkeletonActivityScreen } from '@/components/common/Skeleton';
import { formatDuration } from './utils/activityStatUtils';

interface WeeklyHeroCardProps {
  readonly totalHours: number;
}

function WeeklyHeroCard({ totalHours }: WeeklyHeroCardProps) {
  const { colors, fonts, radii } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.heroCard, { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: radii.lg || 12 }]}>
      <View style={styles.heroRow}>
        <Ionicons name="time-outline" size={28} color={colors.accentLight} />
        <Text style={[styles.heroValue, { fontFamily: fonts.bold, color: colors.text }]}>
          {totalHours.toFixed(1)}{' '}
          <Text style={styles.heroSuffix}>{t('activity.hour_suffix')}</Text>
        </Text>
      </View>
      <Text style={[styles.heroLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
        {t('home.weekly_stats_hours_desc')}
      </Text>
    </View>
  );
}

interface WeeklyHighlightCardProps {
  readonly label: string;
  readonly title: string;
  readonly stat: string;
  readonly imageUrl?: string | null;
  readonly placeholderIcon: keyof typeof Ionicons.glyphMap;
  readonly isAvatar?: boolean;
  readonly actionIcon?: keyof typeof Ionicons.glyphMap;
  readonly actionIconColor?: string;
  readonly hasId: boolean;
  readonly onPress: () => void;
}

function WeeklyHighlightCard({
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
}: WeeklyHighlightCardProps) {
  const { colors, fonts, radii } = useAppTheme();
  const cardBorderRadius = radii.md || 8;
  const imageBorderRadius = isAvatar ? 32 : (radii.sm || 4);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!hasId}
      activeOpacity={0.8}
      style={[styles.highlightCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: cardBorderRadius }]}
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
      {hasId && (
        <Ionicons
          name={actionIcon ?? 'chevron-forward'}
          size={20}
          color={actionIconColor ?? colors.textSecondary}
          style={styles.arrow}
        />
      )}
    </TouchableOpacity>
  );
}

function WeeklyEmptyState() {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="bar-chart-outline" size={64} color={colors.textSecondary} style={styles.emptyIcon} />
      <Text style={[styles.emptyText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
        {t('home.weekly_stats_empty')}
      </Text>
    </View>
  );
}

interface WeeklyHighlightsSectionProps {
  readonly totalHours: number;
  readonly topArtist: string;
  readonly topArtistId: string;
  readonly topArtistImg: string | null;
  readonly topArtistDuration: number;
  readonly topAlbum: string;
  readonly topAlbumId: string;
  readonly topAlbumImg: string | null;
  readonly topAlbumDuration: number;
  readonly topSong: string;
  readonly topSongId: string;
  readonly topSongImg: string | null;
  readonly topSongArtist: string;
  readonly topSongDuration: number;
  readonly onArtistPress: () => void;
  readonly onAlbumPress: () => void;
  readonly onSongPress: () => void;
}

function WeeklyHighlightsSection({
  totalHours,
  topArtist,
  topArtistId,
  topArtistImg,
  topArtistDuration,
  topAlbum,
  topAlbumId,
  topAlbumImg,
  topAlbumDuration,
  topSong,
  topSongId,
  topSongImg,
  topSongArtist,
  topSongDuration,
  onArtistPress,
  onAlbumPress,
  onSongPress,
}: WeeklyHighlightsSectionProps) {
  const { fonts, colors } = useAppTheme();
  const { t } = useTranslation();

  const artistStat = t('home.weekly_stats_play_time', {
    time: formatDuration(topArtistDuration, t),
  });
  const albumStat = t('home.weekly_stats_play_time', {
    time: formatDuration(topAlbumDuration, t),
  });
  const songArtistText = topSongArtist || t('activity.unknown_artist');
  const songStat = `${songArtistText} · ${formatDuration(topSongDuration, t)}`;
  const noneText = t('activity.none');

  return (
    <>
      <WeeklyHeroCard totalHours={totalHours} />

      <Text style={[styles.sectionHeading, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
        {t('home.weekly_highlights')}
      </Text>

      <WeeklyHighlightCard
        label={t('home.weekly_stats_artist')}
        title={topArtist || noneText}
        stat={artistStat}
        imageUrl={topArtistImg}
        placeholderIcon="person"
        isAvatar
        actionIcon="chevron-forward"
        hasId={Boolean(topArtistId)}
        onPress={onArtistPress}
      />

      <WeeklyHighlightCard
        label={t('home.weekly_stats_album')}
        title={topAlbum || noneText}
        stat={albumStat}
        imageUrl={topAlbumImg}
        placeholderIcon="albums"
        actionIcon="chevron-forward"
        hasId={Boolean(topAlbumId)}
        onPress={onAlbumPress}
      />

      <WeeklyHighlightCard
        label={t('home.weekly_stats_song')}
        title={topSong || noneText}
        stat={songStat}
        imageUrl={topSongImg}
        placeholderIcon="musical-note"
        actionIcon="play"
        actionIconColor={colors.accentLight}
        hasId={Boolean(topSongId)}
        onPress={onSongPress}
      />
    </>
  );
}

export default function WeeklyActivityScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors, fonts } = useAppTheme();

  const {
    totalHours,
    topArtist,
    topArtistId,
    topArtistImg,
    topArtistDuration,
    topAlbum,
    topAlbumId,
    topAlbumImg,
    topAlbumDuration,
    topSong,
    topSongId,
    topSongImg,
    topSongArtist,
    topSongDuration,
    isLoading,
  } = useStatsStore();

  const showLoader = useDelayedLoader(isLoading, { delay: 250, minDisplayTime: 500 });

  useFocusEffect(
    useCallback(() => {
      void useStatsStore.getState().fetchStats();
    }, [])
  );

  const handleArtistPress = useCallback(() => {
    if (topArtistId) {
      navigation.navigate('ArtistDetail', { artistId: topArtistId });
    }
  }, [navigation, topArtistId]);

  const handleAlbumPress = useCallback(() => {
    if (topAlbumId) {
      navigation.navigate('AlbumDetail', { albumId: topAlbumId });
    }
  }, [navigation, topAlbumId]);

  const handleSongPress = useCallback(async () => {
    if (!topSongId) return;
    try {
      const track = await database.get<Track>('tracks').find(topSongId);
      await usePlayerStore.getState().playSingleTrack(track, 'weekly-activity');
    } catch (err) {
      console.warn('[WeeklyActivityScreen] Failed to play top track:', err);
    }
  }, [topSongId]);

  const hasActivity = totalHours > 0;

  return (
    <View style={styles.root}>
      {/* BACKGROUND GRADIENT MATCHING THE STATS CARD */}
      <LinearGradient
        colors={[colors.accentAlpha15, colors.cardBackground]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 15 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.bold, color: colors.text }]}>
          {t('home.weekly_stats_title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {showLoader && <SkeletonActivityScreen topOffset={12} />}

      {!showLoader && !isLoading && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 160 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {hasActivity ? (
            <WeeklyHighlightsSection
              totalHours={totalHours}
              topArtist={topArtist}
              topArtistId={topArtistId}
              topArtistImg={topArtistImg}
              topArtistDuration={topArtistDuration}
              topAlbum={topAlbum}
              topAlbumId={topAlbumId}
              topAlbumImg={topAlbumImg}
              topAlbumDuration={topAlbumDuration}
              topSong={topSong}
              topSongId={topSongId}
              topSongImg={topSongImg}
              topSongArtist={topSongArtist}
              topSongDuration={topSongDuration}
              onArtistPress={handleArtistPress}
              onAlbumPress={handleAlbumPress}
              onSongPress={handleSongPress}
            />
          ) : (
            <WeeklyEmptyState />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  heroCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  heroSuffix: {
    fontSize: 16,
    fontWeight: '500',
  },
  heroLabel: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '700',
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 30,
  },
});
