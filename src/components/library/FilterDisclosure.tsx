import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';

export function FilterDisclosure({ title, summary, active = false, children }: Readonly<{ title: string; summary?: string; active?: boolean; children: React.ReactNode }>) {
  const { colors, fonts } = useAppTheme();
  const [open, setOpen] = useState(active);
  return <View style={[styles.container, { borderColor: colors.cardBackground }]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={styles.header}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: active ? colors.accent : colors.text, fontFamily: fonts.bold }}>{title}</Text>
        {!!summary && <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{summary}</Text>}
      </View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
    </TouchableOpacity>
    {open && <View style={styles.content}>{children}</View>}
  </View>;
}
const styles = StyleSheet.create({ container: { borderBottomWidth: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }, content: { gap: 14, paddingBottom: 16 } });
