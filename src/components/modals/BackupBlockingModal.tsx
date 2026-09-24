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
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackupStore } from '../../store/useBackupStore';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function BackupBlockingModal() {
    const { colors, fonts } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { isVisible, mode, progressMessage, close } = useBackupStore();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const isFinished = mode === 'success' || mode === 'error';

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
            if (isFinished) {
                close();
            }
            return true; // Prevent back press while backup/restore is ongoing
        });

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
        }).start();

        return () => {
            backHandler.remove();
        };
    }, [isVisible, isFinished]);

    if (!isVisible) return null;

    const handleBackdropPress = () => {
        if (isFinished) {
            close();
        }
    };

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
                <TouchableWithoutFeedback onPress={handleBackdropPress}>
                    <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>
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
                                <Text style={[styles.buttonText, { fontFamily: fonts.bold }, mode !== 'error' && { color: colors.onAccent }]}>
                                    {mode === 'error' ? 'Cerrar' : 'Aceptar'}
                                </Text>
                            </TouchableOpacity>
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
