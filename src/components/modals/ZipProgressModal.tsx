import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Platform,
    BackHandler,
    Animated,
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useZipStore } from '../../store/useZipStore';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function ZipProgressModal() {
    const { colors, fonts } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { isVisible, progressMessage } = useZipStore();
    const fadeAnim = useRef(new Animated.Value(0)).current;

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
            return true; // Prevent back press while zip operation is running
        });

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
        }).start();

        return () => {
            backHandler.remove();
        };
    }, [isVisible]);

    if (!isVisible) return null;

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
                    <View style={[styles.card, { backgroundColor: '#161616', borderColor: '#282828' }]}>
                        <ActivityIndicator
                            size="large"
                            color={colors.accent || '#8B5CF6'}
                            style={styles.spinner}
                        />
                        <Text style={[styles.message, { color: colors.text || '#FFFFFF', fontFamily: fonts.regular }]}>
                            {progressMessage}
                        </Text>
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
    spinner: {
        marginBottom: 20,
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
});
