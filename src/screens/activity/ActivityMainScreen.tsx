import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePlayerStore } from '../../store/usePlayerStore';
import { HistoryService } from '../../services/HistoryService';
import { database } from '../../database';
import Track from '../../database/models/Track';

type Period = 'day' | 'week' | 'month' | 'year' | 'all';
type Metric = 'duration' | 'plays';

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
  all: 'Todo',
};

const PERIODS: Period[] = ['day', 'week', 'month', 'year', 'all'];

function formatDateRange(period: Period): string {
  const now = new Date();

  const fmt = (d: Date) =>
    d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const fmtYear = (d: Date) =>
    d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  if (period === 'day') {
    return now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  if (period === 'week') {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return `${fmt(from)} – ${fmt(now)}`;
  }
  if (period === 'month') {
    return now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }
  if (period === 'year') {
    const from = new Date(now.getFullYear(), 0, 1);
    return `${fmtYear(from)} – ${fmtYear(now)}`;
  }
  return 'Toda la actividad';
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = (seconds / 3600).toFixed(1);
  return `${hours} h`;
}

interface StatsResult {
  totalHours: number;
  totalPlays: number;
  topArtist: string;
  topArtistId: string;
  topArtistImg: string | null;
  topArtistDuration: number;
  topArtistPlays: number;
  topAlbum: string;
  topAlbumId: string;
  topAlbumImg: string | null;
  topAlbumDuration: number;
  topAlbumPlays: number;
  topSong: string;
  topSongId: string;
  topSongImg: string | null;
  topSongArtist: string;
  topSongDuration: number;
  topSongPlays: number;
}

const EMPTY_STATS: StatsResult = {
  totalHours: 0,
  totalPlays: 0,
  topArtist: 'Ninguno',
  topArtistId: '',
  topArtistImg: null,
  topArtistDuration: 0,
  topArtistPlays: 0,
  topAlbum: 'Ninguno',
  topAlbumId: '',
  topAlbumImg: null,
  topAlbumDuration: 0,
  topAlbumPlays: 0,
  topSong: 'Ninguno',
  topSongId: '',
  topSongImg: null,
  topSongArtist: 'Ninguno',
  topSongDuration: 0,
  topSongPlays: 0,
};

export default function ActivityMainScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, fonts, radii } = useAppTheme();
  const { t } = useTranslation();

  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('duration');
  const [stats, setStats] = useState<StatsResult>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await HistoryService.getStatsForPeriod(period, metric);
      setStats(result);
    } catch (err) {
      console.error('[ActivityMainScreen] Failed to fetch stats:', err);
      setStats(EMPTY_STATS);
    } finally {
      setIsLoading(false);
    }
  }, [period, metric]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const handleArtistPress = () => {
    if (stats.topArtistId) navigation.navigate('ArtistDetail', { artistId: stats.topArtistId });
  };

  const handleAlbumPress = () => {
    if (stats.topAlbumId) navigation.navigate('AlbumDetail', { albumId: stats.topAlbumId });
  };

  const handleSongPress = async () => {
    if (stats.topSongId) {
      try {
        const track = await database.get<Track>('tracks').find(stats.topSongId);
        usePlayerStore.getState().playSingleTrack(track, 'activity-main');
      } catch (err) {
        console.warn('[ActivityMainScreen] Failed to play top track:', err);
      }
    }
  };

  const hasActivity = stats.totalHours > 0 || stats.totalPlays > 0;

  const statLabel = metric === 'duration'
    ? formatDuration(stats.totalHours * 3600)
    : stats.totalPlays === 1 
      ? t('activity.reproduction_singular', { count: stats.totalPlays })
      : t('activity.reproduction_plural', { count: stats.totalPlays });

  const artistStatLabel = metric === 'duration'
    ? t('activity.listening_time', { time: formatDuration(stats.topArtistDuration) })
    : stats.topArtistPlays === 1
      ? t('activity.reproduction_singular', { count: stats.topArtistPlays })
      : t('activity.reproduction_plural', { count: stats.topArtistPlays });

  const albumStatLabel = metric === 'duration'
    ? t('activity.listening_time', { time: formatDuration(stats.topAlbumDuration) })
    : stats.topAlbumPlays === 1
      ? t('activity.reproduction_singular', { count: stats.topAlbumPlays })
      : t('activity.reproduction_plural', { count: stats.topAlbumPlays });

  const songStatLabel = metric === 'duration'
    ? `${stats.topSongArtist} · ${formatDuration(stats.topSongDuration)}`
    : stats.topSongPlays === 1
      ? `${stats.topSongArtist} · ${t('activity.reproduction_singular', { count: stats.topSongPlays })}`
      : `${stats.topSongArtist} · ${t('activity.reproduction_plural', { count: stats.topSongPlays })}`;

  const SECTION_LABEL = period === 'day'
    ? t('activity.today_highlights')
    : period === 'week'
    ? t('activity.week_highlights')
    : period === 'month'
    ? t('activity.month_highlights')
    : period === 'year'
    ? t('activity.year_highlights')
    : t('activity.global_highlights');

  return (
    <View style={styles.root}>
      {/* BACKGROUND GRADIENT */}
      <LinearGradient
        colors={[colors.accentAlpha15, colors.cardBackground]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fonts.bold, color: colors.text }]}>
          {t('activity.title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* PERIOD TABS */}
      <View style={styles.periodTabsRow}>
        {PERIODS.map((p) => {
          const isActive = p === period;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              activeOpacity={0.75}
              style={[
                styles.periodTab,
                isActive && { backgroundColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.periodTabText,
                  { fontFamily: fonts.bold },
                  isActive ? { color: '#FFFFFF' } : { color: colors.textSecondary },
                ]}
              >
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DATE RANGE + METRIC TOGGLE */}
      <View style={styles.controlsRow}>
        <Text style={[styles.dateRangeText, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
          {formatDateRange(period)}
        </Text>
        <View style={styles.metricToggle}>
          <TouchableOpacity
            onPress={() => setMetric('duration')}
            activeOpacity={0.75}
            style={[
              styles.metricBtn,
              metric === 'duration' && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={13}
              color={metric === 'duration' ? colors.accentLight : colors.textSecondary}
            />
            <Text
              style={[
                styles.metricBtnText,
                { fontFamily: fonts.bold },
                metric === 'duration'
                  ? { color: colors.accentLight }
                  : { color: colors.textSecondary },
              ]}
            >
              {t('activity.time_label')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMetric('plays')}
            activeOpacity={0.75}
            style={[
              styles.metricBtn,
              metric === 'plays' && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent },
            ]}
          >
            <Ionicons
              name="play-outline"
              size={13}
              color={metric === 'plays' ? colors.accentLight : colors.textSecondary}
            />
            <Text
              style={[
                styles.metricBtnText,
                { fontFamily: fonts.bold },
                metric === 'plays'
                  ? { color: colors.accentLight }
                  : { color: colors.textSecondary },
              ]}
            >
              {t('activity.reproductions_label')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accentLight} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 160 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {hasActivity ? (
            <>
              {/* TOTAL HERO CARD */}
              <View
                style={[
                  styles.heroCard,
                  { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radii.lg || 12 },
                ]}
              >
                <View style={styles.heroRow}>
                  <Ionicons
                    name={metric === 'duration' ? 'time-outline' : 'musical-notes-outline'}
                    size={28}
                    color={colors.accentLight}
                  />
                  <Text style={[styles.heroValue, { fontFamily: fonts.bold, color: colors.text }]}>
                    {metric === 'duration'
                      ? `${stats.totalHours.toFixed(1)} `
                      : `${stats.totalPlays} `}
                    <Text style={{ fontSize: 16, fontWeight: '500' }}>
                      {metric === 'duration' ? 'h' : t('activity.plays')}
                    </Text>
                  </Text>
                </View>
                <Text
                  style={[
                    styles.heroLabel,
                    { fontFamily: fonts.regular, color: colors.textSecondary },
                  ]}
                >
                  {metric === 'duration'
                    ? t('activity.total_listening_time', { period: formatDateRange(period) })
                    : t('activity.total_plays', { period: formatDateRange(period) })}
                </Text>
              </View>

              <Text
                style={[
                  styles.sectionHeading,
                  { fontFamily: fonts.bold, color: colors.textSecondary },
                ]}
              >
                {SECTION_LABEL}
              </Text>

              {/* TOP ARTIST CARD */}
              <TouchableOpacity
                onPress={handleArtistPress}
                disabled={!stats.topArtistId}
                activeOpacity={0.8}
                style={[
                  styles.highlightCard,
                  { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radii.md || 8 },
                ]}
              >
                {stats.topArtistImg ? (
                  <Image source={{ uri: stats.topArtistImg }} style={[styles.avatar, { borderRadius: 32 }]} />
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
                    {stats.topArtist}
                  </Text>
                  <Text style={[styles.cardStat, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                    {artistStatLabel}
                  </Text>
                </View>
                {stats.topArtistId ? (
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.arrow} />
                ) : null}
              </TouchableOpacity>

              {/* TOP ALBUM CARD */}
              <TouchableOpacity
                onPress={handleAlbumPress}
                disabled={!stats.topAlbumId}
                activeOpacity={0.8}
                style={[
                  styles.highlightCard,
                  { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radii.md || 8 },
                ]}
              >
                {stats.topAlbumImg ? (
                  <Image source={{ uri: stats.topAlbumImg }} style={[styles.cover, { borderRadius: radii.sm || 4 }]} />
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
                    {stats.topAlbum}
                  </Text>
                  <Text style={[styles.cardStat, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                    {albumStatLabel}
                  </Text>
                </View>
                {stats.topAlbumId ? (
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={styles.arrow} />
                ) : null}
              </TouchableOpacity>

              {/* TOP SONG CARD */}
              <TouchableOpacity
                onPress={handleSongPress}
                disabled={!stats.topSongId}
                activeOpacity={0.8}
                style={[
                  styles.highlightCard,
                  { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radii.md || 8 },
                ]}
              >
                {stats.topSongImg ? (
                  <Image source={{ uri: stats.topSongImg }} style={[styles.cover, { borderRadius: radii.sm || 4 }]} />
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
                    {stats.topSong}
                  </Text>
                  <Text style={[styles.cardStat, { fontFamily: fonts.regular, color: colors.textSecondary }]} numberOfLines={1}>
                    {songStatLabel}
                  </Text>
                </View>
                {stats.topSongId ? (
                  <Ionicons name="play" size={20} color={colors.accentLight} style={styles.arrow} />
                ) : null}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="bar-chart-outline"
                size={64}
                color={colors.textSecondary}
                style={{ marginBottom: 16, opacity: 0.5 }}
              />
              <Text style={[styles.emptyText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
                {t('activity.no_data')}
              </Text>
            </View>
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
  // ---- PERIOD TABS ----
  periodTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // ---- CONTROLS (date range + metric toggle) ----
  controlsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  dateRangeText: {
    fontSize: 11,
    flex: 1,
    textTransform: 'capitalize',
  },
  metricToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  metricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metricBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // ---- LOADING ----
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ---- SCROLL CONTENT ----
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  heroCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    textTransform: 'capitalize',
  },
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
