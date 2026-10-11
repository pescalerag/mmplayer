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

interface Props {
  readonly from: Date | null;
  readonly to: Date;
  readonly period: Period;
  readonly metric: ChartMetric;
  readonly refreshKey: number;
}

function ChartContent({ stats, period, metric }: { readonly stats: ActivityChartStats; readonly period: Period; readonly metric: ChartMetric }) {
  const cascade = useCascadeEntry();
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.content}>
      <Animated.View entering={cascade.section(0)}><ActivityChartAverages stats={stats} /></Animated.View>
      {stats.days.length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('activity.charts.empty')}</Text>
      ) : (
        <>
          <Animated.View entering={cascade.section(1)}><ActivityListeningClock hours={stats.hours} metric={metric} /></Animated.View>
          <Animated.View entering={cascade.section(2)}><ActivityChartTimeline stats={stats} period={period} metric={metric} /></Animated.View>
        </>
      )}
    </View>
  );
}

export function ActivityChartsTab({ from, to, period, metric, refreshKey }: Props) {
  const { data, error, isLoading, showLoader, reload } = useActivityCharts(from, to, refreshKey);
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
  return <ChartContent key={`${from?.getTime()}:${to.getTime()}:${refreshKey}`} stats={data} period={period} metric={metric} />;
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  placeholder: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  retry: { padding: 16 },
});
