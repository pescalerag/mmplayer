import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#000000', '#22222221', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Capa de Humo (Igual que en Biblioteca) */}
            <LinearGradient
                colors={['#000000', 'rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.7)', 'transparent']}
                locations={[0, 0.4, 0.7, 1]}
                style={styles.smokeEffect}
                pointerEvents="none"
            />

            {/* 3. CAPA DE LA INTERFAZ (FRENTE) */}
            <View style={[styles.content, { paddingTop: insets.top + 10 }]}>
                <Text style={styles.title}>Inicio</Text>
                <Text style={styles.subtext}>Tu música recomendada aparecerá aquí pronto.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        zIndex: 2,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 32,
        fontFamily: 'Montserrat',
        fontWeight: '900',
    },
    subtext: {
        color: '#9A9A9A',
        fontSize: 16,
        fontFamily: 'Montserrat',
        marginTop: 8,
        fontWeight: '500',
    },
    smokeEffect: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160,
        zIndex: 1,
    }
});