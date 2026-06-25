
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as NavigationBar from 'expo-navigation-bar';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Animated,
    BackHandler,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import { getActiveTabName, navigationRef } from '../navigation/navigationRef';
import { PlaylistService } from '../services/PlaylistService';
import { ScannerService } from '../services/ScannerService';
import { useArtistsListSheetStore } from '../store/useArtistsListSheetStore';
import { useMetadataEditorStore } from '../store/useMetadataEditorStore';
import { useMultiSelectStore } from '../store/useMultiSelectStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTagManagerStore } from '../store/useTagManagerStore';
import { useToastStore } from '../store/useToastStore';
import { useTrackMenuStore } from '../store/useTrackMenuStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TrackMenuSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { isVisible, selectedTrack, closeMenu, navCallbacks } = useTrackMenuStore();
    const addToQueueNext = usePlayerStore(state => state.addToQueueNext);
    const addToQueueEnd = usePlayerStore(state => state.addToQueueEnd);
    const excludeSong = useSettingsStore(state => state.excludeSong);

    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [artistName, setArtistName] = useState(t('actions.unknown'));

    const handleExclude = () => {
        if (!selectedTrack) return;

        Alert.alert(
            t('actions.exclude_song_title'),
            t('actions.exclude_song_confirm'),
            [
                { text: t('actions.cancel'), style: "cancel" },
                {
                    text: t('actions.exclude'),
                    style: "destructive",
                    onPress: async () => {
                        closeMenu();
                        excludeSong(selectedTrack.fileUrl);
                        await ScannerService.deleteSongContents(selectedTrack.fileUrl);
                    }
                }
            ]
        );
    };

    const handleShare = async () => {
        if (!selectedTrack?.fileUrl) return;
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                closeMenu();
                await Sharing.shareAsync(selectedTrack.fileUrl, {
                    dialogTitle: `Compartir ${selectedTrack.title}`,
                    mimeType: 'audio/*',
                });
            }
        } catch (error) {
            console.error('Error al compartir:', error);
        }
    };

    const [albumId, setAlbumId] = useState<string | null>(null);
    const [artistId, setArtistId] = useState<string | null>(null);
    const [artistsList, setArtistsList] = useState<Artist[]>([]);


    // Valores animados
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Controlar la animación cuando cambia isVisible
    useEffect(() => {
        if (isVisible) {
            // Asegurar que la barra de navegación sea oscura en Android
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
            setArtistName(artists.length > 0 ? artists.map((a: Artist) => a.name).join(', ') : t('actions.unknown'));
            setAlbumId(album?.id || null);
            setArtistId(artists[0]?.id || null);
            setArtistsList(artists);
        };
        loadMetadata();
    }, [selectedTrack, t]);

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
                            <Ionicons name="musical-notes" size={24} color={colors.textSecondary} />
                        </View>
                    )}
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>{selectedTrack?.title}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{artistName}</Text>
                    </View>
                </View>

                {/* Opciones con scroll */}
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                >

                    {/* OPCIÓN: Añadir a continuación */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                            if (selectedTrack) {
                                addToQueueNext(selectedTrack);
                                useToastStore.getState().showToast(t('toasts.playing_next'), 'return-down-forward');
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
                            if (selectedTrack) {
                                addToQueueEnd(selectedTrack);
                                useToastStore.getState().showToast(t('toasts.added_to_queue'), 'list');
                                closeMenu();
                            }
                        }}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="list" size={24} color={colors.text} />
                        </View>
                        <Text style={styles.optionText}>{t('actions.add_to_queue')}</Text>
                    </TouchableOpacity>

                    {/* OPCIÓN: Seleccionar */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                            if (selectedTrack) {
                                closeMenu();
                                useMultiSelectStore.getState().enterSelectionMode(selectedTrack);
                            }
                        }}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="checkmark-circle-outline" size={24} color={colors.text} />
                        </View>
                        <Text style={styles.optionText}>{t('actions.select') || 'Seleccionar'}</Text>
                    </TouchableOpacity>

                    {/* OPCIÓN: Editar Metadatos */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                            if (selectedTrack) {
                                closeMenu();
                                useMetadataEditorStore.getState().openSheet([selectedTrack]);
                            }
                        }}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="pencil" size={24} color={colors.text} />
                        </View>
                        <Text style={styles.optionText}>{t('metadata_editor.title_single') || 'Editar metadatos'}</Text>
                    </TouchableOpacity>

                    {/* OPCIÓN: Gestionar Etiquetas */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                            if (selectedTrack) {
                                closeMenu();
                                useTagManagerStore.getState().openForTrack(selectedTrack);
                            }
                        }}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="pricetag-outline" size={24} color={colors.text} />
                        </View>
                        <Text style={styles.optionText}>{t('tags.manage')}</Text>
                    </TouchableOpacity>

                    {/* OPCIÓN: Añadir a Playlist */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                            if (selectedTrack) {
                                closeMenu();
                                usePlaylistSelectorStore.getState().openSelector(selectedTrack);
                            }
                        }}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
                        </View>
                        <Text style={styles.optionText}>{t('actions.add_to_playlist')}</Text>
                    </TouchableOpacity>

                    {/* OPCIÓN: Eliminar de Playlist (Solo aparece si estamos dentro de una) */}
                    {useTrackMenuStore.getState().playlistId && (
                        <TouchableOpacity
                            style={styles.optionRow}
                            onPress={async () => {
                                if (selectedTrack) {
                                    const pId = useTrackMenuStore.getState().playlistId!;
                                    closeMenu();
                                    await PlaylistService.removeTrackFromPlaylist(pId, selectedTrack.id);
                                }
                            }}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons name="trash-outline" size={24} color={colors.heartIcon} />
                            </View>
                            <Text style={[styles.optionText, { color: colors.heartIcon }]}>{t('actions.remove_from_playlist')}</Text>
                        </TouchableOpacity>
                    )}

                    {/* OPCIÓN: Compartir */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={handleShare}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="share-social-outline" size={24} color={colors.text} />
                        </View>
                        <Text style={styles.optionText}>{t('actions.share')}</Text>
                    </TouchableOpacity>

                    {/* ── Separador ── */}
                    <View style={styles.separator} />

                    {/* OPCIÓN: Ir al álbum */}
                    {albumId && (
                        <TouchableOpacity
                            style={styles.optionRow}
                            onPress={() => {
                                closeMenu();
                                if (navCallbacks.album) {
                                    // Abierto desde el Player: goBack() + navigate con fromPlayer
                                    navCallbacks.album(albumId);
                                } else if (navigationRef.isReady()) {
                                    // Abierto desde lista: navigate directo sin cerrar ninguna pantalla
                                    const rootState = navigationRef.getRootState();
                                    const activeRoute = rootState.routes[rootState.index];
                                    const isPlayerActive = activeRoute?.name === 'Player';

                                    let tabName = getActiveTabName();
                                    if (tabName !== 'Inicio' && tabName !== 'Biblioteca' && tabName !== 'Buscar') {
                                        tabName = 'Biblioteca';
                                    }

                                    const currentTab = getActiveTabName();
                                    if (isPlayerActive || tabName === currentTab) {
                                        navigationRef.navigate('AlbumDetail', { albumId });
                                    } else {
                                        navigationRef.navigate('Main', {
                                            screen: tabName,
                                            params: { screen: 'AlbumDetail', params: { albumId } }
                                        });
                                    }
                                }
                            }}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons name="disc-outline" size={24} color={colors.text} />
                            </View>
                            <Text style={styles.optionText}>{t('actions.go_to_album')}</Text>
                        </TouchableOpacity>
                    )}

                    {/* OPCIÓN: Ver artista */}
                    {artistId && (
                        <TouchableOpacity
                            style={styles.optionRow}
                            onPress={() => {
                                closeMenu();
                                if (artistsList.length > 1) {
                                    useArtistsListSheetStore.getState().openSheet(artistsList);
                                } else if (navCallbacks.artist) {
                                    // Abierto desde el Player: goBack() + navigate con fromPlayer
                                    navCallbacks.artist(artistId);
                                } else if (navigationRef.isReady()) {
                                    // Abierto desde lista: navigate directo sin cerrar ninguna pantalla
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
                            }}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons name="person-outline" size={24} color={colors.text} />
                            </View>
                            <Text style={styles.optionText}>{t('actions.go_to_artist')}</Text>
                        </TouchableOpacity>
                    )}

                    {/* OPCIÓN: Excluir canción */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={handleExclude}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="eye-off-outline" size={24} color={colors.heartIcon} />
                        </View>
                        <Text style={[styles.optionText, { color: colors.heartIcon }]}>{t('actions.exclude_song')}</Text>
                    </TouchableOpacity>

                </ScrollView>
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
        paddingBottom: 0,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        maxHeight: SCREEN_HEIGHT * 0.72,
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
        borderRadius: 8,
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
    separator: {
        height: 1,
        backgroundColor: colors.cardBackground,
        marginVertical: 8,
    },
});
