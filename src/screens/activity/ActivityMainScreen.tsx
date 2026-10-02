import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { openCustomDateModal } from '../../store/useCustomDateModalStore';
import { SkeletonActivityScreen } from '@/components/common/Skeleton';
import ActivitySpotlightTutorial from '../../components/modals/ActivitySpotlightTutorial';
import Animated from 'react-native-reanimated';
import { getSectionFadeIn } from '@/utils/cascadeAnimations';

// Activity components
import { ActivityHeader } from '../../components/activity/ActivityHeader';
import { ActivityPeriodTabs } from '../../components/activity/ActivityPeriodTabs';
import { ActivityPeriodNavigator } from '../../components/activity/ActivityPeriodNavigator';
import { ActivityControlsRow } from '../../components/activity/ActivityControlsRow';
import { ActivityHeroCard } from '../../components/activity/ActivityHeroCard';
import { ActivityOptionTabs } from '../../components/activity/ActivityOptionTabs';
import { ActivityTabContent } from '../../components/activity/ActivityTabContent';
import { ActivityEmptyState } from '../../components/activity/ActivityEmptyState';

import {
  Metric,
  ActivityOption,
  getSectionLabel,
  getHighlightStatLabel,
  getSongHighlightStatLabel,
  getDisplayStats,
  getVisibleSmartLists,
} from './utils/activityStatUtils';
import { useActivityData } from './hooks/useActivityData';
import { usePeriodNavigation } from './hooks/usePeriodNavigation';
import { useTutorialState } from './hooks/useTutorialState';

async function playTrack(trackId: string, context: string) {
  try {
    const track = await database.get<Track>('tracks').find(trackId);
    await usePlayerStore.getState().playSingleTrack(track, context);
  } catch (err) {
    console.warn(`[ActivityMainScreen] Failed to play track (${context}):`, err);
  }
}

export default function ActivityMainScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFromProfile = route.name === 'WeeklyActivity' || Boolean(route.params?.fromProfile);
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  const [metric, setMetric] = useState<Metric>('duration');
  const [activeOption, setActiveOption] = useState<ActivityOption>('highlights');
  const activeMetricRef = useRef(metric);
  activeMetricRef.current = metric;

  const { hasSeenActivityTutorial, setHasSeenActivityTutorial } = useSettingsStore();

  const loadingSetterRef = useRef<(l: boolean) => void>(() => {});
  const handleDateLoadingChange = useCallback((loading: boolean) => {
    loadingSetterRef.current(loading);
  }, []);

  const {
    period,
    dateOffset,
    customFrom,
    customTo,
    dateRangeInfo,
    handlePrevPeriod,
    handleNextPeriod,
    handlePeriodChange,
    applyCustomRange,
  } = usePeriodNavigation(handleDateLoadingChange, t);

  const {
    detailedStats,
    isLoading,
    setIsLoading,
    showLoader,
    isRefreshing,
    smartLists,
    handleRefresh,
  } = useActivityData(period, metric, dateRangeInfo.from, dateRangeInfo.to);

  loadingSetterRef.current = setIsLoading;

  const {
    isTutorialVisible,
    setIsTutorialVisible,
    refs,
    layouts,
  } = useTutorialState(hasSeenActivityTutorial, isLoading);

  // Ensure 'highlights' tab is active during tutorial so all targets exist
  useEffect(() => {
    if (isTutorialVisible) {
      setActiveOption('highlights');
    }
  }, [isTutorialVisible]);

  const handleMetricChange = useCallback(
    (newMetric: Metric) => {
      if (newMetric === activeMetricRef.current) return;
      activeMetricRef.current = newMetric;
      setIsLoading(true);
      setMetric(newMetric);
    },
    [setIsLoading]
  );

  const hasRealActivity = detailedStats.totalHours > 0 || detailedStats.totalPlays > 0;
  const hasActivity = hasRealActivity || isTutorialVisible;

  const stats = useMemo(
    () => getDisplayStats(detailedStats, hasRealActivity, isTutorialVisible),
    [detailedStats, hasRealActivity, isTutorialVisible]
  );

  const visibleSmartLists = useMemo(
    () => getVisibleSmartLists(smartLists, period, dateOffset, isTutorialVisible),
    [smartLists, period, dateOffset, isTutorialVisible]
  );

  const sectionLabel = useMemo(
    () => getSectionLabel(period, dateOffset, dateRangeInfo.label, t),
    [period, dateOffset, dateRangeInfo.label, t]
  );

  const artistStatLabel = useMemo(
    () => getHighlightStatLabel(metric, stats.topArtistDuration, stats.topArtistPlays, t),
    [metric, stats.topArtistDuration, stats.topArtistPlays, t]
  );

  const albumStatLabel = useMemo(
    () => getHighlightStatLabel(metric, stats.topAlbumDuration, stats.topAlbumPlays, t),
    [metric, stats.topAlbumDuration, stats.topAlbumPlays, t]
  );

  const songStatLabel = useMemo(
    () => getSongHighlightStatLabel(metric, stats.topSongArtist, stats.topSongDuration, stats.topSongPlays, t),
    [metric, stats.topSongArtist, stats.topSongDuration, stats.topSongPlays, t]
  );

  const handleArtistPress = useCallback(() => {
    if (stats.topArtistId) {
      navigation.navigate('ArtistDetail', { artistId: stats.topArtistId });
    }
  }, [navigation, stats.topArtistId]);

  const handleAlbumPress = useCallback(() => {
    if (stats.topAlbumId) {
      navigation.navigate('AlbumDetail', { albumId: stats.topAlbumId });
    }
  }, [navigation, stats.topAlbumId]);

  const handleSongPress = useCallback(() => {
    if (stats.topSongId) {
      void playTrack(stats.topSongId, 'activity-main');
    }
  }, [stats.topSongId]);

  const playTrackById = useCallback((id: string) => {
    void playTrack(id, 'activity-stats');
  }, []);

  const handleSharePress = useCallback(() => {
    navigation.navigate('ShareStats', {
      formattedPeriodText: dateRangeInfo.label,
      metric,
      totalHours: detailedStats.totalHours,
      totalPlays: detailedStats.totalPlays,
      topArtists: detailedStats.topArtists,
      topSongs: detailedStats.topSongs,
    });
  }, [navigation, dateRangeInfo.label, metric, detailedStats]);

  const handleOpenCustomDate = useCallback(() => {
    openCustomDateModal({
      initialStartDate: customFrom,
      initialEndDate: customTo,
      onApply: applyCustomRange,
    });
  }, [customFrom, customTo, applyCustomRange]);

  const handleTutorialClose = useCallback(() => {
    setIsTutorialVisible(false);
    setHasSeenActivityTutorial(true);
  }, [setIsTutorialVisible, setHasSeenActivityTutorial]);

  const handleAlbumSelect = useCallback(
    (id: string) => {
      navigation.navigate('AlbumDetail', { albumId: id });
    },
    [navigation]
  );

  const handleArtistSelect = useCallback(
    (id: string) => {
      navigation.navigate('ArtistDetail', { artistId: id });
    },
    [navigation]
  );

  const handleSmartListPress = useCallback(
    (id: string) => {
      navigation.navigate('SmartListDetail', { smartListId: id });
    },
    [navigation]
  );

  return (
    <View ref={refs.rootRef} style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.accentAlpha15, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ActivityHeader
        isFromProfile={isFromProfile}
        onBack={() => navigation.goBack()}
        onHelp={() => setIsTutorialVisible(true)}
        onHistory={() => navigation.navigate('ActivityHistory')}
        onShare={handleSharePress}
        shareButtonRef={refs.shareButtonRef}
        shareButtonLayout={layouts.shareButtonLayout}
      />

      <ActivityPeriodTabs
        period={period}
        onPeriodChange={handlePeriodChange}
        periodTabsRef={refs.periodTabsRef}
        periodTabsLayout={layouts.periodTabsLayout}
      />

      <ActivityPeriodNavigator
        formattedPeriodText={dateRangeInfo.label}
        canGoPrev={dateRangeInfo.canGoPrev}
        canGoNext={dateRangeInfo.canGoNext}
        onPrevPeriod={handlePrevPeriod}
        onNextPeriod={handleNextPeriod}
      />

      <ActivityControlsRow
        period={period}
        metric={metric}
        onOpenCustomDate={handleOpenCustomDate}
        onMetricChange={handleMetricChange}
        metricToggleRef={refs.metricToggleRef}
        metricToggleLayout={layouts.metricToggleLayout}
      />

      {(() => {
        if (showLoader) {
          return <SkeletonActivityScreen topOffset={12} />;
        }
        if (isLoading) {
          return null;
        }
        return (
          <ScrollView
            ref={refs.scrollViewRef}
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
                <Animated.View entering={getSectionFadeIn(0)}>
                  <ActivityHeroCard
                    metric={metric}
                    totalHours={stats.totalHours}
                    totalPlays={stats.totalPlays}
                    formattedPeriodText={dateRangeInfo.label}
                    heroCardRef={refs.heroCardRef}
                    heroCardLayout={layouts.heroCardLayout}
                  />
                </Animated.View>

                <Animated.View entering={getSectionFadeIn(1)}>
                  <ActivityOptionTabs
                    activeOption={activeOption}
                    onSelectOption={setActiveOption}
                    highlightsCardRef={refs.highlightsCardRef}
                    highlightsCardLayout={layouts.highlightsCardLayout}
                  />
                </Animated.View>

                <Animated.View
                  key={`activity-tab-${activeOption}-${period}-${dateRangeInfo.label}-${metric}`}
                  entering={getSectionFadeIn(2)}
                >
                  <ActivityTabContent
                    activeOption={activeOption}
                    sectionLabel={sectionLabel}
                    stats={stats}
                    artistStatLabel={artistStatLabel}
                    albumStatLabel={albumStatLabel}
                    songStatLabel={songStatLabel}
                    onArtistPress={handleArtistPress}
                    onAlbumPress={handleAlbumPress}
                    onSongPress={handleSongPress}
                    visibleSmartLists={visibleSmartLists}
                    onSmartListPress={handleSmartListPress}
                    smartListsRef={refs.smartListsRef}
                    smartListsLayout={layouts.smartListsLayout}
                    detailedStats={detailedStats}
                    metric={metric}
                    playTrackById={playTrackById}
                    onAlbumSelect={handleAlbumSelect}
                    onArtistSelect={handleArtistSelect}
                  />
                </Animated.View>
              </>
            ) : (
              <ActivityEmptyState />
            )}
          </ScrollView>
        );
      })()}

      <ActivitySpotlightTutorial
        visible={isTutorialVisible}
        onClose={handleTutorialClose}
        rootRef={refs.rootRef}
        scrollViewRef={refs.scrollViewRef}
        periodTabsRef={refs.periodTabsRef}
        metricToggleRef={refs.metricToggleRef}
        heroCardRef={refs.heroCardRef}
        highlightsCardRef={refs.highlightsCardRef}
        smartListsRef={refs.smartListsRef}
        shareButtonRef={refs.shareButtonRef}
        periodTabsLayout={layouts.periodTabsLayout}
        metricToggleLayout={layouts.metricToggleLayout}
        heroCardLayout={layouts.heroCardLayout}
        highlightsCardLayout={layouts.highlightsCardLayout}
        smartListsLayout={layouts.smartListsLayout}
        shareButtonLayout={layouts.shareButtonLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
});
