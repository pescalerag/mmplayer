import { NavigationContainer } from '@react-navigation/native';
import * as Font from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TrackPlayerSync } from './src/components/TrackPlayerSync';
import TrackMenuSheet from './src/components/TrackMenuSheet';
import MainNavigator from './src/navigation/MainNavigator';
import { setupPlayer } from './src/services/trackPlayerSetup';


export default function App() {
    const [fontsLoaded, setFontsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function prepare() {
            try {
                if (Platform.OS === 'android') {
                    await NavigationBar.setBackgroundColorAsync('black');
                    await NavigationBar.setButtonStyleAsync('light');
                }

                await Font.loadAsync({
                    'Montserrat': require('./src/assets/fonts/Montserrat-VariableFont_wght.ttf'),
                    'Montserrat-Italic': require('./src/assets/fonts/Montserrat-Italic-VariableFont_wght.ttf'),
                });

                await setupPlayer();
            } catch (e: any) {
                console.warn('Error en la inicialización:', e);
            } finally {
                setFontsLoaded(true);
                await SplashScreen.hideAsync().catch(() => { });
            }
        }
        prepare().catch((e: any) => {
            console.error('Error fatal en prepare():', e);
            setError(e?.message ?? 'Error desconocido al arrancar');
            setFontsLoaded(true);
            SplashScreen.hideAsync().catch(() => { });
        });
    }, []);

    if (!fontsLoaded) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={styles.loadingText}>Cargando...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>❌ Error al arrancar</Text>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <View style={{ flex: 1, backgroundColor: '#000000' }}>
                <TrackPlayerSync />
                <NavigationContainer theme={{
                    dark: true,
                    colors: {
                        primary: '#8B5CF6',
                        background: '#000000',
                        card: '#121212',
                        text: '#FFFFFF',
                        border: '#282828',
                        notification: '#8B5CF6',
                    },
                    fonts: {
                        regular: { fontFamily: 'Montserrat', fontWeight: '400' },
                        medium: { fontFamily: 'Montserrat', fontWeight: '500' },
                        bold: { fontFamily: 'Montserrat', fontWeight: 'bold' },
                        heavy: { fontFamily: 'Montserrat', fontWeight: '800' },
                    },
                }}>
                    <StatusBar style="light" />
                    <MainNavigator />
                </NavigationContainer>
                <TrackMenuSheet />
            </View>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
        padding: 24,
    },
    loadingText: {
        color: '#aaa',
        marginTop: 12,
        fontSize: 14,
    },
    errorTitle: {
        color: '#ff5555',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    errorText: {
        color: '#fff',
        fontSize: 13,
        textAlign: 'center',
        fontFamily: 'monospace',
    },
});