import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    AlertButton,
    Animated,
    BackHandler,
    Dimensions,
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Playlist from '../database/models/Playlist';
import { PlaylistService } from '../services/PlaylistService';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useToastStore } from '../store/useToastStore';
import PlaylistCover from './PlaylistCover';
import { useTranslation } from 'react-i18next';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlaylistSelectorModal() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { isVisible, tracksToAssociate, playlistToEdit, isCreatingDirectly, closeSelector } = usePlaylistSelectorStore();

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [playlistName, setPlaylistName] = useState('');
    const [playlistDesc, setPlaylistDesc] = useState('');

    // Animaciones
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const keyboardHeight = useRef(new Animated.Value(0)).current;

    const loadPlaylists = async () => {
        try {
            const list = await PlaylistService.getAllPlaylists();
            setPlaylists(list);
        } catch (e) {
            console.error('Error cargando playlists:', e);
        }
    };

    useEffect(() => {
        if (isVisible) {
            loadPlaylists();
            if (playlistToEdit) {
                setIsCreating(true);
                setPlaylistName(playlistToEdit.name || '');
                setPlaylistDesc(playlistToEdit.description || '');
            } else if (isCreatingDirectly) {
                setIsCreating(true);
                setPlaylistName('');
                setPlaylistDesc('');
            } else {
                setIsCreating(false);
                setPlaylistName('');
                setPlaylistDesc('');
            }

            // Animación de entrada
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
            // Animación de salida
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
    }, [isVisible, fadeAnim, slideAnim, playlistToEdit, isCreatingDirectly]);

    // Manejar botón de atrás en Android
    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => {
            if (isCreating) {
                if (playlistToEdit || isCreatingDirectly) {
                    closeSelector();
                } else {
                    setIsCreating(false);
                }
            } else {
                closeSelector();
            }
            return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, isCreating, closeSelector, playlistToEdit, isCreatingDirectly]);

    // Manejar altura del teclado en iOS y Android
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, (e) => {
            Animated.timing(keyboardHeight, {
                toValue: e.endCoordinates.height,
                duration: 250,
                useNativeDriver: false,
            }).start();
        });

        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            Animated.timing(keyboardHeight, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
            }).start();
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [keyboardHeight]);

    const handleDuplicateTracks = (playlistId: string, existingTrackIds: string[], duplicateTracks: typeof tracksToAssociate) => {
        const showToast = (count: number) => {
            const msg = count === 1 ? t('toasts.added_to_playlist') : t('toasts.added_to_playlist_plural', { count });
            useToastStore.getState().showToast(msg, 'list-circle');
        };

        if (tracksToAssociate.length === 1) {
            const singleTrack = tracksToAssociate[0];
            Alert.alert(
                t('actions.duplicate_song_title'),
                t('actions.duplicate_song_confirm', { title: singleTrack.title }),
                [
                    { text: t('actions.cancel'), style: "cancel" },
                    { text: t('actions.add'), onPress: async () => { await PlaylistService.addMultipleTracksToPlaylist(playlistId, [singleTrack.id]); showToast(1); closeSelector(); } }
                ]
            );
            return;
        }

        const newTracks = tracksToAssociate.filter(t => !existingTrackIds.includes(t.id));
        const buttons: AlertButton[] = [{ text: t('actions.cancel'), style: "cancel" }];

        if (newTracks.length > 0) {
            buttons.push({ text: t('actions.only_new'), onPress: async () => { await PlaylistService.addMultipleTracksToPlaylist(playlistId, newTracks.map(t => t.id)); showToast(newTracks.length); closeSelector(); } });
        }
        buttons.push({ text: t('actions.add_all'), onPress: async () => { await PlaylistService.addMultipleTracksToPlaylist(playlistId, tracksToAssociate.map(t => t.id)); showToast(tracksToAssociate.length); closeSelector(); } });

        const message = newTracks.length > 0
            ? t('actions.duplicate_songs_partial', { duplicateCount: duplicateTracks.length, totalCount: tracksToAssociate.length })
            : t('actions.duplicate_songs_all', { count: duplicateTracks.length });

        Alert.alert(t('actions.duplicate_songs_title'), message, buttons);
    };

    const handleSelectPlaylist = async (playlistId: string) => {
        if (tracksToAssociate.length === 0) return;
        try {
            const existingTrackIds = await PlaylistService.getTrackIdsInPlaylist(playlistId);
            const duplicateTracks = tracksToAssociate.filter(t => existingTrackIds.includes(t.id));

            if (duplicateTracks.length > 0) {
                handleDuplicateTracks(playlistId, existingTrackIds, duplicateTracks);
            } else {
                await PlaylistService.addMultipleTracksToPlaylist(playlistId, tracksToAssociate.map(t => t.id));
                const msg = tracksToAssociate.length === 1 ? t('toasts.added_to_playlist') : t('toasts.added_to_playlist_plural', { count: tracksToAssociate.length });
                useToastStore.getState().showToast(msg, 'list-circle');
                closeSelector();
            }
        } catch (e) {
            console.error('Error añadiendo canciones a playlist:', e);
        }
    };

    const handleSavePlaylist = async () => {
        if (!playlistName.trim()) return;
        try {
            if (playlistToEdit) {
                await PlaylistService.updatePlaylist(playlistToEdit.id, playlistName, playlistDesc);
            } else {
                const playlist = await PlaylistService.createPlaylist(playlistName, playlistDesc);
                if (tracksToAssociate.length > 0) {
                    const trackIds = tracksToAssociate.map(t => t.id);
                    await PlaylistService.addMultipleTracksToPlaylist(playlist.id, trackIds);
                    const msg = tracksToAssociate.length === 1 ? t('toasts.added_to_new_playlist') : t('toasts.added_to_new_playlist_plural', { count: tracksToAssociate.length });
                    useToastStore.getState().showToast(msg, 'list-circle');
                } else {
                    useToastStore.getState().showToast(t('toasts.playlist_created'), 'list-circle');
                }
            }
            Keyboard.dismiss();
            closeSelector();
        } catch (e) {
            console.error('Error guardando playlist:', e);
        }
    };

    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender) return null;

    const subtitleText = tracksToAssociate.length === 1
        ? t('actions.add_song_to', { title: tracksToAssociate[0].title })
        : t('actions.add_songs_to', { count: tracksToAssociate.length });

    return (
        <View
            style={[styles.containerAbsolute, { zIndex: 10000 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            {/* Fondo oscuro animado */}
            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); closeSelector(); }}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            {/* Contenedor del bottom sheet */}
            <Animated.View 
                pointerEvents="box-none"
                style={[
                    styles.keyboardAvoid, 
                    { paddingBottom: keyboardHeight }
                ]}
            >
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

                    {!isCreating ? (
                        <>
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>{t('actions.add_to_playlist')}</Text>
                                <Text style={styles.headerSubtitle} numberOfLines={1}>
                                    {subtitleText}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.createButton}
                                onPress={() => setIsCreating(true)}
                            >
                                <Ionicons name="add" size={20} color="#FFFFFF" />
                                <Text style={styles.createButtonText}>{t('playlist.create_new_playlist')}</Text>
                            </TouchableOpacity>

                            <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
                                {playlists.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="musical-notes-outline" size={48} color="#444" />
                                        <Text style={styles.emptyText}>{t('library.empty_playlists')}</Text>
                                    </View>
                                ) : (
                                    playlists.map(pl => (
                                        <TouchableOpacity
                                            key={pl.id}
                                            style={styles.playlistItem}
                                            onPress={() => handleSelectPlaylist(pl.id)}
                                        >
                                            <PlaylistCover playlistId={pl.id} size={48} customCoverUrl={pl.coverCustomUrl} />
                                            <View style={styles.playlistInfo}>
                                                <Text style={styles.playlistName} numberOfLines={1}>{pl.name}</Text>
                                                <Text style={styles.playlistDesc} numberOfLines={1}>
                                                    {pl.description || t('playlist.no_description')}
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={18} color="#555" />
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </>
                    ) : (
                        <View>
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>
                                    {playlistToEdit ? t('playlist.edit') : t('playlist.new')}
                                </Text>
                                <Text style={styles.headerSubtitle}>
                                    {playlistToEdit ? t('playlist.modify_details') : t('playlist.personalize')}
                                </Text>
                            </View>

                            <Text style={styles.sectionTitle}>{t('playlist.name')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('playlist.placeholder_name')}
                                placeholderTextColor="#666"
                                value={playlistName}
                                onChangeText={setPlaylistName}
                                maxLength={30}
                                autoFocus
                                autoCorrect={false}
                            />

                            <Text style={styles.sectionTitle}>{t('playlist.description')}</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder={t('playlist.placeholder_desc')}
                                placeholderTextColor="#666"
                                value={playlistDesc}
                                onChangeText={setPlaylistDesc}
                                maxLength={120}
                                multiline
                                numberOfLines={3}
                            />

                            <View style={styles.formButtons}>
                                <TouchableOpacity
                                    style={[styles.btn, styles.btnCancel]}
                                    onPress={() => {
                                        if (playlistToEdit || isCreatingDirectly) {
                                            closeSelector();
                                        } else {
                                            setIsCreating(false);
                                        }
                                    }}
                                >
                                    <Text style={styles.btnCancelText}>{t('actions.cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.btn,
                                        styles.btnConfirm,
                                        !playlistName.trim() && { opacity: 0.5 }
                                    ]}
                                    onPress={handleSavePlaylist}
                                    disabled={!playlistName.trim()}
                                >
                                    <Text style={styles.btnConfirmText}>
                                        {playlistToEdit ? t('actions.save_changes') : (isCreatingDirectly ? t('library.create_playlist') : t('playlist.create_and_add'))}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    containerAbsolute: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.75)',
    },
    keyboardAvoid: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#121212',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        maxHeight: SCREEN_HEIGHT * 0.85,
        borderTopWidth: 1,
        borderColor: '#282828',
    },
    dragIndicator: {
        width: 36,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#282828',
        paddingBottom: 15,
    },
    headerTitle: {
        color: '#8B5CF6',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerSubtitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        marginTop: 4,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 20,
        gap: 8,
    },
    createButtonText: {
        color: '#FFFFFF',
        fontFamily: 'Montserrat',
        fontWeight: '800',
        fontSize: 14,
    },
    listScroll: {
        maxHeight: 580,
    },
    listContent: {
        paddingBottom: 10,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        marginTop: 10,
        textAlign: 'center',
    },
    playlistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    playlistInfo: {
        flex: 1,
        marginLeft: 12,
    },
    playlistName: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    playlistDesc: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        marginTop: 2,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    input: {
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        height: 48,
        color: '#FFFFFF',
        fontFamily: 'Montserrat', fontWeight: '600',
        paddingHorizontal: 16,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 20,
    },
    textArea: {
        height: 80,
        paddingTop: 12,
        textAlignVertical: 'top',
    },
    formButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
    },
    btn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnCancel: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    btnCancelText: {
        color: '#B3B3B3',
        fontFamily: 'Montserrat',
        fontWeight: '700',
        fontSize: 14,
    },
    btnConfirm: {
        backgroundColor: '#8B5CF6',
    },
    btnConfirmText: {
        color: '#FFFFFF',
        fontFamily: 'Montserrat',
        fontWeight: '800',
        fontSize: 14,
    },
});
