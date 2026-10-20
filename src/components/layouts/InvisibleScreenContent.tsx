import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

/** Reserve the real screen's space while it loads, without a provisional header. */
export function InvisibleScreenContent({ ready = false, children }: Readonly<{ ready?: boolean; children?: React.ReactNode }>) {
    const { colors } = useAppTheme();
    return (
        <View collapsable={false} style={[styles.fill, { backgroundColor: colors.background }]}>
            <View collapsable={false} style={[styles.fill, !ready && styles.hidden]} pointerEvents={ready ? 'auto' : 'none'}
                accessibilityElementsHidden={!ready} importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({ fill: { flex: 1 }, hidden: { opacity: 0 } });
