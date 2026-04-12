
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
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTrackMenuStore } from '../store/useTrackMenuStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TrackMenuSheet() {
    const insets = useSafeAreaInsets();
    const { isVisible, selectedTrack, closeMenu } = useTrackMenuStore();
    const addToQueueNext = usePlayerStore(state => state.addToQueueNext);
    const addToQueueEnd = usePlayerStore(state => state.addToQueueEnd);
    
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [artistName, setArtistName] = useState('Desconocido');

    // Valores animados
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Controlar la animación cuando cambia isVisible
    useEffect(() => {
        if (isVisible) {
            // Asegurar que la barra de navegación sea oscura en Android
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
            return true; // Interceptamos el evento para no salir de la app
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeMenu]);

    // Cargar metadatos básicos para la cabecera del menú
    useEffect(() => {
        if (!selectedTrack) return;
        
        const loadMetadata = async () => {
            const [album, artists] = await Promise.all([
                selectedTrack.album.fetch() as Promise<Album | null>,
                selectedTrack.queryCollaborators.fetch() as Promise<Artist[]>
            ]);
            setImageUrl(album?.coverUrl || null);
            setArtistName(artists.length > 0 ? artists.map((a: Artist) => a.name).join(', ') : 'Desconocido');
        };
        loadMetadata();
    }, [selectedTrack]);

    // Ocultar completamente el componente cuando no está visible para no interceptar toques
    // Pero dejamos que termine la animación
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
            {/* Fondo oscuro animado con Fade */}
            <TouchableWithoutFeedback onPress={closeMenu}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            {/* Contenedor del Menú animado con Slide */}
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
                
                {/* Cabecera del Menú */}
                <View style={styles.header}>
                    {imageUrl ? (
                        <Image 
                            source={{ uri: imageUrl }} 
                            style={styles.thumbnail}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholder]}>
                            <Ionicons name="musical-notes" size={24} color="#666" />
                        </View>
                    )}
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>{selectedTrack?.title}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{artistName}</Text>
                    </View>
                </View>

                {/* OPCIÓN: Añadir a continuación */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (selectedTrack) {
                            addToQueueNext(selectedTrack);
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="return-down-forward" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Añadir a continuación</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir al final */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (selectedTrack) {
                            addToQueueEnd(selectedTrack);
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="list" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Añadir al final de la cola</Text>
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
        borderRadius: 8,
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
