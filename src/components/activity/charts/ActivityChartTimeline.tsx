import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityChartStats, ChartMetric, formatChartBucket, getMonthDays } from '../../../utils/activityCharts';
import { Period } from '../../../screens/activity/utils/activityDateUtils';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { ActivityChartCard } from './ActivityChartCard';
import { ActivityBarChart } from './ActivityBarChart';

interface Props {
  readonly stats: ActivityChartStats;
  readonly period: Period;
  readonly metric: ChartMetric;
}

function ChartModeSelector({ cumulative, onChange }: { readonly cumulative: boolean; readonly onChange: (value: boolean) => void }) {
  const { colors, fonts, radii } = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.modes}>
      {[false, true].map(value => (
        <TouchableOpacity
          key={String(value)} accessibilityRole="button" accessibilityState={{ selected: cumulative === value }}
          onPress={() => onChange(value)}
          style={[styles.mode, { borderRadius: radii.md, backgroundColor: cumulative === value ? colors.accent : colors.overlayAlpha05 }]}
        >
          <Text style={{ color: cumulative === value ? colors.onAccent : colors.textSecondary, fontFamily: fonts.bold, fontSize: 12 }}>
            {t(value ? 'activity.charts.cumulative' : 'activity.charts.per_interval')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ActivityChartTimeline({ stats, period, metric }: Props) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  const [cumulative, setCumulative] = useState(false);
  const [month, setMonth] = useState<number | null>(null);
  const monthly = period === 'year' || period === 'all';
  const granularity = monthly ? 'month' : period === 'day' ? 'hour' : 'day';
  const buckets = monthly ? stats.months : period === 'day' ? stats.hours : stats.days;
  const title = metric === 'duration' ? t('activity.charts.listening_time') : t('activity.charts.play_count');
  return (
    <View style={styles.root}>
      <ActivityChartCard title={title}>
        <ChartModeSelector cumulative={cumulative} onChange={setCumulative} />
        <ActivityBarChart buckets={buckets} granularity={granularity} metric={metric} cumulative={cumulative} fitWidth={period !== 'all' && period !== 'custom'} onSelect={monthly ? setMonth : undefined} />
        {monthly && <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('activity.charts.tap_month')}</Text>}
      </ActivityChartCard>
      {monthly && month !== null && (
        <ActivityChartCard title={t('activity.charts.daily_detail', { month: formatChartBucket(month, 'month', t('activity.locale_code')) })}>
          <ActivityBarChart key={month} buckets={getMonthDays(stats.days, month)} granularity="day" metric={metric} cumulative={cumulative} fitWidth />
          {cumulative && <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('activity.charts.month_cumulative_hint')}</Text>}
          <TouchableOpacity accessibilityRole="button" onPress={() => setMonth(null)} style={styles.close}>
            <Text style={{ color: colors.accentLight, fontFamily: fonts.bold }}>{t('activity.charts.close_detail')}</Text>
          </TouchableOpacity>
        </ActivityChartCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  hint: { fontSize: 11, lineHeight: 16 },
  close: { paddingVertical: 10, alignItems: 'center' },
});
