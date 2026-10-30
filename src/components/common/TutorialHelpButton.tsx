import React from 'react';
import { Platform, StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';

export interface TutorialHelpButtonProps {
    onPress: () => void;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
    size?: number;
    disabled?: boolean;
    color?: string;
    hitSlop?: { top: number; bottom: number; left: number; right: number };
}

export const TutorialHelpButton: React.FC<TutorialHelpButtonProps> = ({
    onPress,
    accessibilityLabel,
    style,
    size = 20,
    disabled = false,
    color,
    hitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
}) => {
    const { colors } = useAppTheme();

    if (Platform.OS === 'web') {
        return null;
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            style={style}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityLabel={accessibilityLabel}
            hitSlop={hitSlop}
        >
            <Ionicons
                name="help-circle-outline"
                size={size}
                color={color ?? colors.text}
            />
        </TouchableOpacity>
    );
};

export default TutorialHelpButton;

