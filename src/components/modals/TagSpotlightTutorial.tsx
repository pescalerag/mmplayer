import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';
import { TagService } from '@/services/tagService';
import Tag from '@/database/models/Tag';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type TagSpotlightStepKey = 'intro' | 'create' | 'color' | 'assign' | 'manage';

interface StepInfo {
    key: TagSpotlightStepKey;
    icon: keyof typeof Ionicons.glyphMap;
    titleKey: string;
    descKey: string;
    proTipKey: string;
}

const TAG_SPOTLIGHT_STEPS: StepInfo[] = [
    {
        key: 'intro',
        icon: 'pricetag',
        titleKey: 'steps.intro.title',
        descKey: 'steps.intro.desc',
        proTipKey: 'steps.intro.tip',
    },
    {
        key: 'create',
        icon: 'add-circle',
        titleKey: 'steps.create.title',
        descKey: 'steps.create.desc',
        proTipKey: 'steps.create.tip',
    },
    {
        key: 'color',
        icon: 'color-palette',
        titleKey: 'steps.color.title',
        descKey: 'steps.color.desc',
        proTipKey: 'steps.color.tip',
    },
    {
        key: 'assign',
        icon: 'disc',
        titleKey: 'steps.assign.title',
        descKey: 'steps.assign.desc',
        proTipKey: 'steps.assign.tip',
    },
    {
        key: 'manage',
        icon: 'options',
        titleKey: 'steps.manage.title',
        descKey: 'steps.manage.desc',
        proTipKey: 'steps.manage.tip',
    },
];

const PRESET_COLORS = [
    '#8B5CF6', // Accent / Púrpura
    '#3B82F6', // Azul
    '#10B981', // Verde
    '#F59E0B', // Ámbar
    '#EF4444', // Rojo
    '#EC4899', // Rosa
];

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TagSpotlightTutorialProps {
    visible: boolean;
    onClose: () => void;
    tags: Tag[];
    rootRef?: React.RefObject<any>;
    helpButtonRef?: React.RefObject<any>;
    createButtonRef?: React.RefObject<any>;
    firstTagRef?: React.RefObject<any>;
    headerHeight?: number;
    helpButtonLayout?: React.MutableRefObject<any>;
    createButtonLayout?: React.MutableRefObject<any>;
    firstTagLayout?: React.MutableRefObject<any>;
}

export default function TagSpotlightTutorial({
    visible,
    onClose,
    tags,
    rootRef,
    helpButtonRef,
    createButtonRef,
    firstTagRef,
    headerHeight = 100,
    helpButtonLayout,
    createButtonLayout,
    firstTagLayout,
}: TagSpotlightTutorialProps) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<Rect | null>(null);
    const [currentRadius, setCurrentRadius] = useState(18);

    // Height of the preview sheet in Step 3
    const defaultSheetHeight = 280 + insets.bottom;
    const [sheetHeight, setSheetHeight] = useState(defaultSheetHeight);

    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const pulseRingAnim = useRef(new Animated.Value(0.5)).current;
    const sheetSlideAnim = useRef(new Animated.Value(400)).current;

    // Smooth breathing opacity pulse on spotlight / focus ring
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

    // If user has no tags, auto-create a starter tag so steps 4 & 5 have a real tag to focus on
    useEffect(() => {
        if (visible && tags.length === 0) {
            const sampleName = t('tags_tutorial.sample_tag_name') || 'Favoritos';
            TagService.createTag(sampleName, colors.accent).catch(err => {
                console.warn('Error creating sample tag for tutorial:', err);
            });
        }
    }, [visible, tags.length, colors.accent, t]);

    // Measure target element relative to root container to ensure 100% accurate positioning
    const measureCurrentTarget = useCallback((stepIdx: number) => {
        const step = TAG_SPOTLIGHT_STEPS[stepIdx];

        measureTimers.current.forEach(tm => clearTimeout(tm));
        measureTimers.current = [];

        // For color step (step 3), sheet is positioned at bottom in native Modal
        if (step.key === 'color') return;

        // 1. Dynamic pre-calculated rects for instant 0ms feedback
        let calculatedRect: Rect = { x: 20, y: 100, width: SCREEN_WIDTH - 40, height: 50 };
        let radius = 16;

        if (step.key === 'intro') {
            const btnW = helpButtonLayout?.current?.width || 40;
            const btnH = helpButtonLayout?.current?.height || 40;
            const btnX = SCREEN_WIDTH - 24 - btnW;
            const btnY = insets.top + 10;
            calculatedRect = {
                x: btnX,
                y: btnY,
                width: btnW,
                height: btnH,
            };
            radius = 20;
        } else if (step.key === 'create') {
            const btnW = createButtonLayout?.current?.width || (SCREEN_WIDTH - 40);
            const btnH = createButtonLayout?.current?.height || 50;
            calculatedRect = {
                x: 20,
                y: headerHeight + 30,
                width: btnW,
                height: btnH,
            };
            radius = 12;
        } else if (step.key === 'assign' || step.key === 'manage') {
            const cardW = firstTagLayout?.current?.width || (SCREEN_WIDTH - 40);
            const cardH = firstTagLayout?.current?.height || 54;
            const createBtnH = createButtonLayout?.current?.height || 50;
            calculatedRect = {
                x: 20,
                y: headerHeight + 30 + createBtnH + 20,
                width: cardW,
                height: cardH,
            };
            radius = 16;
        }

        setTargetRect(calculatedRect);
        setCurrentRadius(radius);

        // 2. Exact native measurement pass relative to rootRef
        const executeMeasurement = () => {
            let targetEl: any = null;
            if (step.key === 'intro') {
                targetEl = helpButtonRef?.current;
            } else if (step.key === 'create') {
                targetEl = createButtonRef?.current;
            } else if (step.key === 'assign' || step.key === 'manage') {
                targetEl = firstTagRef?.current;
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
    }, [helpButtonRef, createButtonRef, firstTagRef, rootRef, insets.top, headerHeight, helpButtonLayout, createButtonLayout, firstTagLayout]);

    // When opened, reset to step 0
    useEffect(() => {
        if (visible) {
            setCurrentStepIndex(0);
            fadeAnim.setValue(1);
            sheetSlideAnim.setValue(400);
            measureCurrentTarget(0);
        }
    }, [visible, measureCurrentTarget, fadeAnim, sheetSlideAnim]);

    const goToStep = (nextIdx: number) => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
        }).start(() => {
            const nextStep = TAG_SPOTLIGHT_STEPS[nextIdx];
            setCurrentStepIndex(nextIdx);

            if (nextStep.key === 'color') {
                sheetSlideAnim.setValue(400);
                Animated.spring(sheetSlideAnim, {
                    toValue: 0,
                    damping: 22,
                    stiffness: 200,
                    useNativeDriver: true,
                }).start();
            } else {
                Animated.timing(sheetSlideAnim, {
                    toValue: 400,
                    duration: 180,
                    useNativeDriver: true,
                }).start();
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
        if (currentStepIndex < TAG_SPOTLIGHT_STEPS.length - 1) {
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

    const currentStep = TAG_SPOTLIGHT_STEPS[currentStepIndex];
    const isLastStep = currentStepIndex === TAG_SPOTLIGHT_STEPS.length - 1;
    const isColorStep = currentStep.key === 'color';

    // Tooltip card dimensions
    const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);

    // =========================================================================
    // MODO PASO 3: Renderizado en Modal nativo por encima de toda la aplicación
    // =========================================================================
    if (isColorStep) {
        return (
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={onClose}
            >
                <View style={styles.modalRoot} pointerEvents="box-none">
                    {/* Fondo oscuro suave para atenuar la app de fondo */}
                    <View style={styles.backdropDark} pointerEvents="auto" />

                    {/* Modal Sheet de creación de etiquetas nítido y claro */}
                    <Animated.View
                        onLayout={(e) => {
                            const h = e.nativeEvent.layout.height;
                            if (h > 0) {
                                setSheetHeight(Math.round(h));
                            }
                        }}
                        style={[
                            styles.sheetContainer,
                            {
                                paddingBottom: insets.bottom + 20,
                                transform: [{ translateY: sheetSlideAnim }],
                            },
                        ]}
                        pointerEvents="box-none"
                    >
                        <View style={styles.dragIndicator} />

                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetHeaderTitle, { color: colors.accent }]}>
                                {t('tags.manager')}
                            </Text>
                            <Text style={styles.sheetHeaderSubtitle}>
                                {t('tags.create_tag')}
                            </Text>
                        </View>

                        {/* Nombre de la etiqueta */}
                        <Text style={styles.sheetSectionTitle}>{t('tags.name')}</Text>
                        <View style={styles.sheetInputFake}>
                            <Ionicons name="pricetag-outline" size={16} color={colors.accent} style={{ marginRight: 8 }} />
                            <Text style={styles.sheetInputFakeText}>
                                {t('tags_tutorial.sample_tag_name') || 'Favoritos'}
                            </Text>
                        </View>

                        {/* Selector de Color */}
                        <Text style={[styles.sheetSectionTitle, { marginTop: 16 }]}>
                            {t('tags.color')}
                        </Text>

                        {/* Fila de colores con borde pulsante que resalta la paleta */}
                        <View style={styles.colorRowHighlightWrapper}>
                            <Animated.View
                                style={[
                                    styles.colorRowGlowRing,
                                    {
                                        borderColor: colors.accent,
                                        opacity: pulseRingAnim,
                                    },
                                ]}
                                pointerEvents="none"
                            />
                            <View style={styles.colorRow}>
                                {PRESET_COLORS.map((color, idx) => (
                                    <View
                                        key={color}
                                        style={[
                                            styles.colorOption,
                                            { backgroundColor: color },
                                            idx === 0 && styles.colorOptionSelected,
                                        ]}
                                    >
                                        {idx === 0 && (
                                            <Ionicons name="checkmark" size={16} color="#FFF" />
                                        )}
                                    </View>
                                ))}
                                <View style={[styles.colorOption, { backgroundColor: '#333' }]}>
                                    <Ionicons name="color-palette" size={16} color="#FFF" />
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Cuadro de Tutorial Contextual situado encima del modal */}
                    <Animated.View
                        style={[
                            styles.tooltipCard,
                            {
                                left: Math.max(16, (SCREEN_WIDTH - CARD_WIDTH) / 2),
                                bottom: sheetHeight + 14,
                                width: CARD_WIDTH,
                                opacity: fadeAnim,
                                borderColor: colors.accentAlpha30,
                                elevation: 25,
                                zIndex: 500,
                            },
                        ]}
                    >
                        {/* Flecha indicadora apuntando hacia abajo hacia la paleta */}
                        <View
                            style={[
                                styles.arrowDown,
                                {
                                    left: (CARD_WIDTH - 20) / 2,
                                    borderTopColor: '#1C1C22',
                                },
                            ]}
                        />

                        {/* Cabecera del Tooltip */}
                        <View style={styles.tooltipHeader}>
                            <View style={[styles.stepPill, { backgroundColor: colors.accentAlpha20 }]}>
                                <Ionicons name={currentStep.icon} size={15} color={colors.accent} style={{ marginRight: 6 }} />
                                <Text style={[styles.stepPillText, { color: colors.accent }]}>
                                    {t('common.step_indicator', { current: currentStepIndex + 1, total: TAG_SPOTLIGHT_STEPS.length, defaultValue: `PASO ${currentStepIndex + 1} DE ${TAG_SPOTLIGHT_STEPS.length}` })}
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
                            {t(`tags_tutorial.${currentStep.titleKey}`)}
                        </Text>
                        <Text style={styles.tooltipDesc}>
                            {t(`tags_tutorial.${currentStep.descKey}`)}
                        </Text>

                        {/* Consejo Pro destacado */}
                        <View style={styles.tipRow}>
                            <Text style={styles.tipText}>
                                {t(`tags_tutorial.${currentStep.proTipKey}`)}
                            </Text>
                        </View>

                        {/* Controles de Navegación */}
                        <View style={styles.tooltipFooter}>
                            <TouchableOpacity
                                onPress={handlePrev}
                                style={styles.secondaryBtn}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chevron-back" size={16} color="#D1D5DB" style={{ marginRight: 3 }} />
                                <Text style={styles.secondaryBtnText}>
                                    {t('tags_tutorial.prev')}
                                </Text>
                            </TouchableOpacity>

                            {/* Puntos de progreso */}
                            <View style={styles.dotsRow}>
                                {TAG_SPOTLIGHT_STEPS.map((_, idx) => (
                                    <View
                                        key={idx}
                                        style={[
                                            styles.dot,
                                            idx === currentStepIndex && [styles.dotActive, { backgroundColor: colors.accent }],
                                        ]}
                                    />
                                ))}
                            </View>

                            {/* Botón Siguiente */}
                            <TouchableOpacity
                                onPress={handleNext}
                                style={[
                                    styles.primaryBtn,
                                    { backgroundColor: colors.accent },
                                ]}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                                    {t('tags_tutorial.next')}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color={colors.onAccent}
                                    style={{ marginLeft: 3 }}
                                />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        );
    }

    // =========================================================================
    // MODO PASOS ESTÁNDAR (1, 2, 4, 5): Renderizado dentro de TagManagementScreen
    // con medición nativa exacta contra rootRef (100% centrado al píxel)
    // =========================================================================
    const PADDING = 4;
    const holeX = targetRect ? targetRect.x - PADDING : 20;
    const holeY = targetRect ? targetRect.y - PADDING : insets.top + 10;
    const holeW = targetRect ? targetRect.width + PADDING * 2 : 100;
    const holeH = targetRect ? targetRect.height + PADDING * 2 : 44;

    const holeCenterX = holeX + holeW / 2;
    const idealCardLeft = holeCenterX - CARD_WIDTH / 2;
    const cardLeft = Math.max(16, Math.min(idealCardLeft, SCREEN_WIDTH - CARD_WIDTH - 16));

    const ARROW_HALF_WIDTH = 10;
    const rawArrowLeft = holeCenterX - cardLeft - ARROW_HALF_WIDTH;
    const arrowLeft = Math.max(18, Math.min(rawArrowLeft, CARD_WIDTH - 38));

    const isTargetNearBottom = holeY > SCREEN_HEIGHT * 0.55;
    const tooltipTop = isTargetNearBottom ? undefined : holeY + holeH + 14;
    const tooltipBottom = isTargetNearBottom ? SCREEN_HEIGHT - holeY + 14 : undefined;

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
                style={[
                    styles.tooltipCard,
                    isTargetNearBottom
                        ? {
                            left: cardLeft,
                            bottom: tooltipBottom,
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
                {/* Flecha indicadora apuntando a la diana */}
                {isTargetNearBottom ? (
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
                            {t('common.step_indicator', { current: currentStepIndex + 1, total: TAG_SPOTLIGHT_STEPS.length, defaultValue: `PASO ${currentStepIndex + 1} DE ${TAG_SPOTLIGHT_STEPS.length}` })}
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
                    {t(`tags_tutorial.${currentStep.titleKey}`)}
                </Text>
                <Text style={styles.tooltipDesc}>
                    {t(`tags_tutorial.${currentStep.descKey}`)}
                </Text>

                {/* Consejo Pro destacado */}
                <View style={styles.tipRow}>
                    <Text style={styles.tipText}>
                        {t(`tags_tutorial.${currentStep.proTipKey}`)}
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
                                {t('tags_tutorial.prev')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.secondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.secondaryBtnText}>
                                {t('tags_tutorial.skip')}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Puntos de progreso */}
                    <View style={styles.dotsRow}>
                        {TAG_SPOTLIGHT_STEPS.map((_, idx) => (
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
                                ? t('tags_tutorial.finish')
                                : t('tags_tutorial.next')}
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
    modalRoot: {
        flex: 1,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    backdropDark: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
    sheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#161618',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        zIndex: 100,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
    },
    dragIndicator: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#444',
        alignSelf: 'center',
        marginBottom: 16,
    },
    sheetHeader: {
        alignItems: 'center',
        marginBottom: 16,
    },
    sheetHeaderTitle: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    sheetHeaderSubtitle: {
        fontSize: 18,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFF',
    },
    sheetSectionTitle: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    sheetInputFake: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#222226',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    sheetInputFakeText: {
        color: '#FFF',
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    colorRowHighlightWrapper: {
        position: 'relative',
        borderRadius: 24,
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginTop: 4,
        marginBottom: 6,
    },
    colorRowGlowRing: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        borderWidth: 2,
    },
    colorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    colorOption: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorOptionSelected: {
        borderWidth: 2,
        borderColor: '#FFF',
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
