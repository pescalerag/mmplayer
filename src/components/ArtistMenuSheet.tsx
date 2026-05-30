import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { 
    Animated, 
    BackHandler, 
    Dimensions, 
    Platform, 
    StyleSheet, 
    Text, 
    TouchableOpacity, 
    TouchableWithoutFeedback, 
    View 
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import { useArtistMenuStore } from '../store/useArtistMenuStore';
import { navigationRef, getActiveTabName } from '../navigation/navigationRef';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ArtistMenuSheet() {
    const insets = useSafeAreaInsets();
    const { isVisible, selectedArtist, closeMenu, navCallbacks } = useArtistMenuStore();

    // Valores animados
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Controlar la animación cuando cambia isVisible
    useEffect(() => {
        if (isVisible) {
            if (Platform.OS === 'android') {
                NavigationBar.setBackgroundColorAsync('#121212').catch(() => {});
            }

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    useEffect(() => {
        if (!isVisible) return;

        const onBackPress = () => {
            closeMenu();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeMenu]);

    const [shouldRender, setShouldRender] = useState(isVisible);

    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender && !isVisible) return null;

    return (
        <View 
            style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} 
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <TouchableWithoutFeedback onPress={closeMenu}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View 
                style={[
                    styles.sheetContainer, 
                    { 
                        paddingBottom: insets.bottom + 20,
                        transform: [{ translateY: slideAnim }]
                    }
                ]}
            >
                <View style={styles.dragIndicator} />
                
                <View style={styles.header}>
                    {selectedArtist?.imageUrl ? (
                        <Image 
                            source={{ uri: selectedArtist.imageUrl }} 
                            style={styles.thumbnail}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholder]}>
                            <Ionicons name="person" size={24} color="#666" />
                        </View>
                    )}
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>{selectedArtist?.name}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>Artista</Text>
                    </View>
                </View>

                {/* OPCIÓN: Fijar/Desfijar */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={async () => {
                        if (selectedArtist) {
                            await database.write(async () => {
                                await selectedArtist.update((a) => {
                                    a.isPinned = !a.isPinned;
                                });
                            });
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name={selectedArtist?.isPinned ? "pin" : "pin-outline"} size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>{selectedArtist?.isPinned ? "Desfijar de la biblioteca" : "Fijar en la biblioteca"}</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Ver artista */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                        if (selectedArtist) {
                            closeMenu();
                            const artistId = selectedArtist.id;
                            if (navCallbacks.detail) {
                                navCallbacks.detail(artistId);
                            } else if (navigationRef.isReady()) {
                                const rootState = navigationRef.getRootState();
                                const activeRoute = rootState.routes[rootState.index];
                                const isPlayerActive = activeRoute?.name === 'Player';

                                if (isPlayerActive) {
                                    navigationRef.navigate('ArtistDetail', { artistId });
                                } else {
                                    let tabName = getActiveTabName();
                                    if (tabName !== 'Inicio' && tabName !== 'Biblioteca' && tabName !== 'Buscar') {
                                        tabName = 'Biblioteca';
                                    }
                                    navigationRef.navigate('Main', {
                                        screen: tabName,
                                        params: { screen: 'ArtistDetail', params: { artistId } }
                                    });
                                }
                            }
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="person-outline" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Ver artista</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheetContainer: {
        backgroundColor: '#121212',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: '#282828',
    },
    dragIndicator: {
        width: 36,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#282828',
        paddingBottom: 20,
    },
    thumbnail: {
        width: 56,
        height: 56,
        borderRadius: 28, // Circular para artistas
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Montserrat',
        fontWeight: '800',
    },
    subtitle: {
        color: '#B3B3B3',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
        marginTop: 4,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    iconContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    optionText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
});
