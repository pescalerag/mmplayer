import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Pressable,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePlayerStore } from '../../store/usePlayerStore';
import { HistoryService } from '../../services/HistoryService';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { SmartListService } from '../../services/SmartListService';
import LibraryCard from '../../components/cards/LibraryCard';

type Period = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';
type Metric = 'duration' | 'plays';

const PERIODS: ('day' | 'week' | 'month' | 'year' | 'all')[] = ['day', 'week', 'month', 'year', 'all'];

function formatDateRange(period: Period, t: any, locale: string): string {
  const now = new Date();

  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const fmtYear = (d: Date) =>
    d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  if (period === 'day') {
    return now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  }
  if (period === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const from = new Date(now.getFullYear(), now.getMonth(), diff);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return `${fmt(from)} – ${fmt(to)}`;
  }
  if (period === 'month') {
    return now.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }
  if (period === 'year') {
    return now.getFullYear().toString();
  }
  return t('activity.all_activity');
}

function formatDuration(seconds: number, t: any): string {
  if (!seconds || seconds <= 0) return `0 ${t('activity.min_suffix')}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${t('activity.min_suffix')}`;
  const hours = (seconds / 3600).toFixed(1);
  return `${hours} ${t('activity.hour_suffix')}`;
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
  topArtist: '',
  topArtistId: '',
  topArtistImg: null,
  topArtistDuration: 0,
  topArtistPlays: 0,
  topAlbum: '',
  topAlbumId: '',
  topAlbumImg: null,
  topAlbumDuration: 0,
  topAlbumPlays: 0,
  topSong: '',
  topSongId: '',
  topSongImg: null,
  topSongArtist: '',
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
  const [activeOption, setActiveOption] = useState<'highlights' | 'songs' | 'albums' | 'artists'>('highlights');

  // Custom date picker states
  const [isCustomDatePickerVisible, setIsCustomDatePickerVisible] = useState(false);
  const [fromDay, setFromDay] = useState(new Date().getDate().toString());
  const [fromMonth, setFromMonth] = useState((new Date().getMonth() + 1).toString());
  const [fromYear, setFromYear] = useState(new Date().getFullYear().toString());

  const [toDay, setToDay] = useState(new Date().getDate().toString());
  const [toMonth, setToMonth] = useState((new Date().getMonth() + 1).toString());
  const [toYear, setToYear] = useState(new Date().getFullYear().toString());

  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date>(new Date());

  const [detailedStats, setDetailedStats] = useState<{
    totalHours: number;
    totalPlays: number;
    topSongs: any[];
    topAlbums: any[];
    topArtists: any[];
  }>({
    totalHours: 0,
    totalPlays: 0,
    topSongs: [],
    topAlbums: [],
    topArtists: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [smartLists, setSmartLists] = useState<{ id: string; name: string; placeholderIcon: string; trackCount: number }[]>([]);

  const loadStatsSmartLists = useCallback(async () => {
    try {
      const lists = SmartListService.getSmartLists();
      const loaded = await Promise.all(
        lists.map(async (list) => {
          const tracks = await list.getTracks();
          return {
            id: list.id,
            name: list.name,
            placeholderIcon: list.placeholderIcon,
            trackCount: tracks.length,
          };
        })
      );
      setSmartLists(loaded);
    } catch (e) {
      console.error('[ActivityMainScreen] Error loading smart lists:', e);
    }
  }, []);

  const visibleSmartLists = React.useMemo(() => {
    const nonKeys = smartLists.filter(l => l.trackCount > 0);
    if (period === 'week') {
      return nonKeys.filter(l => l.id === 'top_50_week' || l.id === 'top_50');
    }
    if (period === 'month') {
      return nonKeys.filter(l => l.id === 'top_50_month' || l.id === 'top_50');
    }
    return nonKeys.filter(l => l.id === 'top_50');
  }, [smartLists, period]);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await HistoryService.getDetailedStatsForPeriod(
        period,
        metric,
        customFrom,
        customTo
      );
      setDetailedStats(result);
    } catch (err) {
      console.error('[ActivityMainScreen] Failed to fetch stats:', err);
      setDetailedStats({
        totalHours: 0,
        totalPlays: 0,
        topSongs: [],
        topAlbums: [],
        topArtists: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [period, metric, customFrom, customTo]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
      loadStatsSmartLists();
    }, [fetchStats, loadStatsSmartLists])
  );

  const stats = React.useMemo(() => {
    const topSong = detailedStats.topSongs[0];
    const topAlbum = detailedStats.topAlbums[0];
    const topArtist = detailedStats.topArtists[0];
    return {
      totalHours: detailedStats.totalHours,
      totalPlays: detailedStats.totalPlays,
      topSong: topSong?.title || '',
      topSongId: topSong?.id || '',
      topSongImg: topSong?.coverUrl || null,
      topSongArtist: topSong?.artistName || '',
      topSongDuration: topSong?.duration || 0,
      topSongPlays: topSong?.plays || 0,
      topAlbum: topAlbum?.title || '',
      topAlbumId: topAlbum?.id || '',
      topAlbumImg: topAlbum?.coverUrl || null,
      topAlbumDuration: topAlbum?.duration || 0,
      topAlbumPlays: topAlbum?.plays || 0,
      topArtist: topArtist?.name || '',
      topArtistId: topArtist?.id || '',
      topArtistImg: topArtist?.imageUrl || null,
      topArtistDuration: topArtist?.duration || 0,
      topArtistPlays: topArtist?.plays || 0,
    };
  }, [detailedStats]);

  const formattedPeriodText = React.useMemo(() => {
    if (period === 'custom' && customFrom && customTo) {
      const locale = t('activity.locale_code') || 'es-ES';
      return `${customFrom.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${customTo.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return formatDateRange(period, t, t('activity.locale_code') || 'es-ES');
  }, [period, customFrom, customTo, t]);

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

  const playTrackById = async (id: string) => {
    try {
      const track = await database.get<Track>('tracks').find(id);
      usePlayerStore.getState().playSingleTrack(track, 'activity-stats');
    } catch (e) {
      console.warn('[ActivityMainScreen] Failed to play track:', e);
    }
  };

  const applyCustomRange = () => {
    const fd = parseInt(fromDay);
    const fm = parseInt(fromMonth) - 1;
    const fy = parseInt(fromYear);

    const td = parseInt(toDay);
    const tm = parseInt(toMonth) - 1;
    const ty = parseInt(toYear);

    const fDate = new Date(fy, fm, fd, 0, 0, 0, 0);
    const tDate = new Date(ty, tm, td, 23, 59, 59, 999);

    if (isNaN(fDate.getTime()) || isNaN(tDate.getTime())) {
      return;
    }

    setCustomFrom(fDate);
    setCustomTo(tDate);
    setPeriod('custom');
    setIsCustomDatePickerVisible(false);
  };

  const hasActivity = stats.totalHours > 0 || stats.totalPlays > 0;

  const artistStatLabel = metric === 'duration'
    ? t('activity.listening_time', { time: formatDuration(stats.topArtistDuration, t) })
    : stats.topArtistPlays === 1
      ? t('activity.reproduction_singular', { count: stats.topArtistPlays })
      : t('activity.reproduction_plural', { count: stats.topArtistPlays });

  const albumStatLabel = metric === 'duration'
    ? t('activity.listening_time', { time: formatDuration(stats.topAlbumDuration, t) })
    : stats.topAlbumPlays === 1
      ? t('activity.reproduction_singular', { count: stats.topAlbumPlays })
      : t('activity.reproduction_plural', { count: stats.topAlbumPlays });

  const songStatLabel = metric === 'duration'
    ? `${stats.topSongArtist || t('activity.unknown_artist')} · ${formatDuration(stats.topSongDuration, t)}`
    : stats.topSongPlays === 1
      ? `${stats.topSongArtist || t('activity.unknown_artist')} · ${t('activity.reproduction_singular', { count: stats.topSongPlays })}`
      : `${stats.topSongArtist || t('activity.unknown_artist')} · ${t('activity.reproduction_plural', { count: stats.topSongPlays })}`;

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
                {t(`activity.periods.${p}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DATE RANGE + METRIC TOGGLE */}
      <View style={styles.controlsRow}>
        <View style={styles.dateRangeSelector}>
          <Text style={[styles.dateRangeText, { fontFamily: fonts.regular, color: colors.textSecondary }]} numberOfLines={1}>
            {formattedPeriodText}
          </Text>
          <TouchableOpacity
            style={styles.calendarIconContainer}
            onPress={() => setIsCustomDatePickerVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.accentLight} />
          </TouchableOpacity>
        </View>
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
                      {metric === 'duration' ? t('activity.hour_suffix') : t('activity.plays')}
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
                    ? t('activity.total_listening_time', { period: formattedPeriodText })
                    : t('activity.total_plays', { period: formattedPeriodText })}
                </Text>
              </View>

              {/* TABS OPTION SELECTOR (Highlights | Top Songs | Top Albums | Top Artists) */}
              <View style={styles.optionTabsRow}>
                {['highlights', 'songs', 'albums', 'artists'].map((opt) => {
                  const isActive = opt === activeOption;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setActiveOption(opt as any)}
                      activeOpacity={0.75}
                      style={[
                        styles.optionTab,
                        isActive && { borderBottomColor: colors.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionTabText,
                          { fontFamily: fonts.bold },
                          isActive ? { color: colors.accentLight } : { color: colors.textSecondary },
                        ]}
                      >
                        {t(`activity.options.${opt}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {activeOption === 'highlights' && (
                <>
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
                        {stats.topArtist || t('activity.none')}
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
                        {stats.topAlbum || t('activity.none')}
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
                        {stats.topSong || t('activity.none')}
                      </Text>
                      <Text style={[styles.cardStat, { fontFamily: fonts.regular, color: colors.textSecondary }]} numberOfLines={1}>
                        {songStatLabel}
                      </Text>
                    </View>
                    {stats.topSongId ? (
                      <Ionicons name="play" size={20} color={colors.accentLight} style={styles.arrow} />
                    ) : null}
                  </TouchableOpacity>

                  {/* Playlists para ti */}
                  {visibleSmartLists.length > 0 && (
                    <View style={styles.smartListsSection}>
                      <Text style={[styles.sectionHeading, { fontFamily: fonts.bold, color: colors.textSecondary, marginTop: 24, marginBottom: 12 }]}>
                        Playlists para ti
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScroll}
                        keyboardShouldPersistTaps="handled"
                      >
                        {visibleSmartLists.map((list) => (
                          <View key={list.id} style={{ marginRight: 15 }}>
                            <LibraryCard
                              title={list.name}
                              subtitle={`${list.trackCount} ${list.trackCount === 1 ? t('library.song_singular') : t('library.song_plural')}`}
                              placeholderIcon={list.placeholderIcon as any}
                              smartListId={list.id}
                              onPress={() => navigation.navigate('SmartListDetail', { smartListId: list.id })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {activeOption === 'songs' && (
                <View style={styles.listContainer}>
                  {detailedStats.topSongs.map((item, index) => {
                    const statLabel = metric === 'duration'
                      ? formatDuration(item.duration, t)
                      : item.plays === 1
                        ? t('activity.reproduction_singular', { count: item.plays })
                        : t('activity.reproduction_plural', { count: item.plays });
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.listItem}
                        activeOpacity={0.7}
                        onPress={() => playTrackById(item.id)}
                      >
                        <Text style={[styles.rankText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
                          {index + 1}
                        </Text>
                        {item.coverUrl ? (
                          <Image source={{ uri: item.coverUrl }} style={[styles.listCover, { borderRadius: radii.sm || 4 }]} />
                        ) : (
                          <View style={[styles.listCoverPlaceholder, { borderRadius: radii.sm || 4, backgroundColor: colors.accentAlpha30 }]}>
                            <Ionicons name="musical-note" size={20} color={colors.accentLight} />
                          </View>
                        )}
                        <View style={styles.listItemInfo}>
                          <Text style={[styles.listItemTitle, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.listItemSubtitle, { fontFamily: fonts.regular, color: colors.textSecondary }]} numberOfLines={1}>
                            {item.artistName}
                          </Text>
                        </View>
                        <Text style={[styles.listStatText, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                          {statLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {activeOption === 'albums' && (
                <View style={styles.listContainer}>
                  {detailedStats.topAlbums.map((item, index) => {
                    const statLabel = metric === 'duration'
                      ? formatDuration(item.duration, t)
                      : item.plays === 1
                        ? t('activity.reproduction_singular', { count: item.plays })
                        : t('activity.reproduction_plural', { count: item.plays });
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.listItem}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('AlbumDetail', { albumId: item.id })}
                      >
                        <Text style={[styles.rankText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
                          {index + 1}
                        </Text>
                        {item.coverUrl ? (
                          <Image source={{ uri: item.coverUrl }} style={[styles.listCover, { borderRadius: radii.sm || 4 }]} />
                        ) : (
                          <View style={[styles.listCoverPlaceholder, { borderRadius: radii.sm || 4, backgroundColor: colors.accentAlpha30 }]}>
                            <Ionicons name="albums" size={20} color={colors.accentLight} />
                          </View>
                        )}
                        <View style={styles.listItemInfo}>
                          <Text style={[styles.listItemTitle, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.listItemSubtitle, { fontFamily: fonts.regular, color: colors.textSecondary }]} numberOfLines={1}>
                            {item.artistName || t('activity.unknown_artist')}
                          </Text>
                        </View>
                        <Text style={[styles.listStatText, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                          {statLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {activeOption === 'artists' && (
                <View style={styles.listContainer}>
                  {detailedStats.topArtists.map((item, index) => {
                    const statLabel = metric === 'duration'
                      ? formatDuration(item.duration, t)
                      : item.plays === 1
                        ? t('activity.reproduction_singular', { count: item.plays })
                        : t('activity.reproduction_plural', { count: item.plays });
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.listItem}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('ArtistDetail', { artistId: item.id })}
                      >
                        <Text style={[styles.rankText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
                          {index + 1}
                        </Text>
                        {item.imageUrl ? (
                          <Image source={{ uri: item.imageUrl }} style={[styles.listAvatar, { borderRadius: 20 }]} />
                        ) : (
                          <View style={[styles.listAvatarPlaceholder, { borderRadius: 20, backgroundColor: colors.accentAlpha30 }]}>
                            <Ionicons name="person" size={20} color={colors.accentLight} />
                          </View>
                        )}
                        <View style={styles.listItemInfo}>
                          <Text style={[styles.listItemTitle, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>
                        <Text style={[styles.listStatText, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                          {statLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
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

      {isCustomDatePickerVisible && (
        <Modal
          visible={isCustomDatePickerVisible}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={() => setIsCustomDatePickerVisible(false)}
        >
          <StatusBar style="light" />
          <Pressable
            style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}
            onPress={() => setIsCustomDatePickerVisible(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340 }}>
              <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderRadius: radii.lg || 12 }]}>
                <Text style={[styles.modalTitle, { fontFamily: fonts.bold, color: colors.text }]}>
                  {t('activity.custom_date_title')}
                </Text>

                {/* START DATE */}
                <Text style={[styles.modalInputLabel, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
                  {t('activity.custom_date_from')}
                </Text>
                <View style={styles.dateInputsRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.miniLabel}>{t('activity.day')}</Text>
                    <TextInput
                      style={[styles.dateInput, { borderColor: 'rgba(255,255,255,0.1)', color: colors.text, fontFamily: fonts.regular }]}
                      keyboardType="numeric"
                      maxLength={2}
                      value={fromDay}
                      onChangeText={setFromDay}
                      placeholder="DD"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.miniLabel}>{t('activity.month')}</Text>
                    <TextInput
                      style={[styles.dateInput, { borderColor: 'rgba(255,255,255,0.1)', color: colors.text, fontFamily: fonts.regular }]}
                      keyboardType="numeric"
                      maxLength={2}
                      value={fromMonth}
                      onChangeText={setFromMonth}
                      placeholder="MM"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.miniLabel}>{t('activity.year')}</Text>
                    <TextInput
                      style={[styles.dateInput, { borderColor: 'rgba(255,255,255,0.1)', color: colors.text, fontFamily: fonts.regular }]}
                      keyboardType="numeric"
                      maxLength={4}
                      value={fromYear}
                      onChangeText={setFromYear}
                      placeholder="AAAA"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                </View>

                {/* END DATE */}
                <Text style={[styles.modalInputLabel, { fontFamily: fonts.bold, color: colors.textSecondary, marginTop: 16 }]}>
                  {t('activity.custom_date_to')}
                </Text>
                <View style={styles.dateInputsRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.miniLabel}>{t('activity.day')}</Text>
                    <TextInput
                      style={[styles.dateInput, { borderColor: 'rgba(255,255,255,0.1)', color: colors.text, fontFamily: fonts.regular }]}
                      keyboardType="numeric"
                      maxLength={2}
                      value={toDay}
                      onChangeText={setToDay}
                      placeholder="DD"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.miniLabel}>{t('activity.month')}</Text>
                    <TextInput
                      style={[styles.dateInput, { borderColor: 'rgba(255,255,255,0.1)', color: colors.text, fontFamily: fonts.regular }]}
                      keyboardType="numeric"
                      maxLength={2}
                      value={toMonth}
                      onChangeText={setToMonth}
                      placeholder="MM"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.miniLabel}>{t('activity.year')}</Text>
                    <TextInput
                      style={[styles.dateInput, { borderColor: 'rgba(255,255,255,0.1)', color: colors.text, fontFamily: fonts.regular }]}
                      keyboardType="numeric"
                      maxLength={4}
                      value={toYear}
                      onChangeText={setToYear}
                      placeholder="AAAA"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                </View>

                {/* ACTIONS */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelBtn]}
                    onPress={() => setIsCustomDatePickerVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cancelBtnText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn, { backgroundColor: colors.accent }]}
                    onPress={applyCustomRange}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.acceptBtnText, { fontFamily: fonts.bold, color: '#FFFFFF' }]}>
                      {t('common.accept')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
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
  dateRangeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  calendarIconContainer: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  // ---- OPTION TABS ----
  optionTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  optionTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  optionTabText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  // ---- DETAILED LISTS ----
  listContainer: {
    gap: 8,
    marginTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  rankText: {
    fontSize: 14,
    width: 24,
    textAlign: 'center',
    marginRight: 8,
  },
  listCover: {
    width: 40,
    height: 40,
  },
  listCoverPlaceholder: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listAvatar: {
    width: 40,
    height: 40,
  },
  listAvatarPlaceholder: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 12,
  },
  listStatText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  // ---- INLINE DATE PICKER ----
  inlinePickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  inlinePickerCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  // ---- CUSTOM DATE PICKER MODAL ----
  customModalOverlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  inputCol: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
    textAlign: 'center',
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  acceptBtn: {
    minWidth: 90,
  },
  acceptBtnText: {
    fontSize: 14,
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
  smartListsSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  horizontalScroll: {
    paddingRight: 20,
    marginTop: 5,
  },
});
