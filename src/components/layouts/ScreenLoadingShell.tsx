import React, { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeaderLayout } from './ScreenHeaderLayout';
import { useAppTheme } from '../../hooks/useAppTheme';

const ScreenReadyContext = createContext<() => void>(() => {});

export function useScreenReady() {
    const ready = useContext(ScreenReadyContext);
    useLayoutEffect(ready, [ready]);
}

// Keep the initial shell outside metadata observers. Once ready, song changes
// retain the existing player UI until its complete metadata arrives.
export function ScreenLoadingFrame({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
    const { colors } = useAppTheme();
    const [ready, setReady] = useState(false);
    const markReady = useCallback(() => { setReady(true); }, []);
    return (
        <View collapsable={false} style={{ flex: 1, backgroundColor: colors.background }}>
            {!ready && <ScreenLoadingShell title={title} />}
            <View collapsable={false} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <ScreenReadyContext.Provider value={markReady}>{children}</ScreenReadyContext.Provider>
            </View>
        </View>
    );
}

export function ScreenLoadingShell({ title = '', titleKey }: Readonly<{ title?: string; titleKey?: string }>) {
    const { t } = useTranslation();
    return (
        <ScreenHeaderLayout title={titleKey ? t(titleKey) : title}>
            {() => <View style={{ flex: 1 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
        </ScreenHeaderLayout>
    );
}
