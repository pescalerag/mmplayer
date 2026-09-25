import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import ActivitySpotlightTutorial from '../../components/modals/ActivitySpotlightTutorial';
import { openCustomDateModal } from '../../store/useCustomDateModalStore';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
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
  const route = useRoute<any>();
  const isFromProfile = route.name === 'WeeklyActivity' || Boolean(route.params?.fromProfile);
  const { colors, fonts, radii } = useAppTheme();
  const { t } = useTranslation();

  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('duration');
  const [activeOption, setActiveOption] = useState<'highlights' | 'songs' | 'albums' | 'artists'>('highlights');

  const { hasSeenActivityTutorial, setHasSeenActivityTutorial } = useSettingsStore();
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);

  // Spotlight Tutorial Refs & Layouts
  const rootRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const periodTabsRef = useRef<View>(null);
  const metricToggleRef = useRef<View>(null);
  const heroCardRef = useRef<View>(null);
  const highlightsCardRef = useRef<View>(null);
  const smartListsRef = useRef<View>(null);
  const shareButtonRef = useRef<View>(null);

  const periodTabsLayout = useRef<any>(null);
  const metricToggleLayout = useRef<any>(null);
  const heroCardLayout = useRef<any>(null);
  const highlightsCardLayout = useRef<any>(null);
  const smartListsLayout = useRef<any>(null);
  const shareButtonLayout = useRef<any>(null);

  // Share Stats Modal State
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  // Custom date picker states
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date>(new Date());

  // Period offset and historical date limits
  const [dateOffset, setDateOffset] = useState<number>(0);
  const [firstHistoryDate, setFirstHistoryDate] = useState<Date | null>(null);

  useEffect(() => {
    HistoryService.getFirstHistoryDate().then((d) => setFirstHistoryDate(d));
  }, []);

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

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const latestFetchId = useRef(0);
  const activePeriodRef = useRef(period);
  activePeriodRef.current = period;
  const dateOffsetRef = useRef(dateOffset);
  dateOffsetRef.current = dateOffset;
  const activeMetricRef = useRef(metric);
  activeMetricRef.current = metric;
  const [smartLists, setSmartLists] = useState<{ id: string; name: string; placeholderIcon: string; trackCount: number }[]>([]);

  // Auto-launch tutorial on first visit
  useEffect(() => {
    if (!hasSeenActivityTutorial && !isLoading) {
      const timer = setTimeout(() => {
        setIsTutorialVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenActivityTutorial, isLoading]);

  // Ensure 'highlights' tab is active during tutorial so all targets exist
  useEffect(() => {
    if (isTutorialVisible) {
      setActiveOption('highlights');
    }
  }, [isTutorialVisible]);

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

  const dateRangeInfo = useMemo(() => {
    const now = new Date();
    const locale = t('activity.locale_code') || 'es-ES';

    if (period === 'all') {
      return {
        from: null,
        to: now,
        label: t('activity.all_activity') || 'Toda la actividad',
        canGoPrev: false,
        canGoNext: false,
      };
    }

    if (period === 'custom') {
      const fromStr = customFrom ? customFrom.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '...';
      const toStr = customTo ? customTo.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '...';
      return {
        from: customFrom,
        to: customTo,
        label: `${fromStr} – ${toStr}`,
        canGoPrev: false,
        canGoNext: false,
      };
    }

    const firstDate = firstHistoryDate;
    const firstDayStart = firstDate
      ? new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0, 0)
      : null;

    if (period === 'year') {
      const targetYear = now.getFullYear() + dateOffset;
      const from = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      const to = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      const label = String(targetYear);

      const canGoNext = targetYear < now.getFullYear();
      const canGoPrev = firstDate ? targetYear > firstDate.getFullYear() : false;

      return { from, to, label, canGoPrev, canGoNext };
    }

    if (period === 'month') {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + dateOffset, 1, 0, 0, 0, 0);
      const from = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
      const to = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthName = targetDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const canGoNext = from.getTime() < currentMonthStart.getTime();

      const firstMonthStart = firstDate
        ? new Date(firstDate.getFullYear(), firstDate.getMonth(), 1, 0, 0, 0, 0)
        : null;
      const canGoPrev = firstMonthStart ? from.getTime() > firstMonthStart.getTime() : false;

      return { from, to, label, canGoPrev, canGoNext };
    }

    if (period === 'week') {
      const nowDay = now.getDay();
      const currentMondayDiff = now.getDate() - nowDay + (nowDay === 0 ? -6 : 1);
      const targetMonday = new Date(now.getFullYear(), now.getMonth(), currentMondayDiff + (dateOffset * 7), 0, 0, 0, 0);
      const from = new Date(targetMonday);
      const to = new Date(targetMonday);
      to.setDate(targetMonday.getDate() + 6);
      to.setHours(23, 59, 59, 999);

      const fmt = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      const fmtWithYear = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

      let label: string;
      if (from.getFullYear() !== to.getFullYear()) {
        label = `${fmtWithYear(from)} – ${fmtWithYear(to)}`;
      } else if (from.getFullYear() !== now.getFullYear()) {
        label = `${fmt(from)} – ${fmtWithYear(to)}`;
      } else {
        label = `${fmt(from)} – ${fmt(to)}`;
      }

      const canGoNext = dateOffset < 0;
      const prevWeekEnd = new Date(from.getTime() - 1);
      const canGoPrev = firstDayStart ? prevWeekEnd.getTime() >= firstDayStart.getTime() : false;

      return { from, to, label, canGoPrev, canGoNext };
    }

    // period === 'day'
    const targetDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dateOffset, 0, 0, 0, 0);
    const from = new Date(targetDay);
    const to = new Date(targetDay);
    to.setHours(23, 59, 59, 999);

    let label: string;
    if (dateOffset === 0) {
      const formatted = targetDay.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
      label = `${t('activity.history_today') || 'Hoy'} · ${formatted}`;
    } else if (dateOffset === -1) {
      const formatted = targetDay.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
      label = `${t('activity.history_yesterday') || 'Ayer'} · ${formatted}`;
    } else {
      const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      };
      if (targetDay.getFullYear() !== now.getFullYear()) {
        dateOptions.year = 'numeric';
      }
      const formatted = targetDay.toLocaleDateString(locale, dateOptions);
      label = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    const canGoNext = dateOffset < 0;
    const canGoPrev = firstDayStart ? from.getTime() > firstDayStart.getTime() : false;

    return { from, to, label, canGoPrev, canGoNext };
  }, [period, dateOffset, firstHistoryDate, customFrom, customTo, t]);

  const handlePrevPeriod = useCallback(() => {
    if (dateRangeInfo.canGoPrev) {
      setIsLoading(true);
      setDateOffset((prev) => {
        const next = prev - 1;
        dateOffsetRef.current = next;
        return next;
      });
    }
  }, [dateRangeInfo.canGoPrev]);

  const handleNextPeriod = useCallback(() => {
    if (dateRangeInfo.canGoNext) {
      setIsLoading(true);
      setDateOffset((prev) => {
        const next = prev + 1;
        dateOffsetRef.current = next;
        return next;
      });
    }
  }, [dateRangeInfo.canGoNext]);

  const handlePeriodChange = useCallback((newPeriod: Period) => {
    if (newPeriod === activePeriodRef.current && dateOffsetRef.current === 0) {
      return;
    }
    activePeriodRef.current = newPeriod;
    dateOffsetRef.current = 0;
    setIsLoading(true);
    setPeriod(newPeriod);
    setDateOffset(0);
  }, []);

  const handleMetricChange = useCallback((newMetric: Metric) => {
    if (newMetric === activeMetricRef.current) {
      return;
    }
    activeMetricRef.current = newMetric;
    setIsLoading(true);
    setMetric(newMetric);
  }, []);

  const visibleSmartLists = React.useMemo(() => {
    const nonKeys = smartLists.filter(l => l.trackCount > 0);
    if (nonKeys.length === 0 && isTutorialVisible) {
      return [
        { id: 'top_50_week', name: 'Top 50 Semanal', placeholderIcon: 'trending-up', trackCount: 50 },
        { id: 'top_50', name: 'Top 50 Global', placeholderIcon: 'star', trackCount: 50 },
      ];
    }
    if (period === 'week' && dateOffset === 0) {
      return nonKeys.filter(l => l.id === 'top_50_week' || l.id === 'top_50');
    }
    if (period === 'month' && dateOffset === 0) {
      return nonKeys.filter(l => l.id === 'top_50_month' || l.id === 'top_50');
    }
    return nonKeys.filter(l => l.id === 'top_50');
  }, [smartLists, period, dateOffset, isTutorialVisible]);

  const fetchStats = useCallback(async (isRefresh = false) => {
    const fetchId = ++latestFetchId.current;
    if (!isRefresh) {
      setIsLoading(true);
    }
    try {
      const result = await HistoryService.getDetailedStatsForPeriod(
        period,
        metric,
        dateRangeInfo.from,
        dateRangeInfo.to
      );
      if (fetchId === latestFetchId.current) {
        setDetailedStats(result);
      }
    } catch (err) {
      console.error('[ActivityMainScreen] Failed to fetch stats:', err);
      if (fetchId === latestFetchId.current) {
        setDetailedStats({
          totalHours: 0,
          totalPlays: 0,
          topSongs: [],
          topAlbums: [],
          topArtists: [],
        });
      }
    } finally {
      if (fetchId === latestFetchId.current) {
        setIsLoading(false);
      }
    }
  }, [period, metric, dateRangeInfo.from, dateRangeInfo.to]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchStats(true), loadStatsSmartLists()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStats, loadStatsSmartLists]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
      loadStatsSmartLists();
    }, [fetchStats, loadStatsSmartLists])
  );

  const hasRealActivity = detailedStats.totalHours > 0 || detailedStats.totalPlays > 0;

  const stats = React.useMemo(() => {
    if (!hasRealActivity && isTutorialVisible) {
      return {
        totalHours: 14.5,
        totalPlays: 128,
        topSong: 'Midnight City',
        topSongId: '',
        topSongImg: null,
        topSongArtist: 'M83',
        topSongDuration: 245,
        topSongPlays: 42,
        topAlbum: "Hurry Up, We're Dreaming",
        topAlbumId: '',
        topAlbumImg: null,
        topAlbumDuration: 3600,
        topAlbumPlays: 65,
        topArtist: 'M83',
        topArtistId: '',
        topArtistImg: null,
        topArtistDuration: 7200,
        topArtistPlays: 110,
      };
    }
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
  }, [detailedStats, hasRealActivity, isTutorialVisible]);

  const formattedPeriodText = dateRangeInfo.label;

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

  const applyCustomRange = (startDate: Date, endDate: Date) => {
    if (
      activePeriodRef.current === 'custom' &&
      customFrom?.getTime() === startDate.getTime() &&
      customTo?.getTime() === endDate.getTime() &&
      dateOffsetRef.current === 0
    ) {
      return;
    }
    activePeriodRef.current = 'custom';
    dateOffsetRef.current = 0;
    setIsLoading(true);
    setCustomFrom(startDate);
    setCustomTo(endDate);
    setPeriod('custom');
    setDateOffset(0);
  };

  const hasActivity = hasRealActivity || isTutorialVisible;

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
    ? (dateOffset === 0 ? t('activity.today_highlights') : `${t('activity.options.highlights') || 'Destacados'} · ${dateRangeInfo.label}`)
    : period === 'week'
    ? (dateOffset === 0 ? t('activity.week_highlights') : `${t('activity.options.highlights') || 'Destacados'} · ${dateRangeInfo.label}`)
    : period === 'month'
    ? (dateOffset === 0 ? t('activity.month_highlights') : `${t('activity.options.highlights') || 'Destacados'} · ${dateRangeInfo.label}`)
    : period === 'year'
    ? (dateOffset === 0 ? t('activity.year_highlights') : `${t('activity.options.highlights') || 'Destacados'} · ${dateRangeInfo.label}`)
    : t('activity.global_highlights');

  return (
    <View ref={rootRef} style={[styles.root, { backgroundColor: colors.background }]}>
      {/* BACKGROUND GRADIENT */}
      <LinearGradient
        colors={[colors.accentAlpha15, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 12 }]}>
        {isFromProfile ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.headerTitle, { fontFamily: fonts.bold, color: colors.text }]}>
          {t('activity.title')}
        </Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => setIsTutorialVisible(true)}
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
            activeOpacity={0.7}
            accessibilityLabel={t('activity_tutorial.help_btn')}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ActivityHistory')}
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
            activeOpacity={0.7}
            accessibilityLabel={t('activity.history_title') || 'Historial'}
          >
            <Ionicons name="time-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            ref={shareButtonRef}
            onLayout={(e) => {
              if (e?.nativeEvent?.layout) shareButtonLayout.current = e.nativeEvent.layout;
            }}
            onPress={() =>
              navigation.navigate('ShareStats', {
                formattedPeriodText,
                metric,
                totalHours: detailedStats.totalHours,
                totalPlays: detailedStats.totalPlays,
                topArtists: detailedStats.topArtists,
                topSongs: detailedStats.topSongs,
              })
            }
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* PERIOD TABS */}
      <View
        ref={periodTabsRef}
        onLayout={(e) => {
          if (e?.nativeEvent?.layout) periodTabsLayout.current = e.nativeEvent.layout;
        }}
        style={styles.periodTabsRow}
      >
        {PERIODS.map((p) => {
          const isActive = p === period;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => handlePeriodChange(p)}
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
                  isActive ? { color: colors.onAccent } : { color: colors.textSecondary },
                ]}
              >
                {t(`activity.periods.${p}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* PERIOD NAVIGATOR ROW (< Date Label >) */}
      <View style={styles.periodNavigatorRow}>
        <TouchableOpacity
          style={[styles.arrowButton, !dateRangeInfo.canGoPrev && styles.arrowButtonDisabled]}
          onPress={handlePrevPeriod}
          disabled={!dateRangeInfo.canGoPrev}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Anterior"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={dateRangeInfo.canGoPrev ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)'}
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.periodNavigatorText,
            { fontFamily: fonts.bold, color: '#FFFFFF' },
          ]}
          numberOfLines={1}
        >
          {formattedPeriodText}
        </Text>

        <TouchableOpacity
          style={[styles.arrowButton, !dateRangeInfo.canGoNext && styles.arrowButtonDisabled]}
          onPress={handleNextPeriod}
          disabled={!dateRangeInfo.canGoNext}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Siguiente"
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={dateRangeInfo.canGoNext ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)'}
          />
        </TouchableOpacity>
      </View>

      {/* CONTROLS (FECHA PERSONALIZADA + METRIC TOGGLE) */}
      <View
        ref={metricToggleRef}
        onLayout={(e) => {
          if (e?.nativeEvent?.layout) metricToggleLayout.current = e.nativeEvent.layout;
        }}
        style={styles.controlsRow}
      >
        <TouchableOpacity
          style={[
            styles.customDateBtn,
            period === 'custom' && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent },
          ]}
          onPress={() => openCustomDateModal({
            initialStartDate: customFrom,
            initialEndDate: customTo,
            onApply: applyCustomRange,
          })}
          activeOpacity={0.75}
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={period === 'custom' ? colors.accentLight : colors.textSecondary}
          />
          <Text
            style={[
              styles.customDateBtnText,
              { fontFamily: fonts.bold },
              period === 'custom'
                ? { color: colors.accentLight }
                : { color: colors.textSecondary },
            ]}
          >
            {t('activity.custom_date_button') || 'Fecha personalizada'}
          </Text>
        </TouchableOpacity>

        <View style={styles.metricToggle}>
          <TouchableOpacity
            onPress={() => handleMetricChange('duration')}
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
            onPress={() => handleMetricChange('plays')}
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
          <ActivityIndicator color={colors.accentLight || colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 160 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accentLight || colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {hasActivity ? (
            <>
              {/* TOTAL HERO CARD */}
              <View
                ref={heroCardRef}
                onLayout={(e) => {
                  if (e?.nativeEvent?.layout) heroCardLayout.current = e.nativeEvent.layout;
                }}
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
              <View
                ref={highlightsCardRef}
                onLayout={(e) => {
                  if (e?.nativeEvent?.layout) highlightsCardLayout.current = e.nativeEvent.layout;
                }}
                style={styles.optionTabsRow}
              >
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
                    <View
                      ref={smartListsRef}
                      onLayout={(e) => {
                        if (e?.nativeEvent?.layout) smartListsLayout.current = e.nativeEvent.layout;
                      }}
                      style={styles.smartListsSection}
                    >
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

      <ActivitySpotlightTutorial
        visible={isTutorialVisible}
        onClose={() => {
          setIsTutorialVisible(false);
          setHasSeenActivityTutorial(true);
        }}
        rootRef={rootRef}
        scrollViewRef={scrollViewRef}
        periodTabsRef={periodTabsRef}
        metricToggleRef={metricToggleRef}
        heroCardRef={heroCardRef}
        highlightsCardRef={highlightsCardRef}
        smartListsRef={smartListsRef}
        shareButtonRef={shareButtonRef}
        periodTabsLayout={periodTabsLayout}
        metricToggleLayout={metricToggleLayout}
        heroCardLayout={heroCardLayout}
        highlightsCardLayout={highlightsCardLayout}
        smartListsLayout={smartListsLayout}
        shareButtonLayout={shareButtonLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    letterSpacing: 1.2,
    fontWeight: '800',
    includeFontPadding: false,
    textAlignVertical: 'center',
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
  // ---- PERIOD NAVIGATOR (< Date Label >) ----
  periodNavigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.35,
  },
  periodNavigatorText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 12,
    letterSpacing: 0.3,
  },
  // ---- CONTROLS (custom date + metric toggle) ----
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
  customDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  customDateBtnText: {
    fontSize: 11,
    fontWeight: '700',
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

  // ---- LOADING ----
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
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
