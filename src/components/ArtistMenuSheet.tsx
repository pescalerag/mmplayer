import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { Image } from 'expo-image';
import * as NavigationBar from 'expo-navigation-bar';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import Track from '../database/models/Track';
import { getActiveTabName, navigationRef } from '../navigation/navigationRef';
import { useArtistMenuStore } from '../store/useArtistMenuStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useToastStore } from '../store/useToastStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ArtistMenuSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { isVisible, selectedArtist, closeMenu, navCallbacks } = useArtistMenuStore();
    const addMultipleToQueueNext = usePlayerStore(state => state.addMultipleToQueueNext);
    const addMultipleToQueueEnd = usePlayerStore(state => state.addMultipleToQueueEnd);
    const [tracks, setTracks] = useState<Track[]>([]);

    // Cargar tracks del artista
    useEffect(() => {
        if (!selectedArtist) {
            setTracks([]);
            return;
        }

        const loadTracks = async () => {
            try {
                const tracksList = await database.collections.get<Track>('tracks')
                    .query(Q.on('track_collaborators', 'artist_id', selectedArtist.id))
                    .fetch();
                setTracks(tracksList);
            } catch (error) {
                console.error('Error al cargar tracks de ArtistMenuSheet:', error);
            }
        };
        loadTracks();
    }, [selectedArtist]);

    // Valores animados
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Controlar la animación cuando cambia isVisible
    useEffect(() => {
        if (isVisible) {
            if (Platform.OS === 'android') {
                NavigationBar.setBackgroundColorAsync('#121212').catch(() => { });
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
                            <Ionicons name="person" size={24} color={colors.textSecondary} />
                        </View>
                    )}
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>{selectedArtist?.name}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{t('library.artist_singular')}</Text>
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
                        <Ionicons name={selectedArtist?.isPinned ? "pin" : "pin-outline"} size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{selectedArtist?.isPinned ? t('actions.unpin_library') : t('actions.pin_library')}</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir a continuación */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                        if (tracks.length > 0) {
                            addMultipleToQueueNext(tracks);
                            useToastStore.getState().showToast(t('toasts.artist_next'), 'return-down-forward');
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="return-down-forward" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.add_next')}</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir al final */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                        if (tracks.length > 0) {
                            addMultipleToQueueEnd(tracks);
                            useToastStore.getState().showToast(t('toasts.artist_queued'), 'list');
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="list" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.add_to_queue')}</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir a Playlist */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                        if (tracks.length === 0) {
                            useToastStore.getState().showToast('El artista no tiene canciones', 'close-circle', '#EF4444');
                            closeMenu();
                            return;
                        }
                        closeMenu();
                        usePlaylistSelectorStore.getState().openSelector(tracks);
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="add-circle-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.add_to_playlist') || 'Añadir a playlist'}</Text>
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

                                let tabName = getActiveTabName();
                                if (tabName !== 'Inicio' && tabName !== 'Biblioteca' && tabName !== 'Buscar') {
                                    tabName = 'Biblioteca';
                                }

                                const currentTab = getActiveTabName();
                                if (isPlayerActive || tabName === currentTab) {
                                    navigationRef.navigate('ArtistDetail', { artistId });
                                } else {
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
                        <Ionicons name="person-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.go_to_artist')}</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
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
        borderColor: colors.cardBackground,
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
        borderBottomColor: colors.cardBackground,
        paddingBottom: 20,
    },
    thumbnail: {
        width: 56,
        height: 56,
        borderRadius: 28, // Circular para artistas
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: colors.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontFamily: fonts.regular,
        fontWeight: '800',
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
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
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
});
