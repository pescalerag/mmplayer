import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useMigrationStore } from '../../store/useMigrationStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useBackupStore } from '../../store/useBackupStore';

export default function PortugueseLanguageModal() {
    const { colors, fonts } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const fade = useRef(new Animated.Value(0)).current;
    const offer = useSettingsStore(state => state.portugueseLanguageOffer);
    const forceWelcome = useSettingsStore(state => state.forceWelcomeModal);
    const relocating = useMigrationStore(state => state.isVisible);
    const scanning = useSyncStore(state => state.isScanning);
    const backingUp = useBackupStore(state => state.isVisible);
    const visible = offer === 'pending' && !forceWelcome && !relocating && !scanning && !backingUp;

    useEffect(() => {
        if (!visible) {
            fade.setValue(0);
            return;
        }
        const animation = Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true });
        animation.start();
        const back = BackHandler.addEventListener('hardwareBackPress', () => {
            useSettingsStore.getState().setPortugueseLanguageOffer('handled');
            return true;
        });
        return () => {
            animation.stop();
            back.remove();
        };
    }, [visible, fade]);

    if (!visible) return null;
    return (
        <Animated.View style={[styles.overlay, { opacity: fade, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.card} accessibilityViewIsModal>
                <View style={[styles.iconCircle, { backgroundColor: colors.accentAlpha15 }]}>
                    <Ionicons name="language-outline" size={36} color={colors.accent} />
                </View>
                <Text style={[styles.title, { fontFamily: fonts.bold }]}>{t('language_offer.title')}</Text>
                <Text style={[styles.message, { fontFamily: fonts.regular }]}>{t('language_offer.message')}</Text>
                <View style={styles.buttons}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        style={[styles.button, { backgroundColor: colors.accent }]}
                        onPress={() => useSettingsStore.getState().setLanguage('pt')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.buttonText, { fontFamily: fonts.bold }]}>{t('language_offer.confirm')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        accessibilityRole="button"
                        style={[styles.button, styles.secondaryButton]}
                        onPress={() => useSettingsStore.getState().setPortugueseLanguageOffer('handled')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.buttonText, { color: '#D1D5DB', fontFamily: fonts.semiBold }]}>{t('language_offer.keep')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 999998, elevation: 999998, backgroundColor: 'rgba(0, 0, 0, 0.90)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    card: { width: '100%', maxWidth: 340, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, backgroundColor: '#161616', borderColor: '#2A2A2A', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 12 },
    iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 18, color: '#FFFFFF', textAlign: 'center', marginBottom: 10 },
    message: { fontSize: 14, color: '#B3B3B3', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
    buttons: { width: '100%', gap: 10, marginTop: 6 },
    button: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12 },
    secondaryButton: { backgroundColor: '#262626', borderWidth: 1, borderColor: '#3D3D3D' },
    buttonText: { fontSize: 14, color: '#FFFFFF', textAlign: 'center' },
});
