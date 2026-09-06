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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type PlayerSpotlightStepKey =
    | 'options'
    | 'cover'
    | 'tags'
    | 'actions'
    | 'controls'
    | 'sleep'
    | 'speed'
    | 'lyrics'
    | 'cast'
    | 'ab_repeat'
    | 'share'
    | 'queue';

interface StepInfo {
    key: PlayerSpotlightStepKey;
    icon: keyof typeof Ionicons.glyphMap;
    titleKey: string;
    descKey: string;
    proTipKey: string;
}

const PLAYER_SPOTLIGHT_STEPS: StepInfo[] = [
    {
        key: 'options',
        icon: 'ellipsis-horizontal',
        titleKey: 'steps.options.title',
        descKey: 'steps.options.desc',
        proTipKey: 'steps.options.tip',
    },
    {
        key: 'cover',
        icon: 'disc-outline',
        titleKey: 'steps.cover.title',
        descKey: 'steps.cover.desc',
        proTipKey: 'steps.cover.tip',
    },
    {
        key: 'tags',
        icon: 'pricetags-outline',
        titleKey: 'steps.tags.title',
        descKey: 'steps.tags.desc',
        proTipKey: 'steps.tags.tip',
    },
    {
        key: 'actions',
        icon: 'heart-outline',
        titleKey: 'steps.actions.title',
        descKey: 'steps.actions.desc',
        proTipKey: 'steps.actions.tip',
    },
    {
        key: 'controls',
        icon: 'play-circle-outline',
        titleKey: 'steps.controls.title',
        descKey: 'steps.controls.desc',
        proTipKey: 'steps.controls.tip',
    },
    {
        key: 'sleep',
        icon: 'timer-outline',
        titleKey: 'steps.sleep.title',
        descKey: 'steps.sleep.desc',
        proTipKey: 'steps.sleep.tip',
    },
    {
        key: 'speed',
        icon: 'speedometer-outline',
        titleKey: 'steps.speed.title',
        descKey: 'steps.speed.desc',
        proTipKey: 'steps.speed.tip',
    },
    {
        key: 'lyrics',
        icon: 'mic-outline',
        titleKey: 'steps.lyrics.title',
        descKey: 'steps.lyrics.desc',
        proTipKey: 'steps.lyrics.tip',
    },
    {
        key: 'cast',
        icon: 'tv-outline',
        titleKey: 'steps.cast.title',
        descKey: 'steps.cast.desc',
        proTipKey: 'steps.cast.tip',
    },
    {
        key: 'ab_repeat',
        icon: 'repeat-outline',
        titleKey: 'steps.ab_repeat.title',
        descKey: 'steps.ab_repeat.desc',
        proTipKey: 'steps.ab_repeat.tip',
    },
    {
        key: 'share',
        icon: 'share-social-outline',
        titleKey: 'steps.share.title',
        descKey: 'steps.share.desc',
        proTipKey: 'steps.share.tip',
    },
    {
        key: 'queue',
        icon: 'list-outline',
        titleKey: 'steps.queue.title',
        descKey: 'steps.queue.desc',
        proTipKey: 'steps.queue.tip',
    },
];

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PlayerSpotlightTutorialProps {
    visible: boolean;
    onClose: () => void;
    rootRef: React.RefObject<any>;
    moreButtonRef?: React.RefObject<any>;
    artworkRef?: React.RefObject<any>;
    tagsRef?: React.RefObject<any>;
    actionsRef?: React.RefObject<any>;
    controlsRef?: React.RefObject<any>;
    sleepTimerRef?: React.RefObject<any>;
    speedRef?: React.RefObject<any>;
    lyricsRef?: React.RefObject<any>;
    castRef?: React.RefObject<any>;
    abRepeatRef?: React.RefObject<any>;
    shareRef?: React.RefObject<any>;
    queueRef?: React.RefObject<any>;
    // Layouts
    moreButtonLayout?: React.MutableRefObject<any>;
    artworkLayout?: React.MutableRefObject<any>;
    tagsLayout?: React.MutableRefObject<any>;
    actionsLayout?: React.MutableRefObject<any>;
    controlsLayout?: React.MutableRefObject<any>;
    sleepTimerLayout?: React.MutableRefObject<any>;
    speedLayout?: React.MutableRefObject<any>;
    lyricsLayout?: React.MutableRefObject<any>;
    castLayout?: React.MutableRefObject<any>;
    abRepeatLayout?: React.MutableRefObject<any>;
    shareLayout?: React.MutableRefObject<any>;
    queueLayout?: React.MutableRefObject<any>;
}

export default function PlayerSpotlightTutorial({
    visible,
    onClose,
    rootRef,
    moreButtonRef,
    artworkRef,
    tagsRef,
    actionsRef,
    controlsRef,
    sleepTimerRef,
    speedRef,
    lyricsRef,
    castRef,
    abRepeatRef,
    shareRef,
    queueRef,
    moreButtonLayout,
    artworkLayout,
    tagsLayout,
    actionsLayout,
    controlsLayout,
    sleepTimerLayout,
    speedLayout,
    lyricsLayout,
    castLayout,
    abRepeatLayout,
    shareLayout,
    queueLayout,
}: PlayerSpotlightTutorialProps) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<Rect | null>(null);
    const [currentRadius, setCurrentRadius] = useState(20);
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

    // Measure target element relative to root container to ensure 100% pixel-perfect positioning
    const measureCurrentTarget = useCallback((stepIdx: number) => {
        const step = PLAYER_SPOTLIGHT_STEPS[stepIdx];

        measureTimers.current.forEach(tm => clearTimeout(tm));
        measureTimers.current = [];

        // 1. Dynamic pre-calculated rects for instant 0ms feedback
        let calculatedRect: Rect = { x: 20, y: 100, width: SCREEN_WIDTH - 40, height: 50 };
        let radius = 20;

        if (step.key === 'options') {
            const btnW = moreButtonLayout?.current?.width || 38;
            const btnH = moreButtonLayout?.current?.height || 38;
            const btnX = SCREEN_WIDTH - 16 - btnW;
            const btnY = insets.top + 11;
            calculatedRect = { x: btnX, y: btnY, width: btnW, height: btnH };
            radius = 20;
        } else if (step.key === 'cover') {
            const coverSize = SCREEN_WIDTH - 64;
            const coverX = 32;
            const coverY = insets.top + 60 + 16;
            calculatedRect = { x: coverX, y: coverY, width: coverSize, height: coverSize };
            radius = 16;
        } else if (step.key === 'tags') {
            const tagW = tagsLayout?.current?.width || (SCREEN_WIDTH - 48);
            const tagH = tagsLayout?.current?.height || 36;
            calculatedRect = { x: 24, y: insets.top + 60 + 16 + (SCREEN_WIDTH - 64) + 16, width: tagW, height: tagH };
            radius = 14;
        } else if (step.key === 'actions') {
            const actW = actionsLayout?.current?.width || 80;
            const actH = actionsLayout?.current?.height || 44;
            calculatedRect = { x: SCREEN_WIDTH - 24 - actW, y: insets.top + 60 + 16 + (SCREEN_WIDTH - 64) + 50, width: actW, height: actH };
            radius = 18;
        } else if (step.key === 'controls') {
            const ctrlW = controlsLayout?.current?.width || (SCREEN_WIDTH - 48);
            const ctrlH = controlsLayout?.current?.height || 90;
            calculatedRect = { x: 24, y: SCREEN_HEIGHT - insets.bottom - 170, width: ctrlW, height: ctrlH };
            radius = 28;
        } else {
            // Footer buttons
            const footerY = SCREEN_HEIGHT - insets.bottom - 60;
            let footerX = 24;
            if (step.key === 'sleep') footerX = 20;
            else if (step.key === 'speed') footerX = 64;
            else if (step.key === 'lyrics') footerX = 108;
            else if (step.key === 'cast') footerX = 152;
            else if (step.key === 'ab_repeat') footerX = 196;
            else if (step.key === 'share') footerX = SCREEN_WIDTH - 76;
            else if (step.key === 'queue') footerX = SCREEN_WIDTH - 38;
            calculatedRect = { x: footerX, y: footerY, width: 38, height: 38 };
            radius = 20;
        }

        setTargetRect(calculatedRect);
        setCurrentRadius(radius);

        // 2. Exact native measurement pass relative to rootRef
        const executeMeasurement = () => {
            let targetEl: any = null;
            switch (step.key) {
                case 'options': targetEl = moreButtonRef?.current; break;
                case 'cover': targetEl = artworkRef?.current; break;
                case 'tags': targetEl = tagsRef?.current; break;
                case 'actions': targetEl = actionsRef?.current; break;
                case 'controls': targetEl = controlsRef?.current; break;
                case 'sleep': targetEl = sleepTimerRef?.current; break;
                case 'speed': targetEl = speedRef?.current; break;
                case 'lyrics': targetEl = lyricsRef?.current; break;
                case 'cast': targetEl = castRef?.current; break;
                case 'ab_repeat': targetEl = abRepeatRef?.current; break;
                case 'share': targetEl = shareRef?.current; break;
                case 'queue': targetEl = queueRef?.current; break;
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
        const t2 = setTimeout(executeMeasurement, 100);
        const t3 = setTimeout(executeMeasurement, 250);
        const t4 = setTimeout(executeMeasurement, 450);
        measureTimers.current = [t1, t2, t3, t4];
    }, [
        moreButtonRef,
        artworkRef,
        tagsRef,
        actionsRef,
        controlsRef,
        sleepTimerRef,
        speedRef,
        lyricsRef,
        castRef,
        abRepeatRef,
        shareRef,
        queueRef,
        rootRef,
        insets.top,
        insets.bottom,
        moreButtonLayout,
        artworkLayout,
        tagsLayout,
        actionsLayout,
        controlsLayout,
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
        if (currentStepIndex < PLAYER_SPOTLIGHT_STEPS.length - 1) {
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

    const currentStep = PLAYER_SPOTLIGHT_STEPS[currentStepIndex];
    const isLastStep = currentStepIndex === PLAYER_SPOTLIGHT_STEPS.length - 1;

    // Spotlight hole coordinates
    const PADDING = 4;
    const holeX = targetRect ? targetRect.x - PADDING : 20;
    const holeY = targetRect ? targetRect.y - PADDING : insets.top + 10;
    const holeW = targetRect ? targetRect.width + PADDING * 2 : 100;
    const holeH = targetRect ? targetRect.height + PADDING * 2 : 44;

    // Tooltip card dimensions & positioning
    const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
    const holeCenterX = holeX + holeW / 2;

    const idealCardLeft = holeCenterX - CARD_WIDTH / 2;
    const isStepAboveTarget = currentStepIndex >= 2;
    const cardLeft = isStepAboveTarget
        ? Math.round((SCREEN_WIDTH - CARD_WIDTH) / 2)
        : Math.max(16, Math.min(idealCardLeft, SCREEN_WIDTH - CARD_WIDTH - 16));

    const ARROW_HALF_WIDTH = 10;
    const rawArrowLeft = holeCenterX - cardLeft - ARROW_HALF_WIDTH;
    const arrowLeft = Math.max(18, Math.min(rawArrowLeft, CARD_WIDTH - 38));

    // Posicionamiento vertical dinámico y óptimo:
    // - Pasos 1 y 2 (opciones en cabecera y carátula): el modal se sitúa DEBAJO del elemento a distancia cómoda (+14px).
    // - Pasos 3 al 12 (tags, acciones, controles y footer): el modal se sitúa ENCIMA del elemento a distancia óptima,
    //   calculada según la posición 'holeY' del elemento enfocado, de modo que el modal quede inmediatamente encima
    //   (a 16px del foco) con la flecha apuntando hacia abajo, permitiendo leer y ver el elemento a la vez con total comodidad
    //   sin desplazarse excesivamente arriba hacia la cabecera cuando los iconos están abajo.
    const minTop = insets.top + 54;
    let tooltipTop: number;
    let arrowDirection: 'up' | 'down';

    if (isStepAboveTarget) {
        // Distancia óptima: situar la base del modal 16px por encima del elemento/icono enfocado
        const idealTop = holeY - cardHeight - 16;
        tooltipTop = Math.max(minTop, idealTop);
        arrowDirection = 'down';
    } else if (currentStep.key === 'options') {
        tooltipTop = holeY + holeH + 14;
        arrowDirection = 'up';
    } else {
        // Step 2 ('cover'): situar justo debajo de la carátula
        tooltipTop = Math.min(holeY + holeH + 14, SCREEN_HEIGHT - insets.bottom - cardHeight - 10);
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
                            {`PASO ${currentStepIndex + 1} DE ${PLAYER_SPOTLIGHT_STEPS.length}`}
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

                {/* Título y descripción */}
                <Text style={styles.tooltipTitle}>
                    {t(`player_tutorial.${currentStep.titleKey}`)}
                </Text>
                <Text style={styles.tooltipDesc}>
                    {t(`player_tutorial.${currentStep.descKey}`)}
                </Text>

                {/* Consejo Pro destacado */}
                <View style={styles.tipRow}>
                    <Text style={styles.tipText}>
                        {t(`player_tutorial.${currentStep.proTipKey}`)}
                    </Text>
                </View>

                {/* Controles de Navegación */}
                <View style={styles.tooltipFooter}>
                    {currentStepIndex > 0 ? (
                        <TouchableOpacity
                            onPress={handlePrev}
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="chevron-back" size={16} color="#D1D5DB" style={{ marginRight: 3 }} />
                            <Text style={styles.secondaryBtnText}>
                                {t('player_tutorial.prev')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.secondaryBtnText}>
                                {t('player_tutorial.skip')}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Puntos de progreso */}
                    <View style={styles.dotsRow}>
                        {PLAYER_SPOTLIGHT_STEPS.map((_, idx) => (
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
                                ? t('player_tutorial.finish')
                                : t('player_tutorial.next')}
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
