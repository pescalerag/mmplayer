import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';

interface PreviewOption<T extends string> {
    id: T;
    nameKey: string;
    colors: readonly [string, string, string];
    accent: string;
    isVipOnly?: boolean;
}

export default function ThemePreviewPicker<T extends string>({ kind, options, value, onSelect, isVip = true }: Readonly<{
    kind: 'stats' | 'localcast';
    options: readonly PreviewOption<T>[];
    value: T;
    onSelect: (id: T) => void;
    isVip?: boolean;
}>) {
    const { colors, fonts } = useAppTheme();
    const { t } = useTranslation();
    return <ScrollView nestedScrollEnabled horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map(option => {
            const selected = value === option.id;
            const locked = !!option.isVipOnly && !isVip;
            return <TouchableOpacity key={option.id} style={styles.option} onPress={() => onSelect(option.id)}
                accessibilityRole="radio" accessibilityLabel={t(option.nameKey)} accessibilityState={{ checked: selected, disabled: locked }} disabled={locked}>
                <LinearGradient colors={option.colors} style={[styles.preview, { borderColor: selected ? colors.accent : colors.border }]}>
                    {kind === 'stats' ? <>
                        <View style={[styles.badge, { backgroundColor: option.accent }]}><Text style={styles.badgeText}>STATS</Text></View>
                        <View style={styles.circles}>{[0, 1, 2].map(id => <View key={id} style={[styles.circle, { borderColor: option.accent }]} />)}</View>
                        <View style={[styles.line, { backgroundColor: option.accent }]} />
                    </> : <>
                        <View style={styles.playerRow}>
                            <View style={[styles.cover, { backgroundColor: option.accent }]} />
                            <View style={{ flex: 1, gap: 6 }}><View style={[styles.line, { backgroundColor: '#FFFFFF' }]} /><View style={[styles.line, { backgroundColor: option.accent, width: '65%' }]} /></View>
                        </View>
                        <View style={[styles.line, { backgroundColor: '#FFFFFF', marginTop: 16 }]} />
                        <Ionicons name={option.id === 'custom' ? 'color-palette' : 'play-circle'} size={22} color={option.accent} style={{ alignSelf: 'center', marginTop: 8 }} />
                    </>}
                    {(locked || selected) && <View style={[styles.indicator, { backgroundColor: colors.cardBackground }]}><Ionicons name={locked ? 'lock-closed' : 'checkmark'} size={15} color={colors.text} /></View>}
                </LinearGradient>
                <Text numberOfLines={2} style={{ color: selected ? colors.accent : colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' }}>{t(option.nameKey)}</Text>
            </TouchableOpacity>;
        })}
    </ScrollView>;
}

const styles = StyleSheet.create({
    row: { gap: 12, paddingVertical: 8 },
    option: { width: 112, gap: 7 },
    preview: { width: 112, height: 112, borderRadius: 14, borderWidth: 2, padding: 12, justifyContent: 'center' },
    badge: { alignSelf: 'center', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
    badgeText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
    circles: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginVertical: 12 },
    circle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1 },
    line: { height: 4, borderRadius: 2, width: '100%' },
    playerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    cover: { width: 30, height: 30, borderRadius: 5 },
    indicator: { position: 'absolute', right: 4, top: 4, borderRadius: 10, padding: 3 },
});
