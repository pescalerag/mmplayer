import { useAppTheme } from "@/hooks/useAppTheme";
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStore } from '../store/useSyncStore';

export default function GlobalSyncIndicator() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const isScanning = useSyncStore(state => state.isScanning);
    const isSilentScan = useSyncStore(state => state.isSilentScan);
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-100)).current;
    const { t } = useTranslation();

    const shouldShow = isScanning && !isSilentScan;

    useEffect(() => {
        if (shouldShow) {
            Animated.spring(translateY, {
                toValue: insets.top > 0 ? insets.top + 10 : 40,
                useNativeDriver: true,
                tension: 40,
                friction: 5,
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [shouldShow, insets.top, translateY]);

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY }] }]} pointerEvents="none">
            <View style={styles.island}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.text}>{t('toasts.syncing')}</Text>
            </View>
        </Animated.View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    island: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#121212',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1,
        borderColor: colors.cardBackground,
    },
    text: {
        color: colors.text,
        marginLeft: 10,
        fontFamily: fonts.regular,
        fontSize: 13,
        fontWeight: '700',
    }
});
