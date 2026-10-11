import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useActivityCharts } from '../../../hooks/useActivityCharts';
import { useCascadeEntry } from '../../../hooks/useCascadeEntry';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { ActivityChartStats, ChartMetric } from '../../../utils/activityCharts';
import { Period } from '../../../screens/activity/utils/activityDateUtils';
import { ActivityChartAverages } from './ActivityChartAverages';
import { ActivityListeningClock } from './ActivityListeningClock';
import { ActivityChartTimeline } from './ActivityChartTimeline';
import { ActivityChartTotals } from './ActivityChartTotals';

interface Props {
  readonly from: Date | null;
  readonly to: Date;
  readonly period: Period;
  readonly metric: ChartMetric;
  readonly refreshKey: number;
}

function ChartContent({ stats, period, metric, showTotals }: { readonly stats: ActivityChartStats; readonly period: Period; readonly metric: ChartMetric; readonly showTotals?: boolean }) {
  const cascade = useCascadeEntry();
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  const contentOffset = showTotals ? 1 : 0;
  return (
    <View style={styles.content}>
      {showTotals && <Animated.View entering={cascade.section(0)}><ActivityChartTotals stats={stats} /></Animated.View>}
      <Animated.View entering={cascade.section(contentOffset)}><ActivityChartAverages stats={stats} /></Animated.View>
      {stats.hours.every(hour => hour.plays === 0) ? (
        <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('activity.charts.empty')}</Text>
      ) : (
        <>
          <Animated.View entering={cascade.section(contentOffset + 1)}><ActivityListeningClock hours={stats.hours} metric={metric} /></Animated.View>
          <Animated.View entering={cascade.section(contentOffset + 2)}><ActivityChartTimeline stats={stats} period={period} metric={metric} /></Animated.View>
        </>
      )}
    </View>
  );
}

export function ActivityChartsTab({ from, to, period, metric, refreshKey }: Props) {
  const { data, error, isLoading, showLoader, reload } = useActivityCharts(from, to, refreshKey);
  return <ActivityChartsResult data={data} error={error} isLoading={isLoading} showLoader={showLoader} reload={reload} period={period} metric={metric} contentKey={`${from?.getTime()}:${to.getTime()}:${refreshKey}`} />;
}

interface ResultProps {
  readonly data: ActivityChartStats | null;
  readonly error: boolean;
  readonly isLoading: boolean;
  readonly showLoader: boolean;
  readonly reload: () => Promise<void>;
  readonly period: Period;
  readonly metric: ChartMetric;
  readonly contentKey: string;
  readonly showTotals?: boolean;
}

export function ActivityChartsResult({ data, error, isLoading, showLoader, reload, period, metric, contentKey, showTotals }: ResultProps) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  if (isLoading) {
    return <View style={styles.placeholder}>{showLoader && <ActivityIndicator color={colors.accent} accessibilityLabel={t('activity.charts.loading')} />}</View>;
  }
  if (error) {
    return (
      <View style={styles.placeholder}>
        <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('activity.charts.error')}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => { void reload(); }} style={styles.retry}>
          <Text style={{ color: colors.accentLight, fontFamily: fonts.bold }}>{t('activity.charts.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!data) return null;
  return <ChartContent key={contentKey} stats={data} period={period} metric={metric} showTotals={showTotals} />;
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  placeholder: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  retry: { padding: 16 },
});
