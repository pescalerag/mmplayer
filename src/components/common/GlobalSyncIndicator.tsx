import { useAppTheme } from "@/hooks/useAppTheme";
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { useSyncStore } from '../../store/useSyncStore';

export default function GlobalSyncIndicator() {
    const { colors } = useAppTheme();
    const isScanning = useSyncStore(state => state.isScanning);
    const isSilentScan = useSyncStore(state => state.isSilentScan);
    const translateX = useRef(new Animated.Value(-44)).current;
    const { t } = useTranslation();

    const shouldShow = isScanning && !isSilentScan;
    const [visible, setVisible] = useState(shouldShow);

    useEffect(() => {
        if (shouldShow) setVisible(true);
        const animation = Animated.timing(translateX, {
            toValue: shouldShow ? 0 : -44,
            duration: 200,
            useNativeDriver: true,
        });
        animation.start(({ finished }) => {
            if (finished && !shouldShow) setVisible(false);
        });
        return () => animation.stop();
    }, [shouldShow, translateX]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, { backgroundColor: colors.cardBackground,
            borderColor: colors.overlayAlpha20, transform: [{ translateX }] }]} pointerEvents="none"
            accessible accessibilityRole="progressbar" accessibilityLabel={t('toasts.syncing')}
            importantForAccessibility={shouldShow ? 'yes' : 'no-hide-descendants'}>
            <ActivityIndicator size="small" color={colors.accent} accessible={false} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: '30%',
        marginTop: -26,
        left: -24,
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingRight: 4,
        borderWidth: 1,
        zIndex: 9999,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    }
});
