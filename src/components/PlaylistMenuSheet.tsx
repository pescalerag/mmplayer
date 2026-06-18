import { Ionicons } from '@expo/vector-icons';
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
import { usePlaylistMenuStore } from '../store/usePlaylistMenuStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useToastStore } from '../store/useToastStore';
import { Q } from '@nozbe/watermelondb';
import { navigationRef, getActiveTabName } from '../navigation/navigationRef';
import PlaylistCover from './PlaylistCover';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from "@/hooks/useAppTheme";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlaylistMenuSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { isVisible, selectedPlaylist, closeMenu, navCallbacks } = usePlaylistMenuStore();

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
                    {selectedPlaylist && (
                        <View style={{ marginRight: 16 }}>
                            <PlaylistCover playlistId={selectedPlaylist.id} isFavorites={selectedPlaylist.id === 'favorites'} customCoverUrl={selectedPlaylist.coverCustomUrl} size={56} borderRadius={8} />
                        </View>
                    )}
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>{selectedPlaylist?.name}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{t('library.playlist_singular')}</Text>
                    </View>
                </View>

                {/* OPCIÓN: Fijar/Desfijar */}
                {selectedPlaylist && selectedPlaylist.id !== 'favorites' && (
                    <TouchableOpacity 
                        style={styles.optionRow} 
                        onPress={async () => {
                            if (selectedPlaylist) {
                                await database.write(async () => {
                                    await selectedPlaylist.update((p) => {
                                        p.isPinned = !p.isPinned;
                                    });
                                });
                                closeMenu();
                            }
                        }}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name={selectedPlaylist?.isPinned ? "pin" : "pin-outline"} size={24} color={colors.text} />
                        </View>
                        <Text style={styles.optionText}>{selectedPlaylist?.isPinned ? t('actions.unpin_library') : t('actions.pin_library')}</Text>
                    </TouchableOpacity>
                )}

                {/* OPCIÓN: Añadir a Playlist */}
                {selectedPlaylist && (
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={async () => {
                            if (selectedPlaylist) {
                                try {
                                    const playlistTracks = await database.collections.get<any>('playlist_tracks')
                                        .query(Q.where('playlist_id', selectedPlaylist.id))
                                        .fetch();
                                    
                                    const trackIds = playlistTracks.map((pt: any) => pt.track.id);

                                    if (trackIds.length === 0) {
                                        useToastStore.getState().showToast('La Playlist no tiene canciones', 'close-circle', '#EF4444');
                                        closeMenu();
                                        return;
                                    }

                                    const validTracks = await database.collections.get<any>('tracks')
                                        .query(Q.where('id', Q.oneOf(trackIds)))
                                        .fetch();

                                    closeMenu();
                                    usePlaylistSelectorStore.getState().openSelector(validTracks);
                                } catch (e) {
                                    console.error('Error fetching playlist tracks', e);
                                }
                            }
                        }}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
                        </View>
                        <Text style={styles.optionText}>{t('actions.add_to_playlist') || 'Añadir a playlist'}</Text>
                    </TouchableOpacity>
                )}

                {/* OPCIÓN: Ver playlist */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                        if (selectedPlaylist) {
                            closeMenu();
                            const playlistId = selectedPlaylist.id;
                            if (navCallbacks.detail) {
                                navCallbacks.detail(playlistId);
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
                                    if (playlistId === 'favorites') {
                                        navigationRef.navigate('FavoritesDetail');
                                    } else {
                                        navigationRef.navigate('PlaylistDetail', { playlistId });
                                    }
                                } else {
                                    if (playlistId === 'favorites') {
                                        navigationRef.navigate('Main', {
                                            screen: tabName,
                                            params: { screen: 'FavoritesDetail' }
                                        });
                                    } else {
                                        navigationRef.navigate('Main', {
                                            screen: tabName,
                                            params: { screen: 'PlaylistDetail', params: { playlistId } }
                                        });
                                    }
                                }
                            }
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="list-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('playlist.view')}</Text>
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
