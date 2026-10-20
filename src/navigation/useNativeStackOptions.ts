import { useMemo } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useAppTheme } from '../hooks/useAppTheme';

/** Keep ordinary native scenes opaque throughout both sides of a transition. */
export function useNativeStackOptions(): NativeStackNavigationOptions {
    const { colors } = useAppTheme();
    return useMemo(() => ({
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        freezeOnBlur: false,
    }), [colors.background]);
}
