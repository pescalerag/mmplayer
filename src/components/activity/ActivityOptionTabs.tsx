import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { ActivityOption } from '../../screens/activity/utils/activityStatUtils';

const OPTIONS: ActivityOption[] = ['highlights', 'songs', 'albums', 'artists'];

interface ActivityOptionTabsProps {
  readonly activeOption: ActivityOption;
  readonly onSelectOption: (option: ActivityOption) => void;
  readonly highlightsCardRef: React.RefObject<any>;
  readonly highlightsCardLayout: React.RefObject<any>;
}

export function ActivityOptionTabs({
  activeOption,
  onSelectOption,
  highlightsCardRef,
  highlightsCardLayout,
}: ActivityOptionTabsProps) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();

  const handleLayout = (e: LayoutChangeEvent) => {
    if (e?.nativeEvent?.layout) {
      highlightsCardLayout.current = e.nativeEvent.layout;
    }
  };

  return (
    <View ref={highlightsCardRef} onLayout={handleLayout} style={styles.optionTabsRow}>
      {OPTIONS.map((opt) => {
        const isActive = opt === activeOption;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelectOption(opt)}
            activeOpacity={0.75}
            style={[styles.optionTab, isActive && { borderBottomColor: colors.accent }]}
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
  );
}

const styles = StyleSheet.create({
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
});
