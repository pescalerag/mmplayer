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
import { Q } from '@nozbe/watermelondb';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { database } from '../database';
import { usePlayerStore } from '../store/usePlayerStore';
import { useAlbumMenuStore } from '../store/useAlbumMenuStore';
import { useTagManagerStore } from '../store/useTagManagerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { navigationRef, getActiveTabName } from '../navigation/navigationRef';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AlbumMenuSheet() {
    const insets = useSafeAreaInsets();
    const { isVisible, selectedAlbum, closeMenu, navCallbacks } = useAlbumMenuStore();
    const addMultipleToQueueNext = usePlayerStore(state => state.addMultipleToQueueNext);
    const addMultipleToQueueEnd = usePlayerStore(state => state.addMultipleToQueueEnd);
    
    const [artistName, setArtistName] = useState('Desconocido');
    const [artistId, setArtistId] = useState<string | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);

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

    // Cargar metadatos y tracks
    useEffect(() => {
        if (!selectedAlbum) return;
        
        const loadTracksAndMetadata = async () => {
            try {
                const [artistDoc, tracksList] = await Promise.all([
                    selectedAlbum.artist.fetch() as Promise<Artist | null>,
                    database.collections.get<Track>('tracks').query(
                        Q.where('album_id', selectedAlbum.id),
                        Q.sortBy('disc_number', Q.asc),
                        Q.sortBy('track_number', Q.asc)
                    ).fetch() as Promise<Track[]>
                ]);
                setArtistName(artistDoc?.name || 'Desconocido');
                setArtistId(artistDoc?.id || null);
                setTracks(tracksList);
            } catch (error) {
                console.error('Error al cargar tracks de AlbumMenuSheet:', error);
            }
        };
        loadTracksAndMetadata();
    }, [selectedAlbum]);

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
                    {selectedAlbum?.coverUrl ? (
                        <Image 
                            source={{ uri: selectedAlbum.coverUrl }} 
                            style={styles.thumbnail}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholder]}>
                            <Ionicons name="albums" size={24} color="#666" />
                        </View>
                    )}
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>{selectedAlbum?.title}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{artistName}</Text>
                    </View>
                </View>

                {/* OPCIÓN: Añadir todo a continuación */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (tracks.length > 0) {
                            addMultipleToQueueNext(tracks);
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="return-down-forward" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Añadir a continuación</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir todo al final */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (tracks.length > 0) {
                            addMultipleToQueueEnd(tracks);
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="list" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Añadir al final de la cola</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Gestionar Etiquetas */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (selectedAlbum) {
                            closeMenu();
                            useTagManagerStore.getState().openForAlbum(selectedAlbum);
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="pricetag-outline" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Gestionar etiquetas</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir a Playlist */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (tracks.length > 0) {
                            closeMenu();
                            usePlaylistSelectorStore.getState().openSelector(tracks);
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Añadir a Playlist</Text>
                </TouchableOpacity>

                {/* ── Separador ── */}
                <View style={styles.separator} />

                {/* OPCIÓN: Ver artista */}
                {artistId && (
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                            closeMenu();
                            if (navCallbacks.artist) {
                                navCallbacks.artist(artistId);
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
                        }}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="person-outline" size={24} color="#FFFFFF" />
                        </View>
                        <Text style={styles.optionText}>Ver artista</Text>
                    </TouchableOpacity>
                )}
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
    separator: {
        height: 1,
        backgroundColor: '#282828',
        marginVertical: 8,
    },
});
