import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableWithoutFeedback
} from 'react-native';
import { useZipStore } from '../../store/useZipStore';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function ZipProgressModal() {
    const { colors, fonts } = useAppTheme();
    const { isVisible, progressMessage } = useZipStore();

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="fade"
            onRequestClose={() => {}}
        >
            <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.card, { backgroundColor: '#161616', borderColor: '#282828' }]}>
                            <ActivityIndicator
                                size="large"
                                color={colors.accent}
                                style={styles.spinner}
                            />
                            <Text style={[styles.message, { color: colors.text || '#FFFFFF', fontFamily: fonts.regular }]}>
                                {progressMessage}
                            </Text>
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
    spinner: {
        marginBottom: 20,
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
});
