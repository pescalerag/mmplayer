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
import Tag from '../../database/models/Tag';
import { TagService } from '../../services/tagService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type SearchSpotlightStepKey = 'search_bar' | 'advanced_tags' | 'explore_tags';

interface StepInfo {
    key: SearchSpotlightStepKey;
    icon: keyof typeof Ionicons.glyphMap;
    titleKey: string;
    descKey: string;
    proTipKey: string;
}

const SEARCH_SPOTLIGHT_STEPS: StepInfo[] = [
    {
        key: 'search_bar',
        icon: 'search',
        titleKey: 'steps.search_bar.title',
        descKey: 'steps.search_bar.desc',
        proTipKey: 'steps.search_bar.tip',
    },
    {
        key: 'advanced_tags',
        icon: 'options-outline',
        titleKey: 'steps.advanced_tags.title',
        descKey: 'steps.advanced_tags.desc',
        proTipKey: 'steps.advanced_tags.tip',
    },
    {
        key: 'explore_tags',
        icon: 'pricetags-outline',
        titleKey: 'steps.explore_tags.title',
        descKey: 'steps.explore_tags.desc',
        proTipKey: 'steps.explore_tags.tip',
    },
];

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SearchSpotlightTutorialProps {
    visible: boolean;
    onClose: () => void;
    tags: Tag[];
    rootRef?: React.RefObject<any>;
    searchBarRef?: React.RefObject<any>;
    advancedSearchButtonRef?: React.RefObject<any>;
    firstTagRef?: React.RefObject<any>;
    searchBarLayout?: React.MutableRefObject<any>;
    advancedSearchButtonLayout?: React.MutableRefObject<any>;
    firstTagLayout?: React.MutableRefObject<any>;
}

export default function SearchSpotlightTutorial({
    visible,
    onClose,
    tags,
    rootRef,
    searchBarRef,
    advancedSearchButtonRef,
    firstTagRef,
    searchBarLayout,
    advancedSearchButtonLayout,
    firstTagLayout,
}: SearchSpotlightTutorialProps) {
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

    // Si el usuario no tiene etiquetas, creamos automáticamente una de prueba ("Favoritos")
    // para que el paso de Exploración por Etiquetas tenga un elemento real al que hacer foco
    useEffect(() => {
        if (visible && tags.length === 0) {
            const sampleName = t('tags_tutorial.sample_tag_name') || 'Favoritos';
            TagService.createTag(sampleName, colors.accent).catch(err => {
                console.warn('Error creating sample tag for search tutorial:', err);
            });
        }
    }, [visible, tags.length, colors.accent, t]);

    // Measure target element relative to root container to ensure 100% accurate positioning
    const measureCurrentTarget = useCallback((stepIdx: number) => {
        const step = SEARCH_SPOTLIGHT_STEPS[stepIdx];

        measureTimers.current.forEach(tm => clearTimeout(tm));
        measureTimers.current = [];

        // 1. Dynamic pre-calculated rects for instant 0ms feedback
        let calculatedRect: Rect = { x: 20, y: 100, width: SCREEN_WIDTH - 40, height: 50 };
        let radius = 14;

        if (step.key === 'search_bar') {
            const sbW = searchBarLayout?.current?.width || (SCREEN_WIDTH - 40);
            const sbH = searchBarLayout?.current?.height || 48;
            const sbX = searchBarLayout?.current?.x !== undefined ? searchBarLayout.current.x : 20;
            const sbY = insets.top + 60;
            calculatedRect = { x: sbX, y: sbY, width: sbW, height: sbH };
            radius = 14;
        } else if (step.key === 'advanced_tags') {
            const advW = advancedSearchButtonLayout?.current?.width || (SCREEN_WIDTH - 40);
            const advH = advancedSearchButtonLayout?.current?.height || 48;
            const advX = advancedSearchButtonLayout?.current?.x !== undefined ? advancedSearchButtonLayout.current.x : 20;
            const advY = insets.top + 135;
            calculatedRect = { x: advX, y: advY, width: advW, height: advH };
            radius = 14;
        } else if (step.key === 'explore_tags') {
            const tagW = firstTagLayout?.current?.width || 120;
            const tagH = firstTagLayout?.current?.height || 40;
            const tagX = firstTagLayout?.current?.x !== undefined ? firstTagLayout.current.x : 20;
            const tagY = insets.top + 230;
            calculatedRect = { x: tagX, y: tagY, width: tagW, height: tagH };
            radius = 12;
        }

        setTargetRect(calculatedRect);
        setCurrentRadius(radius);

        // 2. Exact native measurement pass relative to rootRef
        const executeMeasurement = () => {
            let targetEl: any = null;
            switch (step.key) {
                case 'search_bar': targetEl = searchBarRef?.current; break;
                case 'advanced_tags': targetEl = advancedSearchButtonRef?.current; break;
                case 'explore_tags': targetEl = firstTagRef?.current; break;
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
        searchBarRef,
        advancedSearchButtonRef,
        firstTagRef,
        rootRef,
        insets.top,
        searchBarLayout,
        advancedSearchButtonLayout,
        firstTagLayout,
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
        if (currentStepIndex < SEARCH_SPOTLIGHT_STEPS.length - 1) {
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

    const currentStep = SEARCH_SPOTLIGHT_STEPS[currentStepIndex];
    const isLastStep = currentStepIndex === SEARCH_SPOTLIGHT_STEPS.length - 1;

    // Spotlight hole coordinates
    const PADDING = 4;
    const holeX = targetRect ? targetRect.x - PADDING : 20;
    const holeY = targetRect ? targetRect.y - PADDING : insets.top + 60;
    const holeW = targetRect ? targetRect.width + PADDING * 2 : SCREEN_WIDTH - 40;
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
    const isTargetNearBottom = holeY > SCREEN_HEIGHT * 0.48;
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
                            {t('common.step_indicator', { current: currentStepIndex + 1, total: SEARCH_SPOTLIGHT_STEPS.length, defaultValue: `PASO ${currentStepIndex + 1} DE ${SEARCH_SPOTLIGHT_STEPS.length}` })}
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
                    {t(`search_tutorial.${currentStep.titleKey}`)}
                </Text>
                <Text style={styles.tooltipDesc}>
                    {t(`search_tutorial.${currentStep.descKey}`)}
                </Text>

                {/* Consejo Pro */}
                <View style={styles.tipRow}>
                    <Text style={styles.tipText}>
                        {t(`search_tutorial.${currentStep.proTipKey}`)}
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
                                {t('search_tutorial.prev')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.secondaryBtnText}>
                                {t('search_tutorial.skip')}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Indicador de pasos con puntos */}
                    <View style={styles.dotsRow}>
                        {SEARCH_SPOTLIGHT_STEPS.map((_, idx) => (
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
                                ? t('search_tutorial.finish')
                                : t('search_tutorial.next')}
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
