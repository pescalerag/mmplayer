import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    BackHandler,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeAction, useSettingsStore } from '../store/useSettingsStore';
import { useSwipeActionSheetStore } from '../store/useSwipeActionSheetStore';

const { height } = Dimensions.get('window');

export default function SwipeActionSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const { isVisible, currentSwipeTarget, closeSheet } = useSwipeActionSheetStore();
    const { swipeLeftAction, setSwipeLeftAction, swipeRightAction, setSwipeRightAction } = useSettingsStore();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true })
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => { closeSheet(); return true; };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeSheet]);

    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender && !isVisible) return null;

    const swipeOptions: { label: string, value: SwipeAction, icon: any }[] = [
        { label: t('settings.swipe_action_add_next'), value: 'add_next', icon: 'return-down-forward' },
        { label: t('settings.swipe_action_add_last'), value: 'add_last', icon: 'list' },
        { label: t('actions.add_to_playlist'), value: 'add_to_playlist', icon: 'add-circle-outline' },
        { label: t('settings.swipe_action_toggle_favorite'), value: 'toggle_favorite', icon: 'heart' },
        { label: t('settings.swipe_action_none'), value: 'none', icon: 'close' },
    ];

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <TouchableWithoutFeedback onPress={closeSheet}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View style={[
                styles.sheetContainer,
                {
                    paddingBottom: insets.bottom + 20,
                    transform: [{ translateY: slideAnim }]
                }
            ]}>
                <View style={styles.dragIndicator} />

                <View style={styles.header}>
                    <Text style={styles.headerTitle}>
                        {currentSwipeTarget === 'left' ? t('settings.swipe_left') : t('settings.swipe_right')}
                    </Text>
                </View>

                <View style={styles.contentContainer}>
                    {swipeOptions.map((option) => {
                        const isSelected = currentSwipeTarget === 'left' ? swipeLeftAction === option.value : swipeRightAction === option.value;
                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={styles.optionButton}
                                onPress={() => {
                                    if (currentSwipeTarget === 'left') setSwipeLeftAction(option.value);
                                    else if (currentSwipeTarget === 'right') setSwipeRightAction(option.value);
                                    closeSheet();
                                }}
                            >
                                <View style={styles.optionLeft}>
                                    <Ionicons name={option.icon} size={24} color={isSelected ? colors.accent : colors.text} />
                                    <Text style={[styles.optionText, isSelected && { color: colors.accent }]}>
                                        {option.label}
                                    </Text>
                                </View>
                                {isSelected && <Ionicons name="checkmark" size={24} color={colors.accent} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheetContainer: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: colors.cardBackground,
        overflow: 'hidden',
        paddingHorizontal: 24,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#2E2E2E',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 14,
        marginBottom: 16,
    },
    header: {
        marginBottom: 20,
        paddingBottom: 15,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 18,
        fontFamily: fonts.regular,
        fontWeight: '800',
        textAlign: 'center',
    },
    contentContainer: {
        marginBottom: 10,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    optionText: {
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '600',
        color: colors.text,
    },
});
