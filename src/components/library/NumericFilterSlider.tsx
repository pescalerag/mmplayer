import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';

export function NumericFilterSlider({ label, value, minimum = 0, maximum, step = 1, expandable = true, expandEarlier = false, onChange }: Readonly<{
  label: string; value: number | null; minimum?: number; maximum: number; step?: number; expandable?: boolean; expandEarlier?: boolean; onChange: (value: number | null) => void;
}>) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  const [limits, setLimits] = useState({ min: minimum, max: maximum });
  const min = Math.min(minimum, limits.min, value ?? minimum);
  const max = Math.max(maximum, limits.max, value ?? maximum);
  const current = value ?? min;
  const adjust = (delta: number) => onChange(Number(Math.max(min, Math.min(max, current + delta)).toFixed(2)));
  return <View style={{ gap: 6 }}>
    <View style={styles.row}>
      <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.regular }}>{label}</Text>
      <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>{value === null ? t('album_filters.unlimited') : value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
      {value !== null && <TouchableOpacity accessibilityLabel={`${label}: ${t('album_filters.unlimited')}`} onPress={() => onChange(null)} hitSlop={8}><Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} /></TouchableOpacity>}
    </View>
    <View style={styles.row}>
      <TouchableOpacity accessibilityLabel={`${label}: −`} style={styles.adjust} onPress={() => adjust(-step)}><Ionicons name="remove" size={20} color={colors.textSecondary} /></TouchableOpacity>
      <Slider style={{ flex: 1, height: 40 }} minimumValue={min} maximumValue={max} step={step} value={current}
        onValueChange={number => onChange(Number(number.toFixed(2)))} accessibilityLabel={label}
        minimumTrackTintColor={value === null ? colors.textSecondary : colors.accent} maximumTrackTintColor={colors.cardBackground} thumbTintColor={value === null ? colors.textSecondary : colors.accent} />
      <TouchableOpacity accessibilityLabel={`${label}: +`} style={styles.adjust} onPress={() => adjust(step)}><Ionicons name="add" size={20} color={colors.textSecondary} /></TouchableOpacity>
    </View>
    {expandable && <TouchableOpacity onPress={() => setLimits({ min: expandEarlier ? Math.max(1, min - 100) : min, max: expandEarlier ? max : Math.min(Number.MAX_SAFE_INTEGER, max * 2) })} accessibilityLabel={`${label}: ${t(expandEarlier ? 'filter_controls.earlier_years' : 'filter_controls.expand')}`}><Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12 }}>{t(expandEarlier ? 'filter_controls.earlier_years' : 'filter_controls.expand', { max: max.toLocaleString() })}</Text></TouchableOpacity>}
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, adjust: { padding: 8 } });
