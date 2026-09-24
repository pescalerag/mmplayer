import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Platform,
    BackHandler,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMigrationStore } from '../../store/useMigrationStore';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function MigrationBlockingModal() {
    const { colors, fonts } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const {
        isVisible,
        orphanCount,
        phase,
        phaseMessage,
        unresolvedCount,
        handleConfirmResponse
    } = useMigrationStore();

    useEffect(() => {
        if (!isVisible) {
            fadeAnim.setValue(0);
            return;
        }

        if (Platform.OS === 'android') {
            NavigationBar.setBackgroundColorAsync('#00000000').catch(() => {});
            NavigationBar.setButtonStyleAsync('light').catch(() => {});
        }

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (phase === 'confirm_delete') {
                handleConfirmResponse('keep');
            }
            return true; // Prevent back press while relocation is in progress
        });

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
        }).start();

        return () => {
            backHandler.remove();
        };
    }, [isVisible, phase]);

    if (!isVisible) return null;

    const isConfirming = phase === 'confirm_delete';
    const isDone = phase === 'done';

    return (
        <View
            style={[
                StyleSheet.absoluteFill,
                {
                    zIndex: 999999,
                    elevation: 999999,
                }
            ]}
            pointerEvents="auto"
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                    <View style={[styles.card, { backgroundColor: '#161616', borderColor: '#2A2A2A' }]}>
                        {/* Icon Header */}
                        {isConfirming ? (
                            <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                                <Ionicons
                                    name="alert-circle-outline"
                                    size={36}
                                    color="#F59E0B"
                                />
                            </View>
                        ) : isDone ? (
                            <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                                <Ionicons
                                    name="checkmark-circle-outline"
                                    size={36}
                                    color="#22C55E"
                                />
                            </View>
                        ) : (
                            <View style={[styles.iconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                                <Ionicons
                                    name="swap-horizontal"
                                    size={36}
                                    color={colors.accent || '#8B5CF6'}
                                />
                            </View>
                        )}

                        {/* Title */}
                        <Text style={[styles.title, { color: colors.text || '#FFFFFF', fontFamily: fonts.bold }]}>
                            {isConfirming
                                ? t('migration.unresolved_title')
                                : t('migration.title')}
                        </Text>

                        {/* Main Explanation */}
                        <Text style={[styles.message, { color: '#B3B3B3', fontFamily: fonts.regular }]}>
                            {isConfirming
                                ? t('migration.unresolved_message', { count: unresolvedCount })
                                : (orphanCount === 1
                                    ? t('migration.detected_message', { count: orphanCount })
                                    : t('migration.detected_message_plural', { count: orphanCount }))}
                        </Text>

                        {/* Dynamic Phase Status with Spinner */}
                        {!isConfirming && !isDone && (
                            <View style={styles.statusRow}>
                                <ActivityIndicator
                                    size="small"
                                    color={colors.accent || '#8B5CF6'}
                                    style={styles.spinner}
                                />
                                <Text
                                    style={[styles.statusText, { color: colors.accent || '#8B5CF6', fontFamily: fonts.semiBold }]}
                                    numberOfLines={1}
                                >
                                    {phaseMessage || t('migration.searching_disk')}
                                </Text>
                            </View>
                        )}

                        {/* Confirmation Action Buttons (3 opciones) */}
                        {isConfirming && (
                            <View style={styles.confirmButtonsColumn}>
                                {/* Opción 1: Los he cambiado de sitio */}
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: colors.accent || '#8B5CF6' }]}
                                    onPress={() => handleConfirmResponse('retry')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={[styles.actionButtonText, { color: '#FFFFFF', fontFamily: fonts.bold }]}>
                                        {t('migration.moved_files')}
                                    </Text>
                                </TouchableOpacity>

                                {/* Opción 2: Eliminar */}
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.deleteActionButton]}
                                    onPress={() => handleConfirmResponse('delete')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={[styles.actionButtonText, { color: '#FFFFFF', fontFamily: fonts.bold }]}>
                                        {t('migration.delete_from_library')}
                                    </Text>
                                </TouchableOpacity>

                                {/* Opción 3: Conservar y continuar (al final) */}
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.keepActionButton]}
                                    onPress={() => handleConfirmResponse('keep')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="bookmark-outline" size={18} color="#D1D5DB" style={{ marginRight: 8 }} />
                                    <Text style={[styles.actionButtonText, { color: '#D1D5DB', fontFamily: fonts.semiBold }]}>
                                        {t('migration.keep_and_continue')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.90)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 12,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    message: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 20,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        width: '100%',
    },
    spinner: {
        marginRight: 10,
    },
    statusText: {
        fontSize: 13,
        flexShrink: 1,
    },
    confirmButtonsColumn: {
        width: '100%',
        gap: 10,
        marginTop: 6,
    },
    actionButton: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    actionButtonText: {
        fontSize: 14,
    },
    deleteActionButton: {
        backgroundColor: '#DC2626',
    },
    keepActionButton: {
        backgroundColor: '#262626',
        borderWidth: 1,
        borderColor: '#3D3D3D',
    },
});
