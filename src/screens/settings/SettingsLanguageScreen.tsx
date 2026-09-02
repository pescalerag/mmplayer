import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function SettingsLanguageScreen() {
    const { language, setLanguage } = useSettingsStore();
    const { t } = useTranslation();
    const { colors } = useAppTheme();

    return (
        <ScreenHeaderLayout title={t('settings.language')}>
            {({ headerHeight, bottomPadding }) => (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: headerHeight + 20,
                            paddingBottom: bottomPadding
                        }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.sectionCard}>
                        <View style={styles.languageContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.languageButton,
                                    language === 'es' && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent }
                                ]}
                                onPress={() => setLanguage('es')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.flagEmoji}>🇪🇸</Text>
                                <Text style={[
                                    styles.languageText,
                                    language === 'es' && { color: colors.accent, fontWeight: '700' }
                                ]}>Español</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.languageButton,
                                    language === 'en' && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent }
                                ]}
                                onPress={() => setLanguage('en')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.flagEmoji}>🇬🇧</Text>
                                <Text style={[
                                    styles.languageText,
                                    language === 'en' && { color: colors.accent, fontWeight: '700' }
                                ]}>English</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            )}
        </ScreenHeaderLayout>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    languageContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    languageButton: {
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
    languageButtonActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderColor: '#8B5CF6',
    },
    flagEmoji: {
        fontSize: 20,
    },
    languageText: {
        color: '#888888',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    languageTextActive: {
        color: '#FFFFFF',
    },
});
