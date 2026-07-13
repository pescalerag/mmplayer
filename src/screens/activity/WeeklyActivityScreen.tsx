import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
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

const { width } = Dimensions.get('window');

export default function WeeklyActivityScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors, fonts, spacing, radii } = useAppTheme();

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
    topSongDuration
  } = useStatsStore();

  useFocusEffect(
    React.useCallback(() => {
      useStatsStore.getState().fetchStats();
    }, [])
  );

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return `0 ${t('activity.min_suffix')}`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} ${t('activity.min_suffix')}`;
    }
    const hours = (seconds / 3600).toFixed(1);
    return `${hours} ${t('activity.hour_suffix')}`;
  };

  const handleArtistPress = () => {
    if (topArtistId) {
      navigation.navigate('ArtistDetail', { artistId: topArtistId });
    }
  };

  const handleAlbumPress = () => {
    if (topAlbumId) {
      navigation.navigate('AlbumDetail', { albumId: topAlbumId });
    }
  };

  const handleSongPress = async () => {
    if (topSongId) {
      try {
        const track = await database.get<Track>('tracks').find(topSongId);
        usePlayerStore.getState().playSingleTrack(track, 'weekly-activity');
      } catch (err) {
        console.warn("[WeeklyActivityScreen] Failed to play top track:", err);
      }
    }
  };

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

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 160 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {hasActivity ? (
          <>
            {/* TOTAL HOURS HERO CARD */}
            <View style={[styles.heroCard, { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: radii.lg || 12 }]}>
              <View style={styles.heroRow}>
                <Ionicons name="time-outline" size={28} color={colors.accentLight} />
                <Text style={[styles.heroValue, { fontFamily: fonts.bold, color: colors.text }]}>
                  {totalHours.toFixed(1)} <Text style={{ fontSize: 16, fontWeight: '500' }}>{t('activity.hour_suffix')}</Text>
                </Text>
              </View>
              <Text style={[styles.heroLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                {t('home.weekly_stats_hours_desc')}
              </Text>
            </View>

            <Text style={[styles.sectionHeading, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
              {t('home.weekly_highlights')}
            </Text>

            {/* TOP ARTIST CARD */}
            <TouchableOpacity
              onPress={handleArtistPress}
              disabled={!topArtistId}
              activeOpacity={0.8}
              style={[styles.highlightCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: radii.md || 8 }]}
            >
              {topArtistImg ? (
                <Image source={{ uri: topArtistImg }} style={[styles.avatar, { borderRadius: 32 }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { borderRadius: 32, backgroundColor: colors.accentAlpha30 }]}>
                  <Ionicons name="person" size={28} color={colors.accentLight} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={[styles.cardLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                  {t('home.weekly_stats_artist')}
                </Text>
                <Text style={[styles.cardTitle, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
                  {topArtist || t('activity.none')}
                </Text>
                <Text style={[styles.cardStat, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                  {t('home.weekly_stats_play_time', { time: formatDuration(topArtistDuration) })}
                </Text>
              </View>
              {topArtistId ? (
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.arrow} />
              ) : null}
            </TouchableOpacity>

            {/* TOP ALBUM CARD */}
            <TouchableOpacity
              onPress={handleAlbumPress}
              disabled={!topAlbumId}
              activeOpacity={0.8}
              style={[styles.highlightCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: radii.md || 8 }]}
            >
              {topAlbumImg ? (
                <Image source={{ uri: topAlbumImg }} style={[styles.cover, { borderRadius: radii.sm || 4 }]} />
              ) : (
                <View style={[styles.coverPlaceholder, { borderRadius: radii.sm || 4, backgroundColor: colors.accentAlpha30 }]}>
                  <Ionicons name="albums" size={28} color={colors.accentLight} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={[styles.cardLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                  {t('home.weekly_stats_album')}
                </Text>
                <Text style={[styles.cardTitle, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
                  {topAlbum || t('activity.none')}
                </Text>
                <Text style={[styles.cardStat, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                  {t('home.weekly_stats_play_time', { time: formatDuration(topAlbumDuration) })}
                </Text>
              </View>
              {topAlbumId ? (
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.arrow} />
              ) : null}
            </TouchableOpacity>

            {/* TOP SONG CARD */}
            <TouchableOpacity
              onPress={handleSongPress}
              disabled={!topSongId}
              activeOpacity={0.8}
              style={[styles.highlightCard, { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: radii.md || 8 }]}
            >
              {topSongImg ? (
                <Image source={{ uri: topSongImg }} style={[styles.cover, { borderRadius: radii.sm || 4 }]} />
              ) : (
                <View style={[styles.coverPlaceholder, { borderRadius: radii.sm || 4, backgroundColor: colors.accentAlpha30 }]}>
                  <Ionicons name="musical-note" size={28} color={colors.accentLight} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={[styles.cardLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                  {t('home.weekly_stats_song')}
                </Text>
                <Text style={[styles.cardTitle, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
                  {topSong || t('activity.none')}
                </Text>
                <Text style={[styles.cardStat, { fontFamily: fonts.regular, color: colors.textSecondary }]} numberOfLines={1}>
                  {topSongArtist || t('activity.unknown_artist')} · {formatDuration(topSongDuration)}
                </Text>
              </View>
              {topSongId ? (
                <Ionicons name="play" size={20} color={colors.accentLight} style={styles.arrow} />
              ) : null}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="bar-chart-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 16, opacity: 0.5 }} />
            <Text style={[styles.emptyText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
              {t('home.weekly_stats_empty')}
            </Text>
          </View>
        )}
      </ScrollView>
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
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 30,
  },
});
