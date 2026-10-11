import React, { useRef } from 'react';
import { View } from 'react-native';
import { useArtistChartPeriod } from '../../../hooks/useArtistChartPeriod';
import { ChartMetric } from '../../../utils/activityCharts';
import { openCustomDateModal } from '../../../store/useCustomDateModalStore';
import { ActivityPeriodTabs } from '../ActivityPeriodTabs';
import { ActivityPeriodNavigator } from '../ActivityPeriodNavigator';
import { ActivityControlsRow } from '../ActivityControlsRow';

interface Props {
  readonly navigation: ReturnType<typeof useArtistChartPeriod>;
  readonly metric: ChartMetric;
  readonly onMetricChange: (metric: ChartMetric) => void;
}

export function ArtistChartControls({ navigation, metric, onMetricChange }: Props) {
  const tabsRef = useRef<View>(null);
  const tabsLayout = useRef(null);
  const metricRef = useRef<View>(null);
  const metricLayout = useRef(null);
  const range = navigation.dateRangeInfo;
  const openDates = () => openCustomDateModal({ initialStartDate: navigation.customFrom, initialEndDate: navigation.customTo, onApply: navigation.applyCustomRange });
  return (
    <>
      <ActivityPeriodTabs period={navigation.period} onPeriodChange={navigation.changePeriod} periodTabsRef={tabsRef} periodTabsLayout={tabsLayout} />
      <ActivityPeriodNavigator formattedPeriodText={range.label} canGoPrev={range.canGoPrev} canGoNext={range.canGoNext} onPrevPeriod={navigation.previous} onNextPeriod={navigation.next} />
      <ActivityControlsRow period={navigation.period} metric={metric} onMetricChange={onMetricChange} onOpenCustomDate={openDates} metricToggleRef={metricRef} metricToggleLayout={metricLayout} />
    </>
  );
}
