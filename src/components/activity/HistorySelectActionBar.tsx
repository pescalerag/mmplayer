import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from 'react-i18next';

interface HistorySelectActionBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onDelete: () => void;
}

export function HistorySelectActionBar({
    selectedCount,
    onClearSelection,
    onDelete,
}: HistorySelectActionBarProps) {
    const { colors, fonts, fontWeights } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    const isSelectionMode = selectedCount > 0;
    const translateY = useRef(new Animated.Value(-150)).current;
    const [mounted, setMounted] = useState(isSelectionMode);

    useEffect(() => {
        if (isSelectionMode) {
            setMounted(true);
            Animated.spring(translateY, {
                toValue: 0,
                tension: 60,
                friction: 10,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: -150,
                duration: 250,
                useNativeDriver: true,
            }).start(() => {
                setMounted(false);
            });
        }
    }, [isSelectionMode]);

    if (!mounted && !isSelectionMode) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.cardBackground,
                    transform: [{ translateY }],
                    top: insets.top + 10,
                },
            ]}
        >
            <View style={styles.infoRow}>
                <TouchableOpacity onPress={onClearSelection} style={styles.closeBtn} activeOpacity={0.7}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text
                    style={[
                        styles.countText,
                        { color: colors.text, fontFamily: fonts.regular, fontWeight: fontWeights.bold },
                    ]}
                >
                    {t('actions.selected_count', { count: selectedCount })}
                </Text>
            </View>

            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.heartIcon }]}
                    onPress={onDelete}
                    activeOpacity={0.7}
                    accessibilityLabel={t('activity.history_delete_selected') || 'Eliminar'}
                >
                    <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#333',
        zIndex: 9999,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    closeBtn: {
        marginRight: 12,
        padding: 4,
    },
    countText: {
        fontSize: 16,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
    },
});
