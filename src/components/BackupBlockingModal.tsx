import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBackupStore } from '../store/useBackupStore';
import { useAppTheme } from '../hooks/useAppTheme';

export default function BackupBlockingModal() {
    const { colors, fonts } = useAppTheme();
    const { isVisible, mode, progressMessage, close } = useBackupStore();

    const isFinished = mode === 'success' || mode === 'error';

    const handleBackdropPress = () => {
        if (isFinished) {
            close();
        }
    };

    const handleRequestClose = () => {
        if (isFinished) {
            close();
        }
    };

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="fade"
            onRequestClose={handleRequestClose}
        >
            <TouchableWithoutFeedback onPress={handleBackdropPress}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.card, { backgroundColor: '#161616', borderColor: '#282828' }]}>
                            {mode === 'error' && (
                                <Ionicons
                                    name="alert-circle-outline"
                                    size={56}
                                    color="#EF4444"
                                    style={styles.icon}
                                />
                            )}
                            {mode === 'success' && (
                                <Ionicons
                                    name="checkmark-circle-outline"
                                    size={56}
                                    color="#22C55E"
                                    style={styles.icon}
                                />
                            )}
                            {!isFinished && (
                                <ActivityIndicator
                                    size="large"
                                    color={colors.accent || '#8B5CF6'}
                                    style={styles.spinner}
                                />
                            )}

                            <Text style={[styles.message, { color: colors.text || '#FFFFFF', fontFamily: fonts.regular }]}>
                                {progressMessage}
                            </Text>

                            {isFinished && (
                                <TouchableOpacity
                                    style={[
                                        styles.button,
                                        { backgroundColor: mode === 'error' ? '#EF4444' : (colors.accent || '#8B5CF6') }
                                    ]}
                                    onPress={close}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.buttonText, { fontFamily: fonts.bold }]}>
                                        {mode === 'error' ? 'Cerrar' : 'Aceptar'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.90)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 320,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
    },
    icon: {
        marginBottom: 16,
    },
    spinner: {
        marginBottom: 20,
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    button: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
