import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ActivityPeriodNavigatorProps {
  readonly formattedPeriodText: string;
  readonly canGoPrev: boolean;
  readonly canGoNext: boolean;
  readonly onPrevPeriod: () => void;
  readonly onNextPeriod: () => void;
}

export function ActivityPeriodNavigator({
  formattedPeriodText,
  canGoPrev,
  canGoNext,
  onPrevPeriod,
  onNextPeriod,
}: ActivityPeriodNavigatorProps) {
  const { fonts } = useAppTheme();

  return (
    <View style={styles.periodNavigatorRow}>
      <TouchableOpacity
        style={[styles.arrowButton, !canGoPrev && styles.arrowButtonDisabled]}
        onPress={onPrevPeriod}
        disabled={!canGoPrev}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Anterior"
      >
        <Ionicons
          name="chevron-back"
          size={22}
          color={canGoPrev ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)'}
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
        style={[styles.arrowButton, !canGoNext && styles.arrowButtonDisabled]}
        onPress={onNextPeriod}
        disabled={!canGoNext}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Siguiente"
      >
        <Ionicons
          name="chevron-forward"
          size={22}
          color={canGoNext ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
