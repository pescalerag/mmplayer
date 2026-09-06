import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type SpotlightStepKey = 'overview' | 'albums' | 'playlists' | 'artists' | 'folders' | 'tracks';

interface StepInfo {
    key: SpotlightStepKey;
    tabKey?: string;
    icon: keyof typeof Ionicons.glyphMap;
    titleKey: string;
    descKey: string;
    proTipKey: string;
}

const SPOTLIGHT_STEPS: StepInfo[] = [
    {
        key: 'overview',
        icon: 'refresh-circle',
        titleKey: 'steps.overview.title',
        descKey: 'steps.overview.p1_desc',
        proTipKey: 'steps.overview.tip',
    },
    {
        key: 'albums',
        tabKey: 'albums',
        icon: 'disc',
        titleKey: 'steps.albums.title',
        descKey: 'steps.albums.p1_desc',
        proTipKey: 'steps.albums.tip',
    },
    {
        key: 'playlists',
        tabKey: 'playlists',
        icon: 'list',
        titleKey: 'steps.playlists.title',
        descKey: 'steps.playlists.p1_desc',
        proTipKey: 'steps.playlists.tip',
    },
    {
        key: 'artists',
        tabKey: 'artists',
        icon: 'people',
        titleKey: 'steps.artists.title',
        descKey: 'steps.artists.p1_desc',
        proTipKey: 'steps.artists.tip',
    },
    {
        key: 'folders',
        tabKey: 'folders',
        icon: 'folder',
        titleKey: 'steps.folders.title',
        descKey: 'steps.folders.p1_desc',
        proTipKey: 'steps.folders.tip',
    },
    {
        key: 'tracks',
        tabKey: 'tracks',
        icon: 'musical-notes',
        titleKey: 'steps.tracks.title',
        descKey: 'steps.tracks.p1_desc',
        proTipKey: 'steps.tracks.tip',
    },
];

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ContextualSpotlightTutorialProps {
    visible: boolean;
    onClose: () => void;
    routes: Array<{ key: string; title: string }>;
    currentTabIndex: number;
    onSelectTab: (index: number) => void;
    bottomOffset: number;
    rootRef: React.RefObject<any>;
    headerToolsRef: React.RefObject<any>;
    tabRefs: React.MutableRefObject<{ [key: string]: any }>;
    tabsScrollViewRef?: React.RefObject<any>;
    tabLayouts?: React.MutableRefObject<{ [key: string]: Rect }>;
    headerHeight?: number;
    playlistSelectorRef?: React.RefObject<any>;
    artistSelectorRef?: React.RefObject<any>;
}

export default function ContextualSpotlightTutorial({
    visible,
    onClose,
    routes,
    currentTabIndex,
    onSelectTab,
    bottomOffset,
    rootRef,
    headerToolsRef,
    tabRefs,
    tabsScrollViewRef,
    tabLayouts,
    headerHeight = 130,
    playlistSelectorRef,
    artistSelectorRef,
}: ContextualSpotlightTutorialProps) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<Rect | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const pulseRingAnim = useRef(new Animated.Value(0.5)).current;

    // Smooth breathing opacity pulse on the spotlight border
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseRingAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseRingAnim, {
                    toValue: 0.5,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseRingAnim]);

    const measureTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    useEffect(() => {
        return () => {
            measureTimers.current.forEach(t => clearTimeout(t));
        };
    }, []);

    // Measure target element relative to root container to ensure 100% accurate positioning
    const measureCurrentTarget = useCallback((stepIdx: number) => {
        const step = SPOTLIGHT_STEPS[stepIdx];

        // Clear existing measurement timers
        measureTimers.current.forEach(t => clearTimeout(t));
        measureTimers.current = [];

        // 1. If it's a tab step, scroll horizontal tab bar so the tab is centered or visible
        let scrollTarget = 0;
        if (step.tabKey && tabLayouts?.current && tabLayouts.current[step.tabKey] && tabsScrollViewRef?.current) {
            const layout = tabLayouts.current[step.tabKey];
            scrollTarget = Math.max(0, layout.x - (SCREEN_WIDTH - layout.width) / 2);
            tabsScrollViewRef.current.scrollTo({ x: scrollTarget, animated: false });
        }

        // 2. Instant 0ms pre-calculated rects
        if (step.key === 'overview') {
            // Header tools (top-right buttons)
            setTargetRect({
                x: SCREEN_WIDTH - 20 - 152,
                y: insets.top + 10,
                width: 152,
                height: 44,
            });
        } else if (step.key === 'playlists' || step.key === 'artists') {
            // Focus on the sub-selector (Tus Playlists / Smart Playlists OR Intérpretes / Todos)
            const selW = Math.min(SCREEN_WIDTH - 40, 320);
            setTargetRect({
                x: Math.round((SCREEN_WIDTH - selW) / 2),
                y: Math.round((headerHeight || 130) + 20),
                width: selW,
                height: 42,
            });
        } else if (step.tabKey && tabLayouts?.current && tabLayouts.current[step.tabKey]) {
            // Instant initial placement for tab pills
            const layout = tabLayouts.current[step.tabKey];
            const tabScreenX = Math.round(layout.x - scrollTarget);
            setTargetRect({
                x: tabScreenX,
                y: Math.round(insets.top + 64),
                width: Math.round(layout.width),
                height: Math.round(layout.height || 36),
            });
        }

        // 3. Exact native measurement pass
        const executeMeasurement = () => {
            let targetEl: any = null;
            if (step.key === 'overview') {
                targetEl = headerToolsRef.current;
            } else if (step.key === 'playlists') {
                targetEl = playlistSelectorRef?.current;
            } else if (step.key === 'artists') {
                targetEl = artistSelectorRef?.current;
            } else if (step.tabKey) {
                targetEl = tabRefs.current[step.tabKey];
            }

            if (!targetEl || typeof targetEl.measureInWindow !== 'function') return;

            targetEl.measureInWindow((tx: number, ty: number, tw: number, th: number) => {
                if (tw <= 0 || th <= 0) return;
                if (rootRef?.current && typeof rootRef.current.measureInWindow === 'function') {
                    rootRef.current.measureInWindow((rx: number, ry: number) => {
                        setTargetRect({
                            x: Math.round(tx - rx),
                            y: Math.round(ty - ry),
                            width: Math.round(tw),
                            height: Math.round(th),
                        });
                    });
                } else {
                    setTargetRect({
                        x: Math.round(tx),
                        y: Math.round(ty),
                        width: Math.round(tw),
                        height: Math.round(th),
                    });
                }
            });
        };

        executeMeasurement();
        const t1 = setTimeout(executeMeasurement, 30);
        const t2 = setTimeout(executeMeasurement, 80);
        const t3 = setTimeout(executeMeasurement, 160);
        const t4 = setTimeout(executeMeasurement, 300);
        measureTimers.current = [t1, t2, t3, t4];
    }, [headerToolsRef, tabRefs, rootRef, tabsScrollViewRef, tabLayouts, insets.top, headerHeight, playlistSelectorRef, artistSelectorRef]);

    // When opened, reset to step 0
    useEffect(() => {
        if (visible) {
            setCurrentStepIndex(0);
            fadeAnim.setValue(1);
            measureCurrentTarget(0);
        }
    }, [visible, measureCurrentTarget, fadeAnim]);

    const goToStep = (nextIdx: number) => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
        }).start(() => {
            setCurrentStepIndex(nextIdx);
            const nextStep = SPOTLIGHT_STEPS[nextIdx];

            // If it's a tab step, switch the real TabView in LibraryScreen!
            if (nextStep.tabKey) {
                const targetRouteIndex = routes.findIndex(r => r.key === nextStep.tabKey);
                if (targetRouteIndex !== -1 && targetRouteIndex !== currentTabIndex) {
                    onSelectTab(targetRouteIndex);
                }
            }

            measureCurrentTarget(nextIdx);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 130,
                useNativeDriver: true,
            }).start();
        });
    };

    const handleNext = () => {
        if (currentStepIndex < SPOTLIGHT_STEPS.length - 1) {
            goToStep(currentStepIndex + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            goToStep(currentStepIndex - 1);
        }
    };

    if (!visible) return null;

    const currentStep = SPOTLIGHT_STEPS[currentStepIndex];
    const isLastStep = currentStepIndex === SPOTLIGHT_STEPS.length - 1;
    const isBottomCard = currentStep.key === 'playlists' || currentStep.key === 'artists';

    // Spotlight rect with comfortable padding
    const PADDING = 4;
    const HOLE_RADIUS = 18;
    const holeX = targetRect ? targetRect.x - PADDING : 20;
    const holeY = targetRect ? targetRect.y - PADDING : insets.top + 10;
    const holeW = targetRect ? targetRect.width + PADDING * 2 : 100;
    const holeH = targetRect ? targetRect.height + PADDING * 2 : 44;

    // Tooltip card positioning
    const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
    const holeCenterX = holeX + holeW / 2;

    // Center card horizontally on the target element, clamped within safe screen margins
    const idealCardLeft = holeCenterX - CARD_WIDTH / 2;
    const cardLeft = Math.max(16, Math.min(idealCardLeft, SCREEN_WIDTH - CARD_WIDTH - 16));

    // Arrow triangle position strictly aligned with the target hole's horizontal center
    const ARROW_HALF_WIDTH = 10;
    const rawArrowLeft = holeCenterX - cardLeft - ARROW_HALF_WIDTH;
    const arrowLeft = Math.max(18, Math.min(rawArrowLeft, CARD_WIDTH - 38));

    // Place tooltip directly below the target hole, or pinned to the bottom if isBottomCard
    const tooltipTop = holeY + holeH + 14;

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            {/* 1. Giant Border Technique for Pure Transparent Hole with 0-dependency dark mask */}
            <View
                style={[
                    styles.spotlightHole,
                    {
                        left: holeX - 2500,
                        top: holeY - 2500,
                        width: holeW + 5000,
                        height: holeH + 5000,
                        borderWidth: 2500,
                        borderRadius: 2500 + HOLE_RADIUS,
                    },
                ]}
                pointerEvents="auto"
            />

            {/* 2. Single Crisp Purple Border directly hugging the hole perimeter (no shadow bleed, no gap) */}
            <Animated.View
                style={[
                    styles.glowRing,
                    {
                        left: holeX,
                        top: holeY,
                        width: holeW,
                        height: holeH,
                        borderColor: colors.accent,
                        borderRadius: HOLE_RADIUS,
                        opacity: pulseRingAnim,
                    },
                ]}
                pointerEvents="none"
            />

            {/* 3. Contextual Tooltip Bubble with arrow pointing UP to target */}
            <Animated.View
                style={[
                    styles.tooltipCard,
                    isBottomCard
                        ? {
                            left: cardLeft,
                            bottom: bottomOffset + 12,
                            width: CARD_WIDTH,
                            opacity: fadeAnim,
                            borderColor: colors.accentAlpha30,
                        }
                        : {
                            left: cardLeft,
                            top: tooltipTop,
                            width: CARD_WIDTH,
                            opacity: fadeAnim,
                            borderColor: colors.accentAlpha30,
                        },
                ]}
            >
                {/* Arrow pointing directly into the target hole */}
                <View
                    style={[
                        styles.arrowUp,
                        {
                            left: arrowLeft,
                            borderBottomColor: '#1C1C22',
                        },
                    ]}
                />

                {/* Tooltip Header: Step Pill & Close */}
                <View style={styles.tooltipHeader}>
                    <View style={[styles.stepPill, { backgroundColor: colors.accentAlpha20 }]}>
                        <Ionicons name={currentStep.icon} size={15} color={colors.accent} style={{ marginRight: 6 }} />
                        <Text style={[styles.stepPillText, { color: colors.accent }]}>
                            {t('common.step_indicator', { current: currentStepIndex + 1, total: SPOTLIGHT_STEPS.length, defaultValue: `PASO ${currentStepIndex + 1} DE ${SPOTLIGHT_STEPS.length}` })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Ionicons name="close" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                {/* Tooltip Title & Description in Bold readable fonts */}
                <Text style={styles.tooltipTitle}>
                    {t(`library_tutorial.${currentStep.titleKey}`)}
                </Text>
                <Text style={styles.tooltipDesc}>
                    {t(`library_tutorial.${currentStep.descKey}`)}
                </Text>

                {/* Pro Tip Highlight */}
                <View style={styles.tipRow}>
                    <Text style={styles.tipText}>
                        {t(`library_tutorial.${currentStep.proTipKey}`)}
                    </Text>
                </View>

                {/* Controls: Prev, Dots, Next */}
                <View style={styles.tooltipFooter}>
                    {currentStepIndex > 0 ? (
                        <TouchableOpacity
                            onPress={handlePrev}
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="chevron-back" size={16} color="#D1D5DB" style={{ marginRight: 3 }} />
                            <Text style={styles.secondaryBtnText}>
                                {t('library_tutorial.prev')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.secondaryBtnText}>
                                {t('library_tutorial.skip')}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Step dots */}
                    <View style={styles.dotsRow}>
                        {SPOTLIGHT_STEPS.map((_, idx) => (
                            <View
                                key={idx}
                                style={[
                                    styles.dot,
                                    idx === currentStepIndex && [styles.dotActive, { backgroundColor: colors.accent }],
                                ]}
                            />
                        ))}
                    </View>

                    {/* Next / Finish button */}
                    <TouchableOpacity
                        onPress={handleNext}
                        style={[
                            styles.primaryBtn,
                            { backgroundColor: colors.accent },
                        ]}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                            {isLastStep
                                ? t('library_tutorial.finish')
                                : t('library_tutorial.next')}
                        </Text>
                        <Ionicons
                            name={isLastStep ? 'checkmark' : 'chevron-forward'}
                            size={16}
                            color={colors.onAccent}
                            style={{ marginLeft: 3 }}
                        />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
    },
    spotlightHole: {
        position: 'absolute',
        borderColor: 'rgba(0, 0, 0, 0.78)',
        backgroundColor: 'transparent',
    },
    glowRing: {
        position: 'absolute',
        borderWidth: 2,
    },
    tooltipCard: {
        position: 'absolute',
        backgroundColor: '#1C1C22',
        borderRadius: 20,
        borderWidth: 1.5,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 14,
    },
    arrowUp: {
        position: 'absolute',
        top: -10,
        width: 0,
        height: 0,
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderBottomWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    tooltipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    stepPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    stepPillText: {
        fontSize: 11.5,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tooltipTitle: {
        fontSize: 17,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    tooltipDesc: {
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#E5E7EB',
        lineHeight: 20,
        marginBottom: 10,
    },
    tipRow: {
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.25)',
        marginBottom: 12,
    },
    tipText: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FEF3C7',
        lineHeight: 16,
    },
    tooltipFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    secondaryBtnText: {
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        color: '#D1D5DB',
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    dotActive: {
        width: 16,
        borderRadius: 4,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        paddingHorizontal: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    primaryBtnText: {
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '900',
    },
});
