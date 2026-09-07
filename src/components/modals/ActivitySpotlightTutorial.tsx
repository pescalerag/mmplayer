import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ActivitySpotlightStepKey =
    | 'period_selector'
    | 'metric_toggle'
    | 'hero_summary'
    | 'highlights_and_tabs'
    | 'smart_lists'
    | 'share_stats';

interface StepInfo {
    key: ActivitySpotlightStepKey;
    icon: keyof typeof Ionicons.glyphMap;
    titleKey: string;
    descKey: string;
    proTipKey: string;
}

const ACTIVITY_SPOTLIGHT_STEPS: StepInfo[] = [
    {
        key: 'period_selector',
        icon: 'calendar-outline',
        titleKey: 'steps.period_selector.title',
        descKey: 'steps.period_selector.desc',
        proTipKey: 'steps.period_selector.tip',
    },
    {
        key: 'metric_toggle',
        icon: 'swap-horizontal-outline',
        titleKey: 'steps.metric_toggle.title',
        descKey: 'steps.metric_toggle.desc',
        proTipKey: 'steps.metric_toggle.tip',
    },
    {
        key: 'hero_summary',
        icon: 'analytics-outline',
        titleKey: 'steps.hero_summary.title',
        descKey: 'steps.hero_summary.desc',
        proTipKey: 'steps.hero_summary.tip',
    },
    {
        key: 'highlights_and_tabs',
        icon: 'trophy-outline',
        titleKey: 'steps.highlights_and_tabs.title',
        descKey: 'steps.highlights_and_tabs.desc',
        proTipKey: 'steps.highlights_and_tabs.tip',
    },
    {
        key: 'smart_lists',
        icon: 'musical-notes-outline',
        titleKey: 'steps.smart_lists.title',
        descKey: 'steps.smart_lists.desc',
        proTipKey: 'steps.smart_lists.tip',
    },
    {
        key: 'share_stats',
        icon: 'share-social-outline',
        titleKey: 'steps.share_stats.title',
        descKey: 'steps.share_stats.desc',
        proTipKey: 'steps.share_stats.tip',
    },
];

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ActivitySpotlightTutorialProps {
    visible: boolean;
    onClose: () => void;
    rootRef?: React.RefObject<any>;
    scrollViewRef?: React.RefObject<any>;
    periodTabsRef?: React.RefObject<any>;
    metricToggleRef?: React.RefObject<any>;
    heroCardRef?: React.RefObject<any>;
    highlightsCardRef?: React.RefObject<any>;
    smartListsRef?: React.RefObject<any>;
    shareButtonRef?: React.RefObject<any>;

    periodTabsLayout?: React.MutableRefObject<any>;
    metricToggleLayout?: React.MutableRefObject<any>;
    heroCardLayout?: React.MutableRefObject<any>;
    highlightsCardLayout?: React.MutableRefObject<any>;
    smartListsLayout?: React.MutableRefObject<any>;
    shareButtonLayout?: React.MutableRefObject<any>;
}

export default function ActivitySpotlightTutorial({
    visible,
    onClose,
    rootRef,
    scrollViewRef,
    periodTabsRef,
    metricToggleRef,
    heroCardRef,
    highlightsCardRef,
    smartListsRef,
    shareButtonRef,
    periodTabsLayout,
    metricToggleLayout,
    heroCardLayout,
    highlightsCardLayout,
    smartListsLayout,
    shareButtonLayout,
}: ActivitySpotlightTutorialProps) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<Rect | null>(null);
    const [currentRadius, setCurrentRadius] = useState(14);
    const [cardHeight, setCardHeight] = useState(230);

    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const pulseRingAnim = useRef(new Animated.Value(0.5)).current;

    // Smooth breathing opacity pulse on spotlight border
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
            measureTimers.current.forEach(tm => clearTimeout(tm));
        };
    }, []);

    // Measure target element relative to root container
    const measureCurrentTarget = useCallback((stepIdx: number) => {
        const step = ACTIVITY_SPOTLIGHT_STEPS[stepIdx];

        measureTimers.current.forEach(tm => clearTimeout(tm));
        measureTimers.current = [];

        // Scroll view positioning for off-screen items
        if (step.key === 'smart_lists') {
            scrollViewRef?.current?.scrollTo?.({ y: 320, animated: true });
        } else if (step.key === 'hero_summary' || step.key === 'period_selector' || step.key === 'share_stats') {
            scrollViewRef?.current?.scrollTo?.({ y: 0, animated: true });
        }

        // 1. Dynamic pre-calculated rects for instant 0ms feedback
        let calculatedRect: Rect = { x: 20, y: 100, width: SCREEN_WIDTH - 40, height: 50 };
        let radius = 14;

        if (step.key === 'period_selector') {
            const w = periodTabsLayout?.current?.width || (SCREEN_WIDTH - 32);
            const h = periodTabsLayout?.current?.height || 44;
            const x = periodTabsLayout?.current?.x !== undefined ? periodTabsLayout.current.x : 16;
            const y = insets.top + 56;
            calculatedRect = { x, y, width: w, height: h };
            radius = 12;
        } else if (step.key === 'metric_toggle') {
            const w = metricToggleLayout?.current?.width || (SCREEN_WIDTH - 32);
            const h = metricToggleLayout?.current?.height || 42;
            const x = metricToggleLayout?.current?.x !== undefined ? metricToggleLayout.current.x : 16;
            const y = insets.top + 106;
            calculatedRect = { x, y, width: w, height: h };
            radius = 12;
        } else if (step.key === 'hero_summary') {
            const w = heroCardLayout?.current?.width || (SCREEN_WIDTH - 32);
            const h = heroCardLayout?.current?.height || 100;
            const x = heroCardLayout?.current?.x !== undefined ? heroCardLayout.current.x : 16;
            const y = insets.top + 160;
            calculatedRect = { x, y, width: w, height: h };
            radius = 14;
        } else if (step.key === 'highlights_and_tabs') {
            const w = highlightsCardLayout?.current?.width || (SCREEN_WIDTH - 32);
            const h = highlightsCardLayout?.current?.height || 220;
            const x = highlightsCardLayout?.current?.x !== undefined ? highlightsCardLayout.current.x : 16;
            const y = insets.top + 270;
            calculatedRect = { x, y, width: w, height: h };
            radius = 14;
        } else if (step.key === 'smart_lists') {
            const w = smartListsLayout?.current?.width || (SCREEN_WIDTH - 32);
            const h = smartListsLayout?.current?.height || 190;
            const x = smartListsLayout?.current?.x !== undefined ? smartListsLayout.current.x : 16;
            const y = SCREEN_HEIGHT * 0.48;
            calculatedRect = { x, y, width: w, height: h };
            radius = 14;
        } else if (step.key === 'share_stats') {
            const w = shareButtonLayout?.current?.width || 38;
            const h = shareButtonLayout?.current?.height || 38;
            const x = shareButtonLayout?.current?.x !== undefined ? shareButtonLayout.current.x : SCREEN_WIDTH - 54;
            const y = insets.top + 10;
            calculatedRect = { x, y, width: w, height: h };
            radius = 19;
        }

        setTargetRect(calculatedRect);
        setCurrentRadius(radius);

        // 2. Exact native measurement pass relative to rootRef
        const executeMeasurement = () => {
            let targetEl: any = null;
            switch (step.key) {
                case 'period_selector': targetEl = periodTabsRef?.current; break;
                case 'metric_toggle': targetEl = metricToggleRef?.current; break;
                case 'hero_summary': targetEl = heroCardRef?.current; break;
                case 'highlights_and_tabs': targetEl = highlightsCardRef?.current; break;
                case 'smart_lists': targetEl = smartListsRef?.current; break;
                case 'share_stats': targetEl = shareButtonRef?.current; break;
            }

            if (!targetEl || typeof targetEl.measureInWindow !== 'function') return;

            targetEl.measureInWindow((tx: number, ty: number, tw: number, th: number) => {
                if (tw <= 0 || th <= 0) return;
                if (rootRef?.current && typeof rootRef.current.measureInWindow === 'function') {
                    rootRef.current.measureInWindow((rx: number, ry: number) => {
                        const calculatedX = Math.round(tx - rx);
                        const calculatedY = Math.round(ty - ry);
                        if (calculatedY >= 0 && calculatedY < SCREEN_HEIGHT) {
                            setTargetRect({
                                x: calculatedX,
                                y: calculatedY,
                                width: Math.round(tw),
                                height: Math.round(th),
                            });
                        }
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
        const t1 = setTimeout(executeMeasurement, 40);
        const t2 = setTimeout(executeMeasurement, 120);
        const t3 = setTimeout(executeMeasurement, 260);
        const t4 = setTimeout(executeMeasurement, 480);
        measureTimers.current = [t1, t2, t3, t4];
    }, [
        periodTabsRef,
        metricToggleRef,
        heroCardRef,
        highlightsCardRef,
        smartListsRef,
        shareButtonRef,
        rootRef,
        scrollViewRef,
        insets.top,
        periodTabsLayout,
        metricToggleLayout,
        heroCardLayout,
        highlightsCardLayout,
        smartListsLayout,
        shareButtonLayout,
    ]);

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
            measureCurrentTarget(nextIdx);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 130,
                useNativeDriver: true,
            }).start();
        });
    };

    const handleNext = () => {
        if (currentStepIndex < ACTIVITY_SPOTLIGHT_STEPS.length - 1) {
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

    const currentStep = ACTIVITY_SPOTLIGHT_STEPS[currentStepIndex];
    const isLastStep = currentStepIndex === ACTIVITY_SPOTLIGHT_STEPS.length - 1;

    // Spotlight hole coordinates
    const PADDING = 4;
    const holeX = targetRect ? targetRect.x - PADDING : 16;
    const holeY = targetRect ? targetRect.y - PADDING : insets.top + 60;
    const holeW = targetRect ? targetRect.width + PADDING * 2 : SCREEN_WIDTH - 32;
    const holeH = targetRect ? targetRect.height + PADDING * 2 : 48;

    // Tooltip card dimensions & positioning
    const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
    const holeCenterX = holeX + holeW / 2;

    const idealCardLeft = holeCenterX - CARD_WIDTH / 2;
    const cardLeft = Math.max(16, Math.min(idealCardLeft, SCREEN_WIDTH - CARD_WIDTH - 16));

    const ARROW_HALF_WIDTH = 10;
    const rawArrowLeft = holeCenterX - cardLeft - ARROW_HALF_WIDTH;
    const arrowLeft = Math.max(18, Math.min(rawArrowLeft, CARD_WIDTH - 38));

    // Vertical placement:
    // Si el elemento está en la mitad superior de la pantalla, situamos el modal inmediatamente DEBAJO
    // a distancia cómoda (+14px) con flecha hacia arriba.
    // Si el elemento está en la mitad inferior, situamos el modal inmediatamente ENCIMA a distancia
    // óptima de 16px con flecha hacia abajo, sin forzarlo excesivamente a la cabecera.
    const isTargetNearBottom = holeY > SCREEN_HEIGHT * 0.46;
    const minTop = insets.top + 54;
    let tooltipTop: number;
    let arrowDirection: 'up' | 'down';

    if (isTargetNearBottom) {
        const idealTop = holeY - cardHeight - 16;
        tooltipTop = Math.max(minTop, idealTop);
        arrowDirection = 'down';
    } else {
        tooltipTop = holeY + holeH + 14;
        arrowDirection = 'up';
    }

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            {/* Diana de recorte transparente con borde gigante oscuro */}
            <View
                style={[
                    styles.spotlightHole,
                    {
                        left: holeX - 2500,
                        top: holeY - 2500,
                        width: holeW + 5000,
                        height: holeH + 5000,
                        borderWidth: 2500,
                        borderRadius: 2500 + currentRadius,
                    },
                ]}
                pointerEvents="auto"
            />

            {/* Borde único púrpura pulsante abrazando el recorte exactamente */}
            <Animated.View
                style={[
                    styles.glowRing,
                    {
                        left: holeX,
                        top: holeY,
                        width: holeW,
                        height: holeH,
                        borderColor: colors.accent,
                        borderRadius: currentRadius,
                        opacity: pulseRingAnim,
                    },
                ]}
                pointerEvents="none"
            />

            {/* Cuadro de Tutorial Contextual */}
            <Animated.View
                onLayout={(e) => {
                    const measuredH = Math.round(e.nativeEvent.layout.height);
                    if (measuredH > 100 && Math.abs(measuredH - cardHeight) > 3) {
                        setCardHeight(measuredH);
                    }
                }}
                style={[
                    styles.tooltipCard,
                    {
                        left: cardLeft,
                        top: tooltipTop,
                        width: CARD_WIDTH,
                        opacity: fadeAnim,
                        borderColor: colors.accentAlpha30,
                    },
                ]}
            >
                {/* Flecha indicadora apuntando a la diana */}
                {arrowDirection === 'down' ? (
                    <View
                        style={[
                            styles.arrowDown,
                            {
                                left: arrowLeft,
                                borderTopColor: '#1C1C22',
                            },
                        ]}
                    />
                ) : (
                    <View
                        style={[
                            styles.arrowUp,
                            {
                                left: arrowLeft,
                                borderBottomColor: '#1C1C22',
                            },
                        ]}
                    />
                )}

                {/* Cabecera del Tooltip */}
                <View style={styles.tooltipHeader}>
                    <View style={[styles.stepPill, { backgroundColor: colors.accentAlpha20 }]}>
                        <Ionicons name={currentStep.icon} size={15} color={colors.accent} style={{ marginRight: 6 }} />
                        <Text style={[styles.stepPillText, { color: colors.accent }]}>
                            {t('common.step_indicator', { current: currentStepIndex + 1, total: ACTIVITY_SPOTLIGHT_STEPS.length, defaultValue: `PASO ${currentStepIndex + 1} DE ${ACTIVITY_SPOTLIGHT_STEPS.length}` })}
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

                {/* Título y Descripción */}
                <Text style={styles.tooltipTitle}>
                    {t(`activity_tutorial.${currentStep.titleKey}`)}
                </Text>
                <Text style={styles.tooltipDesc}>
                    {t(`activity_tutorial.${currentStep.descKey}`)}
                </Text>

                {/* Consejo Pro */}
                <View style={styles.tipRow}>
                    <Text style={styles.tipText}>
                        {t(`activity_tutorial.${currentStep.proTipKey}`)}
                    </Text>
                </View>

                {/* Pie de controles: Anterior, Puntos y Siguiente */}
                <View style={styles.tooltipFooter}>
                    {currentStepIndex > 0 ? (
                        <TouchableOpacity
                            onPress={handlePrev}
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="chevron-back" size={16} color="#D1D5DB" style={{ marginRight: 3 }} />
                            <Text style={styles.secondaryBtnText}>
                                {t('activity_tutorial.prev')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.secondaryBtnText}>
                                {t('activity_tutorial.skip')}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Indicador de pasos con puntos */}
                    <View style={styles.dotsRow}>
                        {ACTIVITY_SPOTLIGHT_STEPS.map((_, idx) => (
                            <View
                                key={idx}
                                style={[
                                    styles.dot,
                                    idx === currentStepIndex && [styles.dotActive, { backgroundColor: colors.accent }],
                                ]}
                            />
                        ))}
                    </View>

                    {/* Botón Siguiente / Finalizar */}
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
                                ? t('activity_tutorial.finish')
                                : t('activity_tutorial.next')}
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
    arrowDown: {
        position: 'absolute',
        bottom: -10,
        width: 0,
        height: 0,
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderTopWidth: 10,
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
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    dotActive: {
        width: 16,
        borderRadius: 3,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    primaryBtnText: {
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '900',
    },
});
