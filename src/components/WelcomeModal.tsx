import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Animated,
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    TouchableWithoutFeedback
} from 'react-native';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { useSettingsStore } from '../store/useSettingsStore';
import { ScannerService } from '../services/ScannerService';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from "@/hooks/useAppTheme";

export default function WelcomeModal() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const { t } = useTranslation();

    const [visible, setVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [aliasInput, setAliasInput] = useState('');

    const { lastSeenVersion, setLastSeenVersion, userAlias, setUserAlias, forceWelcomeModal, setForceWelcomeModal } = useSettingsStore();
    const currentVersion = Constants.expoConfig?.version || '1.1.0';

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
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
        }
    }, [lastSeenVersion, currentVersion, userAlias, forceWelcomeModal]);

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
            // Prevent backing out of this screen until they provide an alias and continue
            return true;
        };
        const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => subscription.remove();
    }, [visible]);

    const handleContinue = () => {
        const finalAlias = aliasInput.trim();
        if (finalAlias.length > 0) {
            setUserAlias(finalAlias);
        } else if (!userAlias) {
            // If they leave it blank and have no alias, we could enforce it or just set a default.
            // Let's just set it to 'User' or ignore, but the prompt asked for "alias" so it's good to enforce briefly or just save blank.
            setUserAlias(''); // Allow blank if they really want
        }
        
        setLastSeenVersion(currentVersion);
        setForceWelcomeModal(false);
        setVisible(false);
        Keyboard.dismiss();
    };

    if (!shouldRender && !visible) return null;

    return (
        <View 
            style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: colors.background }]} 
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <View style={styles.content}>
                            <Image
                                source={require('../assets/images/splash-icon.png')}
                                style={styles.icon}
                                contentFit="contain"
                                tintColor={colors.text} // In case it needs tinting to be visible
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
                                onSubmitEditing={handleContinue}
                                returnKeyType="done"
                            />

                            <TouchableOpacity 
                                style={[styles.button, !aliasInput.trim() && !userAlias ? styles.buttonDisabled : null]} 
                                onPress={handleContinue}
                                activeOpacity={0.8}
                                disabled={!aliasInput.trim() && !userAlias}
                            >
                                <Text style={styles.buttonText}>{t('welcome.continue')}</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
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
        alignItems: 'flex-start',
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
        textAlign: 'left',
        marginBottom: 12,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '600',
        textAlign: 'left',
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
        textAlign: 'left',
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
});
