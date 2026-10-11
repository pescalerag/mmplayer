import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { ChartBucket, ChartMetric, getChartValues, getClockSegmentPath } from '../../../utils/activityCharts';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { ActivityChartCard } from './ActivityChartCard';

interface Props {
  readonly hours: readonly ChartBucket[];
  readonly metric: ChartMetric;
}

export function ActivityListeningClock({ hours, metric }: Props) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState(0);
  const values = getChartValues(hours, metric, false);
  const max = Math.max(0, ...values);
  const unit = metric === 'duration' ? t('activity.min_suffix') : t('activity.plays');
  const hourLabel = `${String(selected).padStart(2, '0')}:00–${String(selected).padStart(2, '0')}:59`;
  const value = (values[selected] ?? 0).toLocaleString(t('activity.locale_code'), { maximumFractionDigits: 1 });

  return (
    <ActivityChartCard title={t('activity.charts.listening_clock')}>
      <View style={styles.clock}>
        <Svg width="100%" height={260} viewBox="0 0 240 240">
          <Circle cx={120} cy={120} r={98} stroke={colors.overlayAlpha08} strokeWidth={1} fill="none" />
          {hours.map((hour, index) => (
            <React.Fragment key={hour.key}>
              <Path
                d={getClockSegmentPath(hour.key, 1, 1)}
                fill={selected === index ? colors.accentAlpha15 : colors.overlayAlpha05}
                accessible
                accessibilityLabel={`${String(hour.key).padStart(2, '0')}:00: ${values[index].toLocaleString(t('activity.locale_code'), { maximumFractionDigits: 1 })} ${unit}`}
                onPress={() => setSelected(index)}
              />
              <Path d={getClockSegmentPath(hour.key, values[index], max)} fill={selected === index ? colors.accentLight : colors.accent} onPress={() => setSelected(index)} />
            </React.Fragment>
          ))}
          <SvgText x={120} y={14} fill={colors.textSecondary} fontSize={11} textAnchor="middle">00</SvgText>
          <SvgText x={228} y={124} fill={colors.textSecondary} fontSize={11} textAnchor="middle">06</SvgText>
          <SvgText x={120} y={235} fill={colors.textSecondary} fontSize={11} textAnchor="middle">12</SvgText>
          <SvgText x={12} y={124} fill={colors.textSecondary} fontSize={11} textAnchor="middle">18</SvgText>
          <SvgText x={120} y={108} fill={colors.text} fontSize={18} fontWeight="bold" textAnchor="middle">{value}</SvgText>
          <SvgText x={120} y={125} fill={colors.textSecondary} fontSize={11} textAnchor="middle">{unit}</SvgText>
          <SvgText x={120} y={145} fill={colors.textSecondary} fontSize={10} textAnchor="middle">{hourLabel}</SvgText>
        </Svg>
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
        {t('activity.charts.hour_detail', { hour: hourLabel, value, unit })}
      </Text>
      <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('activity.charts.clock_hint')}</Text>
    </ActivityChartCard>
  );
}

const styles = StyleSheet.create({
  clock: { width: '100%', maxWidth: 320, alignSelf: 'center' },
  detail: { fontSize: 13, textAlign: 'center' },
  hint: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
