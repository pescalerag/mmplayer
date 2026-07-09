import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SwipeAction, useSettingsStore } from '../../store/useSettingsStore';
import { useSheetProps } from '@/hooks/useSheetProps';

export default function SwipeActionSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { props: { target: currentSwipeTarget }, close: closeSheet } = useSheetProps<{ target: 'left' | 'right' }>('swipe-action');
  const { swipeLeftAction, setSwipeLeftAction, swipeRightAction, setSwipeRightAction } = useSettingsStore();
  const { t } = useTranslation();

  const swipeOptions: { label: string, value: SwipeAction, icon: any }[] = [
    { label: t('settings.swipe_action_add_next'), value: 'add_next', icon: 'return-down-forward' },
    { label: t('settings.swipe_action_add_last'), value: 'add_last', icon: 'list' },
    { label: t('actions.add_to_playlist'), value: 'add_to_playlist', icon: 'add-circle-outline' },
    { label: t('settings.swipe_action_toggle_favorite'), value: 'toggle_favorite', icon: 'heart' },
    { label: t('settings.swipe_action_none'), value: 'none', icon: 'close' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {currentSwipeTarget === 'left' ? t('settings.swipe_left') : t('settings.swipe_right')}
        </Text>
      </View>

      <View style={styles.contentContainer}>
        {swipeOptions.map((option) => {
          const isSelected = currentSwipeTarget === 'left' ? swipeLeftAction === option.value : swipeRightAction === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={styles.optionButton}
              onPress={() => {
                if (currentSwipeTarget === 'left') setSwipeLeftAction(option.value);
                else if (currentSwipeTarget === 'right') setSwipeRightAction(option.value);
                closeSheet();
              }}
            >
              <View style={styles.optionLeft}>
                <Ionicons name={option.icon} size={24} color={isSelected ? colors.accent : colors.text} />
                <Text style={[styles.optionText, isSelected && { color: colors.accent }]}>
                  {option.label}
                </Text>
              </View>
              {isSelected && <Ionicons name="checkmark" size={24} color={colors.accent} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.regular,
    fontWeight: '800',
    textAlign: 'center',
  },
  contentContainer: {
    marginBottom: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: '600',
    color: colors.text,
  },
});
