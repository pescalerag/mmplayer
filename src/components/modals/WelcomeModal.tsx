import { useAppTheme } from "@/hooks/useAppTheme";
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    BackHandler,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScannerService } from '../../services/ScannerService';
import { useSettingsStore } from '../../store/useSettingsStore';

type SetupStep = 'alias' | 'permission' | 'features' | 'settings';

export default function WelcomeModal() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const [visible, setVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [step, setStep] = useState<SetupStep>('alias');
    const [aliasInput, setAliasInput] = useState('');

    // Storage permission status
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);

    const {
        lastSeenVersion,
        setLastSeenVersion,
        userAlias,
        setUserAlias,
        forceWelcomeModal,
        setForceWelcomeModal,
        isKeepAwakeEnabled,
        setIsKeepAwakeEnabled,
        isFadeEnabled,
        setIsFadeEnabled,
        language,
        setLanguage,
        swipeLeftAction,
        setSwipeLeftAction,
        swipeRightAction,
        setSwipeRightAction,
    } = useSettingsStore();

    const currentVersion = Constants.expoConfig?.version || '2.0.0-beta.5';
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) return;

        // Condition to show: First install (lastSeenVersion is null) OR Update (lastSeenVersion !== currentVersion)
        // Also show if userAlias is null (in case they skipped it before)
        if (lastSeenVersion !== currentVersion || !userAlias || forceWelcomeModal) {
            if (lastSeenVersion !== null && lastSeenVersion !== currentVersion && !forceWelcomeModal) {
                // Perform repair if it's an update (and not just changing alias)
                ScannerService.repairCorruptedData();
            }
            // Pre-fill if they already have an alias
            if (userAlias) {
                setAliasInput(userAlias);
            }
            setVisible(true);
            setStep('alias'); // Always start onboarding at alias step
        }
    }, [lastSeenVersion, currentVersion, userAlias, forceWelcomeModal, visible]);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setShouldRender(false));
        }
    }, [visible, fadeAnim]);

    useEffect(() => {
        if (!visible) return;
        const onBackPress = () => {
            // Prevent backing out of this screen until they finish setup
            return true;
        };
        const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => subscription.remove();
    }, [visible]);

    // Check storage permission when step is 'permission'
    useEffect(() => {
        if (visible && step === 'permission') {
            checkPermission();
        }
    }, [visible, step]);

    const checkPermission = async () => {
        try {
            const status = await MediaLibrary.getPermissionsAsync();
            setPermissionStatus(status.status);
            if (status.status === 'granted' || status.granted) {
                setPermissionGranted(true);
            } else {
                setPermissionGranted(false);
            }
        } catch (error) {
            console.warn('Error checking storage permissions:', error);
        }
    };

    const handleRequestPermission = async () => {
        try {
            const status = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
            setPermissionStatus(status.status);
            if (status.status === 'granted' || status.granted) {
                setPermissionGranted(true);
            } else {
                setPermissionGranted(false);
            }
        } catch (error) {
            console.warn('Error requesting storage permissions:', error);
        }
    };

    const handleContinueAlias = () => {
        const finalAlias = aliasInput.trim();
        if (finalAlias.length > 0) {
            setUserAlias(finalAlias);
        } else if (!userAlias) {
            setUserAlias('');
        }

        // Advance to storage permission screen
        setStep('permission');
    };

    const handleFinishSetup = () => {
        setLastSeenVersion(currentVersion);
        setForceWelcomeModal(false);
        setVisible(false);
        Keyboard.dismiss();
    };

    if (!shouldRender && !visible) return null;

    const renderAliasScreen = () => (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[styles.content, { paddingTop: Math.max(insets.top, 24) }]}>
                <Image
                    source={require('../../assets/images/splash-icon.png')}
                    style={styles.icon}
                    contentFit="contain"
                    tintColor={colors.text}
                />

                <Text style={styles.title}>{t('welcome.title')}</Text>
                <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>

                <TextInput
                    style={styles.input}
                    placeholder={t('welcome.placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={aliasInput}
                    onChangeText={setAliasInput}
                    maxLength={30}
                    onSubmitEditing={handleContinueAlias}
                    returnKeyType="done"
                />

                <TouchableOpacity
                    style={[styles.button, !aliasInput.trim() && !userAlias ? styles.buttonDisabled : null]}
                    onPress={handleContinueAlias}
                    activeOpacity={0.8}
                    disabled={!aliasInput.trim() && !userAlias}
                >
                    <Text style={styles.buttonText}>{t('welcome.continue')}</Text>
                </TouchableOpacity>
            </View>
        </TouchableWithoutFeedback>
    );

    const renderPermissionScreen = () => (
        <View style={[styles.content, { paddingTop: Math.max(insets.top, 24) }]}>
            <Ionicons name="folder-open-outline" size={96} color={colors.accent} style={{ marginBottom: 20 }} />

            <Text style={styles.title}>{t('welcome.permission_title')}</Text>
            <Text style={styles.subtitle}>{t('welcome.permission_subtitle')}</Text>

            <TouchableOpacity
                style={[styles.button, permissionGranted ? styles.buttonSuccess : null, { marginBottom: 16 }]}
                onPress={handleRequestPermission}
                activeOpacity={0.8}
                disabled={permissionGranted}
            >
                <Text style={styles.buttonText}>
                    {permissionGranted ? t('welcome.permission_granted') : t('welcome.permission_grant_btn')}
                </Text>
            </TouchableOpacity>

            {!permissionGranted && permissionStatus === 'denied' && (
                <TouchableOpacity
                    style={[styles.buttonOutline, { marginBottom: 24 }]}
                    onPress={() => Linking.openSettings()}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonOutlineText}>
                        {Platform.OS === 'ios' ? 'Abrir Ajustes' : 'Configuración de la App'}
                    </Text>
                </TouchableOpacity>
            )}

            {!permissionGranted && (
                <Text style={styles.warningText}>
                    {t('welcome.permission_required_warning')}
                </Text>
            )}

            <TouchableOpacity
                style={[styles.button, !permissionGranted ? styles.buttonDisabled : null, { marginTop: 32 }]}
                onPress={() => {
                    if (permissionGranted) {
                        setStep('features');
                    }
                }}
                activeOpacity={0.8}
                disabled={!permissionGranted}
            >
                <Text style={styles.buttonText}>{t('welcome.continue')}</Text>
            </TouchableOpacity>
        </View>
    );

    const renderFeaturesScreen = () => {
        const features = [
            { icon: 'musical-notes-outline', text: t('welcome.features_list_scanner') },
            { icon: 'options-outline', text: t('welcome.features_list_eq') },
            { icon: 'folder-outline', text: t('welcome.features_list_exclusion') },
            { icon: 'tv-outline', text: t('welcome.features_list_cast') },
            { icon: 'time-outline', text: t('welcome.features_list_timer') },
            { icon: 'people-outline', text: t('welcome.features_list_artists') },
            { icon: 'image-outline', text: t('welcome.features_list_images') },
            { icon: 'pricetags-outline', text: t('welcome.features_list_playlists') },
            { icon: 'checkbox-outline', text: t('welcome.features_list_multiselect') },
            { icon: 'play-forward-outline', text: t('welcome.features_list_queue') },
            { icon: 'pulse-outline', text: t('welcome.features_list_visualizers') },
        ];

        return (
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>{t('welcome.features_title')}</Text>
                <Text style={[styles.subtitle, { marginBottom: 24 }]}>{t('welcome.features_subtitle')}</Text>

                {/* Features grid */}
                <View style={styles.featureGrid}>
                    {features.map((feat, idx) => (
                        <View key={idx} style={styles.featureItem2}>
                            <View style={styles.featureIconContainer2}>
                                <Ionicons name={feat.icon as any} size={18} color={colors.accent} />
                            </View>
                            <Text style={styles.featureText2}>{feat.text}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.andMuchMoreText}>{t('welcome.and_much_more')}</Text>

                {/* PRO TIP / TIP CARD */}
                <View style={styles.tipCard}>
                    <View style={styles.tipHeader}>
                        <Text style={styles.tipTitle}>{t('welcome.tip_title')}</Text>
                    </View>
                    <Text style={styles.tipDesc}>{t('welcome.tip_desc')}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, { marginTop: 16 }]}
                    onPress={() => setStep('settings')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>{t('welcome.continue')}</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    };

    const renderSettingsScreen = () => {
        const swipeOptions = [
            { label: t('settings.swipe_action_add_next'), value: 'add_next' },
            { label: t('settings.swipe_action_add_last'), value: 'add_last' },
            { label: t('actions.add_to_playlist'), value: 'add_to_playlist' },
            { label: t('settings.swipe_action_toggle_favorite'), value: 'toggle_favorite' },
            { label: t('settings.swipe_action_none'), value: 'none' },
        ];

        return (
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>{t('welcome.settings_title')}</Text>
                <Text style={[styles.subtitle, { marginBottom: 16 }]}>{t('welcome.settings_subtitle')}</Text>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
                    <Text style={styles.infoText}>{t('welcome.settings_notice')}</Text>
                </View>

                {/* Language Card */}
                <View style={styles.card}>
                    <Text style={styles.cardHeader}>{t('settings.language')}</Text>
                    <View style={styles.languageButtons}>
                        <TouchableOpacity
                            style={[styles.langBtn, language === 'es' && styles.langBtnActive]}
                            onPress={() => setLanguage('es')}
                        >
                            <Text style={styles.langEmoji}>🇪🇸</Text>
                            <Text style={[styles.langText, language === 'es' && styles.langTextActive]}>Español</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                            onPress={() => setLanguage('en')}
                        >
                            <Text style={styles.langEmoji}>🇬🇧</Text>
                            <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>English</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Persistent Player Card */}
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.settingLabel}>{t('settings.keep_awake')}</Text>
                            <Text style={styles.settingDesc}>{t('settings.keep_awake_desc')}</Text>
                        </View>
                        <Switch
                            value={isKeepAwakeEnabled}
                            onValueChange={setIsKeepAwakeEnabled}
                            trackColor={{ false: '#282828', true: colors.accent }}
                            thumbColor={isKeepAwakeEnabled ? '#FFFFFF' : '#888888'}
                        />
                    </View>
                </View>

                {/* Smooth Fade Card */}
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.settingLabel}>{t('settings.audio_section')}</Text>
                            <Text style={styles.settingLabelSub}>Atenuación suave (Fade)</Text>
                            <Text style={styles.settingDesc}>
                                Activa una atenuación suave del volumen al pausar, reanudar o cambiar de canción.
                            </Text>
                        </View>
                        <Switch
                            value={isFadeEnabled}
                            onValueChange={setIsFadeEnabled}
                            trackColor={{ false: '#282828', true: colors.accent }}
                            thumbColor={isFadeEnabled ? '#FFFFFF' : '#888888'}
                        />
                    </View>
                </View>

                {/* Swipe Left Action */}
                <View style={styles.card}>
                    <Text style={styles.cardHeader}>{t('settings.swipe_left')}</Text>
                    <View style={styles.swipeGrid}>
                        {swipeOptions.map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.swipeOptBtn, swipeLeftAction === opt.value && styles.swipeOptBtnActive]}
                                onPress={() => setSwipeLeftAction(opt.value as any)}
                            >
                                <Text style={[styles.swipeOptText, swipeLeftAction === opt.value && styles.swipeOptTextActive]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Swipe Right Action */}
                <View style={styles.card}>
                    <Text style={styles.cardHeader}>{t('settings.swipe_right')}</Text>
                    <View style={styles.swipeGrid}>
                        {swipeOptions.map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.swipeOptBtn, swipeRightAction === opt.value && styles.swipeOptBtnActive]}
                                onPress={() => setSwipeRightAction(opt.value as any)}
                            >
                                <Text style={[styles.swipeOptText, swipeRightAction === opt.value && styles.swipeOptTextActive]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.button, { marginTop: 12, marginBottom: 40 }]}
                    onPress={handleFinishSetup}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>{t('welcome.settings_finish_btn')}</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    };

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: colors.background }]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    {step === 'alias' && renderAliasScreen()}
                    {step === 'permission' && renderPermissionScreen()}
                    {step === 'features' && renderFeaturesScreen()}
                    {step === 'settings' && renderSettingsScreen()}
                </KeyboardAvoidingView>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
        alignItems: 'center',
    },
    icon: {
        width: 100,
        height: 100,
        marginBottom: 8,
    },
    title: {
        color: colors.text,
        fontSize: 32,
        fontFamily: fonts.regular,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 40,
    },
    input: {
        width: '100%',
        height: 56,
        backgroundColor: colors.cardBackground,
        borderRadius: 16,
        paddingHorizontal: 20,
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        textAlign: 'center',
    },
    button: {
        width: '100%',
        height: 56,
        backgroundColor: colors.accent,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    buttonSuccess: {
        backgroundColor: '#10B981',
        shadowColor: '#10B981',
    },
    buttonOutline: {
        width: '100%',
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonOutlineText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '800',
    },
    warningText: {
        color: '#EF4444',
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: '600',
        textAlign: 'center',
        marginHorizontal: 12,
        marginTop: 12,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 64 : 40,
        paddingBottom: 40,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        marginBottom: 20,
    },
    infoText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: '600',
        flex: 1,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    cardHeader: {
        color: colors.text,
        fontSize: 15,
        fontFamily: fonts.regular,
        fontWeight: '800',
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingLabel: {
        color: colors.text,
        fontSize: 15,
        fontFamily: fonts.regular,
        fontWeight: '800',
    },
    settingLabelSub: {
        color: colors.text,
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: '600',
        marginTop: 2,
    },
    settingDesc: {
        color: colors.textSecondary,
        fontSize: 11,
        fontFamily: fonts.regular,
        fontWeight: '600',
        marginTop: 4,
        lineHeight: 14,
    },
    languageButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    langBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        paddingVertical: 12,
        gap: 8,
    },
    langBtnActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderColor: colors.accent,
    },
    langEmoji: {
        fontSize: 20,
    },
    langText: {
        color: '#888888',
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
    langTextActive: {
        color: '#FFFFFF',
    },
    swipeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    swipeOptBtn: {
        flexGrow: 1,
        minWidth: '45%',
        paddingVertical: 10,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swipeOptBtnActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderColor: colors.accent,
    },
    swipeOptText: {
        color: '#888888',
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: '700',
        textAlign: 'center',
    },
    swipeOptTextActive: {
        color: '#FFFFFF',
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        width: '100%',
        marginBottom: 24,
    },
    featureItem2: {
        width: '47%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
        gap: 8,
    },
    featureIconContainer2: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureText2: {
        color: colors.text,
        fontSize: 11,
        fontFamily: fonts.regular,
        fontWeight: '700',
        flex: 1,
    },
    andMuchMoreText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 20,
    },
    tipCard: {
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.2)',
    },
    tipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    tipTitle: {
        color: '#FFD700',
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '900',
    },
    tipDesc: {
        color: colors.text,
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: '600',
        lineHeight: 18,
    },
});
