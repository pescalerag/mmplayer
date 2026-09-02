import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSettingsStore, UserTier } from '../../store/useSettingsStore';
import { PurchasesService } from '../../services/PurchasesService';

interface HallOfFameModalProps {
    visible: boolean;
    onClose: () => void;
    tier?: UserTier;
    onSuccess?: (savedAlias: string) => void;
}

export const HallOfFameModal: React.FC<HallOfFameModalProps> = ({
    visible,
    onClose,
    tier = 'SUPPORTER',
    onSuccess,
}) => {
    const { t } = useTranslation();
    const { colors, fonts } = useAppTheme();
    const userAlias = useSettingsStore((state) => state.userAlias);
    const setUserAlias = useSettingsStore((state) => state.setUserAlias);

    const [aliasInput, setAliasInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isVip = tier === 'VIP';
    const accentColor = isVip ? '#FBBF24' : '#2DD4BF';

    useEffect(() => {
        if (visible) {
            setAliasInput(userAlias || '');
        }
    }, [visible, userAlias]);

    const handleSave = async () => {
        const trimmed = aliasInput.trim();
        if (!trimmed) {
            Alert.alert(t('actions.error'), t('support.hall_of_fame.modal.input_placeholder'));
            return;
        }

        setIsSubmitting(true);
        try {
            // Guardar alias en RevenueCat
            await PurchasesService.setHallOfFameAlias(trimmed, tier);

            // Si el usuario no tenía alias en su perfil local, lo sincronizamos también
            if (!userAlias) {
                setUserAlias(trimmed);
            }

            Alert.alert(
                '✓',
                t('support.hall_of_fame.modal.success_message'),
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            if (onSuccess) onSuccess(trimmed);
                            onClose();
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Error saving Hall of Fame alias:', error);
            Alert.alert(t('actions.error'), 'No se pudo guardar el alias.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.backdrop}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFillObject}
                    activeOpacity={1}
                    onPress={onClose}
                />

                <View style={[styles.modalCard, { backgroundColor: colors.cardBackground || '#1E1E1E' }]}>
                    <LinearGradient
                        colors={
                            isVip
                                ? ['rgba(245, 158, 11, 0.22)', 'rgba(0, 0, 0, 0)']
                                : ['rgba(20, 184, 166, 0.22)', 'rgba(0, 0, 0, 0)']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                    />

                    {/* Icono Cabecera */}
                    <View
                        style={[
                            styles.iconContainer,
                            {
                                backgroundColor: isVip
                                    ? 'rgba(245, 158, 11, 0.2)'
                                    : 'rgba(20, 184, 166, 0.2)',
                            },
                        ]}
                    >
                        {isVip ? (
                            <MaterialCommunityIcons name="crown" size={32} color="#FBBF24" />
                        ) : (
                            <Ionicons name="heart" size={28} color="#2DD4BF" />
                        )}
                    </View>

                    {/* Título */}
                    <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
                        {isVip
                            ? t('support.hall_of_fame.modal.title_vip')
                            : t('support.hall_of_fame.modal.title_supporter')}
                    </Text>

                    {/* Descripción */}
                    <Text style={[styles.description, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                        {t('support.hall_of_fame.modal.description')}
                    </Text>

                    {/* Input Field */}
                    <View style={styles.inputWrapper}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                            {t('support.hall_of_fame.modal.input_label')}
                        </Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    color: colors.text,
                                    borderColor: accentColor,
                                    backgroundColor: colors.background || '#121212',
                                },
                            ]}
                            placeholder={t('support.hall_of_fame.modal.input_placeholder')}
                            placeholderTextColor={colors.textSecondary || '#888'}
                            value={aliasInput}
                            onChangeText={setAliasInput}
                            maxLength={30}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />
                        <Text style={[styles.counterText, { color: colors.textSecondary }]}>
                            {aliasInput.length}/30
                        </Text>
                    </View>

                    {/* Nota de moderación manual */}
                    <View style={styles.moderationBox}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={accentColor} style={{ marginTop: 2 }} />
                        <Text style={[styles.moderationText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                            {t('support.hall_of_fame.modal.moderation_note')}
                        </Text>
                    </View>

                    {/* Botones de acción */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                { backgroundColor: accentColor },
                            ]}
                            onPress={handleSave}
                            disabled={isSubmitting}
                            activeOpacity={0.8}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color="#000000" />
                            ) : (
                                <Text style={[styles.saveButtonText, { fontFamily: fonts.bold }]}>
                                    {t('support.hall_of_fame.modal.save_button')}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.skipButton}
                            onPress={onClose}
                            disabled={isSubmitting}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.skipButtonText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                                {t('support.hall_of_fame.modal.skip_button')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 19,
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    inputWrapper: {
        width: '100%',
        marginBottom: 14,
    },
    inputLabel: {
        fontSize: 12,
        marginBottom: 6,
        fontWeight: '600',
    },
    textInput: {
        width: '100%',
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        borderWidth: 1.5,
    },
    counterText: {
        alignSelf: 'flex-end',
        fontSize: 11,
        marginTop: 4,
    },
    moderationBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        width: '100%',
    },
    moderationText: {
        flex: 1,
        fontSize: 11.5,
        lineHeight: 16,
    },
    buttonContainer: {
        width: '100%',
        gap: 10,
    },
    saveButton: {
        width: '100%',
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#000000',
        fontSize: 14,
    },
    skipButton: {
        width: '100%',
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 13,
    },
});
