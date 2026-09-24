import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../../store/useToastStore';

export default function GlobalToast() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const { visible, message, icon, color, action } = useToastStore();
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: insets.top > 0 ? insets.top + 10 : 40,
                    useNativeDriver: true,
                    tension: 40,
                    friction: 5,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: -100,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [visible, insets.top, translateY, opacity]);

    return (
        <Animated.View
            style={[styles.container, { transform: [{ translateY }], opacity }]}
            pointerEvents={visible && action ? 'box-none' : 'none'}
        >
            <View
                style={[
                    styles.island,
                    color && color !== '#22C55E' ? { borderColor: `${color}40` } : undefined
                ]}
                pointerEvents="auto"
            >
                <Ionicons name={icon as any} size={20} color={color} />
                <Text style={styles.text} numberOfLines={2}>{message}</Text>
                {action && (
                    <TouchableOpacity
                        onPress={() => {
                            action.onPress();
                            useToastStore.getState().hideToast();
                        }}
                        style={styles.actionButton}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                    >
                        <Text style={[styles.actionText, { color: action.color || colors.accentLight || colors.accent }]}>
                            {action.text}
                        </Text>
                    </TouchableOpacity>
                )}
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
        zIndex: 999999,
        elevation: 999999,
    },
    island: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#333',
        maxWidth: '92%',
    },
    text: {
        color: colors.text,
        marginLeft: 8,
        fontFamily: fonts.regular,
        fontSize: 14,
        fontWeight: '700',
        flexShrink: 1,
    },
    actionButton: {
        marginLeft: 12,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
        flexShrink: 0,
    },
    actionText: {
        fontFamily: fonts.bold,
        fontSize: 14,
        fontWeight: '800',
    },
});
