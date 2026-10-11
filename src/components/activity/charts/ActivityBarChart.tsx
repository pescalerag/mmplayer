import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChartBucket, ChartGranularity, ChartMetric, formatChartBucket, getChartValues } from '../../../utils/activityCharts';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { formatCompactChartTick, getCompactChartLayout } from '../../../utils/activityChartLayout';

interface Props {
  readonly buckets: readonly ChartBucket[];
  readonly granularity: ChartGranularity;
  readonly metric: ChartMetric;
  readonly cumulative: boolean;
  readonly fitWidth?: boolean;
  readonly onSelect?: (key: number) => void;
}

export function ActivityBarChart({ buckets, granularity, metric, cumulative, fitWidth = false, onSelect }: Props) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const values = getChartValues(buckets, metric, cumulative);
  const max = Math.max(0, ...values);
  const locale = t('activity.locale_code');
  const unit = metric === 'duration' ? t('activity.min_suffix') : t('activity.plays');
  const formatValue = (value: number) => `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${unit}`;
  const selectedIndex = buckets.findIndex(bucket => bucket.key === selected);
  const detail = selectedIndex >= 0
    ? `${formatChartBucket(buckets[selectedIndex].key, granularity, locale)} · ${formatValue(values[selectedIndex])}`
    : t('activity.charts.tap_bar');
  const layout = getCompactChartLayout(width, buckets.length);

  const plot = (
    <View style={[styles.plot, { borderBottomColor: colors.overlayAlpha15 }, fitWidth && { width, gap: layout.gap }]}>
      {buckets.map((bucket, index) => {
        const label = formatChartBucket(bucket.key, granularity, locale);
        const height = max > 0 ? values[index] / max * 130 : 0;
        return (
          <TouchableOpacity
            key={bucket.key}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${formatValue(values[index])}`}
            accessibilityState={{ selected: bucket.key === selected }}
            onPress={() => { setSelected(bucket.key); onSelect?.(bucket.key); }}
            style={[styles.column, fitWidth && { width: layout.barWidth, minHeight: 134 }]}
          >
            <View style={[styles.barSpace, fitWidth && styles.compactBarSpace]}>
              <View style={[styles.bar, { height: Math.max(height, 2), backgroundColor: bucket.key === selected ? colors.accentLight : colors.accent, opacity: values[index] > 0 ? 1 : 0.18 }]} />
            </View>
            {!fitWidth && <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={2}>{label}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.root}>
      <Text style={[styles.axis, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{formatValue(max)}</Text>
      {fitWidth ? (
        <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
          {plot}
          <View style={styles.compactAxis}>
            {layout.ticks.map(tick => (
              <Text key={tick.index} style={[styles.tick, { left: tick.left, width: tick.width, color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {formatCompactChartTick(buckets[tick.index].key, granularity, locale)}
              </Text>
            ))}
          </View>
        </View>
      ) : <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>{plot}</ScrollView>}
      <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.text, fontFamily: fonts.regular }]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  axis: { fontSize: 11 },
  plot: { flexDirection: 'row', gap: 6, borderBottomWidth: 1, paddingBottom: 6 },
  column: { width: 48, alignItems: 'center', minHeight: 180 },
  barSpace: { height: 134, justifyContent: 'flex-end', width: 26 },
  compactBarSpace: { width: '100%', maxWidth: 26 },
  compactAxis: { height: 24, marginTop: 8, position: 'relative' },
  tick: { position: 'absolute', fontSize: 10, textAlign: 'center' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  label: { fontSize: 10, textAlign: 'center', marginTop: 8, lineHeight: 14 },
  detail: { fontSize: 12, minHeight: 18, textAlign: 'center' },
});
