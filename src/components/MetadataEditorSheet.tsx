import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import { useMetadataEditorStore } from '../store/useMetadataEditorStore';
import { useMultiSelectStore } from '../store/useMultiSelectStore';
import { useToastStore } from '../store/useToastStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { readMetadata } from '../../modules/native-audio-scanner';
import { MetadataEditorService, EditableMetadata } from '../services/MetadataEditorService';
import { database } from '../database';
import Artist from '../database/models/Artist';
import Album from '../database/models/Album';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MetadataEditorSheet() {
    const { t } = useTranslation();
    const { colors, fonts, fontWeights } = useAppTheme();
    const insets = useSafeAreaInsets();
    
    const { isVisible, tracks, closeSheet } = useMetadataEditorStore();
    const { exitSelectionMode } = useMultiSelectStore();
    
    const isBatchMode = tracks.length > 1;

    // Form inputs state
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [albumArtist, setAlbumArtist] = useState('');
    const [album, setAlbum] = useState('');
    const [year, setYear] = useState('');
    const [trackNumber, setTrackNumber] = useState('');
    const [discNumber, setDiscNumber] = useState('');
    const [genre, setGenre] = useState('');
    const [initialCoverUrl, setInitialCoverUrl] = useState<string | null>(null);
    const [coverArtPath, setCoverArtPath] = useState<string | null>(null);

    // Autocomplete states
    const [allArtists, setAllArtists] = useState<string[]>([]);
    const [allAlbums, setAllAlbums] = useState<string[]>([]);
    const [filteredArtists, setFilteredArtists] = useState<string[]>([]);
    const [filteredAlbums, setFilteredAlbums] = useState<string[]>([]);
    const [filteredAlbumArtists, setFilteredAlbumArtists] = useState<string[]>([]);
    const [activeSuggestionField, setActiveSuggestionField] = useState<'artist' | 'album' | 'albumArtist' | null>(null);

    // Fetch unique artists/albums from DB when visible
    useEffect(() => {
        if (!isVisible) return;
        const fetchDbSuggestions = async () => {
            try {
                const artistsList = await database.collections.get<Artist>('artists').query().fetch();
                const albumsList = await database.collections.get<Album>('albums').query().fetch();
                
                const artistNames = Array.from(new Set(artistsList.map(a => a.name).filter(Boolean))).sort();
                const albumNames = Array.from(new Set(albumsList.map(a => a.title).filter(Boolean))).sort();
                
                setAllArtists(artistNames);
                setAllAlbums(albumNames);
            } catch (err) {
                console.error("Error fetching autocomplete metadata from DB", err);
            }
        };
        fetchDbSuggestions();
    }, [isVisible]);

    const handleArtistChange = (text: string) => {
        setArtist(text);
        if (text.trim() === '') {
            setFilteredArtists(allArtists.slice(0, 10));
        } else {
            const filtered = allArtists.filter(name => name.toLowerCase().includes(text.toLowerCase())).slice(0, 10);
            setFilteredArtists(filtered);
        }
    };

    const handleArtistFocus = () => {
        setActiveSuggestionField('artist');
        if (artist.trim() === '') {
            setFilteredArtists(allArtists.slice(0, 10));
        } else {
            const filtered = allArtists.filter(name => name.toLowerCase().includes(artist.toLowerCase())).slice(0, 10);
            setFilteredArtists(filtered);
        }
    };

    const handleAlbumChange = (text: string) => {
        setAlbum(text);
        if (text.trim() === '') {
            setFilteredAlbums(allAlbums.slice(0, 10));
        } else {
            const filtered = allAlbums.filter(name => name.toLowerCase().includes(text.toLowerCase())).slice(0, 10);
            setFilteredAlbums(filtered);
        }
    };

    const handleAlbumFocus = () => {
        setActiveSuggestionField('album');
        if (album.trim() === '') {
            setFilteredAlbums(allAlbums.slice(0, 10));
        } else {
            const filtered = allAlbums.filter(name => name.toLowerCase().includes(album.toLowerCase())).slice(0, 10);
            setFilteredAlbums(filtered);
        }
    };

    const handleAlbumArtistChange = (text: string) => {
        setAlbumArtist(text);
        if (text.trim() === '') {
            setFilteredAlbumArtists(allArtists.slice(0, 10));
        } else {
            const filtered = allArtists.filter(name => name.toLowerCase().includes(text.toLowerCase())).slice(0, 10);
            setFilteredAlbumArtists(filtered);
        }
    };

    const handleAlbumArtistFocus = () => {
        setActiveSuggestionField('albumArtist');
        if (albumArtist.trim() === '') {
            setFilteredAlbumArtists(allArtists.slice(0, 10));
        } else {
            const filtered = allArtists.filter(name => name.toLowerCase().includes(albumArtist.toLowerCase())).slice(0, 10);
            setFilteredAlbumArtists(filtered);
        }
    };

    const [isLoadingPhysical, setIsLoadingPhysical] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAutoNumbering, setIsAutoNumbering] = useState(false);
    const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });

    // Track original fields for detecting changes in single mode
    const [originalMetadata, setOriginalMetadata] = useState<any>(null);

    // Animaciones
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const keyboardHeight = useRef(new Animated.Value(0)).current;

    // --- RESET & LOAD METADATA ---
    useEffect(() => {
        if (!isVisible || tracks.length === 0) return;

        if (isBatchMode) {
            const loadBatchTracksMetadata = async () => {
                setIsLoadingPhysical(true);
                try {
                    const titles: string[] = [];
                    const artists: string[] = [];
                    const albumArtists: string[] = [];
                    const albums: string[] = [];
                    const years: string[] = [];
                    const trackNumbers: string[] = [];
                    const discNumbers: string[] = [];
                    const genres: string[] = [];
                    const covers: string[] = [];

                    for (const track of tracks) {
                        const albumModel = await track.album.fetch();
                        const artistModel = await track.artist.fetch();

                        titles.push(track.title || '');
                        artists.push(artistModel?.name || '');
                        albums.push(albumModel?.title || '');
                        years.push(albumModel?.year?.toString() || '');
                        trackNumbers.push(track.trackNumber?.toString() || '');
                        genres.push('');
                        if (albumModel?.coverUrl) {
                            covers.push(albumModel.coverUrl);
                        }

                        // Read physical tags for additional fields
                        try {
                            const physical = await readMetadata(track.fileUrl);
                            if (physical.albumArtist) {
                                albumArtists.push(physical.albumArtist);
                            } else {
                                albumArtists.push('');
                            }
                            if (physical.discNumber) {
                                discNumbers.push(physical.discNumber.toString());
                            } else {
                                discNumbers.push('');
                            }
                            if (physical.genre) {
                                genres[genres.length - 1] = physical.genre;
                            }
                        } catch {
                            albumArtists.push('');
                            discNumbers.push('');
                        }
                    }

                    const getCommonValue = (arr: string[]) => {
                        if (arr.length === 0) return '';
                        const first = arr[0];
                        return arr.every(val => val === first) ? first : '';
                    };

                    const commonTitle = getCommonValue(titles);
                    const commonArtist = getCommonValue(artists);
                    const commonAlbumArtist = getCommonValue(albumArtists);
                    const commonAlbum = getCommonValue(albums);
                    const commonYear = getCommonValue(years);
                    const commonTrackNumber = getCommonValue(trackNumbers);
                    const commonDiscNumber = getCommonValue(discNumbers);
                    const commonGenre = getCommonValue(genres);
                    const commonCover = getCommonValue(covers);

                    setTitle(commonTitle);
                    setArtist(commonArtist);
                    setAlbumArtist(commonAlbumArtist);
                    setAlbum(commonAlbum);
                    setYear(commonYear);
                    setTrackNumber(commonTrackNumber);
                    setDiscNumber(commonDiscNumber);
                    setGenre(commonGenre);
                    setInitialCoverUrl(commonCover || null);
                    setCoverArtPath(null);
                    setIsAutoNumbering(false);
                    setSaveProgress({ current: 0, total: 0 });

                    setOriginalMetadata({
                        title: commonTitle,
                        artist: commonArtist,
                        albumArtist: commonAlbumArtist,
                        album: commonAlbum,
                        year: commonYear,
                        trackNumber: commonTrackNumber,
                        discNumber: commonDiscNumber,
                        genre: commonGenre
                    });
                } catch (err) {
                    console.error("Error loading batch metadata", err);
                } finally {
                    setIsLoadingPhysical(false);
                }
            };
            loadBatchTracksMetadata();
        } else {
            const loadSingleTrackMetadata = async () => {
                setIsLoadingPhysical(true);
                const track = tracks[0];
                try {
                    const physical = await readMetadata(track.fileUrl);
                    
                    const albumModel = await track.album.fetch();
                    const artistModel = await track.artist.fetch();

                    const initialTitle = physical.title || track.title || '';
                    const initialArtist = physical.artist || artistModel?.name || '';
                    const initialAlbumArtist = physical.albumArtist || '';
                    const initialAlbum = physical.album || albumModel?.name || '';
                    const initialYear = physical.year || albumModel?.year?.toString() || '';
                    const initialTrack = physical.trackNumber || track.trackNumber?.toString() || '';
                    const initialDisc = physical.discNumber || '';
                    const initialGenre = physical.genre || '';
                    const initialCover = albumModel?.coverUrl || '';

                    setTitle(initialTitle);
                    setArtist(initialArtist);
                    setAlbumArtist(initialAlbumArtist);
                    setAlbum(initialAlbum);
                    setYear(initialYear);
                    setTrackNumber(initialTrack);
                    setDiscNumber(initialDisc);
                    setGenre(initialGenre);
                    setInitialCoverUrl(initialCover);
                    setCoverArtPath(null);

                    const orig = {
                        title: initialTitle,
                        artist: initialArtist,
                        albumArtist: initialAlbumArtist,
                        album: initialAlbum,
                        year: initialYear,
                        trackNumber: initialTrack,
                        discNumber: initialDisc,
                        genre: initialGenre
                    };
                    setOriginalMetadata(orig);
                } catch (err) {
                    console.error("Error reading physical metadata", err);
                    const albumModel = await track.album.fetch();
                    const artistModel = await track.artist.fetch();
                    const initialCover = albumModel?.coverUrl || '';

                    setTitle(track.title || '');
                    setArtist(artistModel?.name || '');
                    setAlbumArtist('');
                    setAlbum(albumModel?.name || '');
                    setYear(albumModel?.year?.toString() || '');
                    setTrackNumber(track.trackNumber?.toString() || '');
                    setDiscNumber('');
                    setGenre('');
                    setInitialCoverUrl(initialCover);
                    setCoverArtPath(null);
                    setOriginalMetadata({
                        title: track.title || '',
                        artist: artistModel?.name || '',
                        albumArtist: '',
                        album: albumModel?.name || '',
                        year: albumModel?.year?.toString() || '',
                        trackNumber: track.trackNumber?.toString() || '',
                        discNumber: '',
                        genre: ''
                    });
                } finally {
                    setIsLoadingPhysical(false);
                }
            };

            loadSingleTrackMetadata();
        }
    }, [isVisible, tracks, isBatchMode]);

    // --- ANIMACIONES DE HOJA ---
    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true })
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    // --- ANIMACION DE LEVANTAMIENTO DEL TECLADO ---
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

    // --- BACKHANDLER ---
    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => {
            if (isSaving) return true;
            closeSheet();
            return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeSheet, isSaving]);

    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    const getMetadataPayload = (): EditableMetadata => {
        const payload: EditableMetadata = {};
        if (title !== originalMetadata?.title) payload.title = title;
        if (artist !== originalMetadata?.artist) payload.artist = artist;
        if (albumArtist !== originalMetadata?.albumArtist) payload.albumArtist = albumArtist;
        if (album !== originalMetadata?.album) payload.album = album;
        if (year !== originalMetadata?.year) payload.year = year;
        if (trackNumber !== originalMetadata?.trackNumber) payload.trackNumber = trackNumber;
        if (discNumber !== originalMetadata?.discNumber) payload.discNumber = discNumber;
        if (genre !== originalMetadata?.genre) payload.genre = genre;
        if (coverArtPath !== null) payload.coverArtPath = coverArtPath;
        return payload;
    };

    const handlePickImage = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                copyToCacheDirectory: true,
            });
            const asset = result.assets?.[0];
            if (asset) {
                setCoverArtPath(asset.uri);
            }
        } catch (error) {
            console.error('PickPhoto: Error al lanzar explorador:', error);
            useToastStore.getState().showToast(t('actions.pick_photo_error'), 'warning');
        }
    };

    const handleRemoveCover = () => {
        setCoverArtPath('');
    };

    const getCoverUriToDisplay = () => {
        if (coverArtPath === '') {
            return null; // explicitly removed
        }
        if (coverArtPath) {
            return { uri: coverArtPath };
        }
        if (initialCoverUrl) {
            return { uri: initialCoverUrl };
        }
        return null;
    };

    const handleCancelSave = async () => {
        try {
            await MetadataEditorService.cancelSave();
        } catch (error) {
            console.error("Error cancelling batch save:", error);
        }
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        setSaveProgress({ current: 0, total: tracks.length });

        try {
            const metadataPayload = getMetadataPayload();

            await MetadataEditorService.saveMetadata(
                tracks,
                metadataPayload,
                isBatchMode,
                isAutoNumbering,
                (current, total) => {
                    setSaveProgress({ current, total });
                }
            );
            useToastStore.getState().showToast(t('metadata_editor.success'), 'checkmark-circle');
            Keyboard.dismiss();
            closeSheet();
            exitSelectionMode();
        } catch (error: any) {
            console.error("Error saving metadata:", error);
            if (error?.message?.includes("cancelled") || error?.code === "ERR_CANCELLED") {
                useToastStore.getState().showToast(t('metadata_editor.cancelled'), 'information-circle');
            } else {
                useToastStore.getState().showToast(t('metadata_editor.error_save'), 'warning');
            }
        } finally {
            setIsSaving(false);
            setSaveProgress({ current: 0, total: 0 });
        }
    };

    if (!shouldRender && !isVisible) return null;

    const styles = getStyles(colors, fonts, fontWeights);

    return (
        <View style={[styles.containerAbsolute, { zIndex: 99999, elevation: 100 }]} pointerEvents={isVisible ? 'auto' : 'none'}>
            <TouchableWithoutFeedback onPress={() => {
                if (isSaving) return;
                Keyboard.dismiss();
                closeSheet();
            }}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            {/* Contenedor del bottom sheet que reacciona al teclado levantándolo */}
            <Animated.View style={[styles.keyboardAvoid, { paddingBottom: keyboardHeight }]} pointerEvents="box-none">
                <Animated.View style={[
                    styles.sheetContainer,
                    {
                        paddingBottom: insets.bottom + 20,
                        transform: [{ translateY: slideAnim }]
                    }
                ]}>
                    <View style={styles.dragIndicator} />
                    
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>
                                {isBatchMode 
                                    ? t('metadata_editor.title_batch') 
                                    : t('metadata_editor.title_single')}
                            </Text>
                            <View style={styles.betaBadge}>
                                <Text style={styles.betaBadgeText}>BETA</Text>
                            </View>
                        </View>
                        {!isBatchMode && tracks[0] && (
                            <Text style={styles.subtitle} numberOfLines={1}>
                                {tracks[0].title}
                            </Text>
                        )}
                    </View>

                    {isLoadingPhysical ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text style={styles.loadingText}>{t('metadata_editor.loading_physical')}</Text>
                        </View>
                    ) : (
                        <ScrollView 
                            contentContainerStyle={styles.formContainer}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* COVER ART SELECTOR */}
                            <View style={styles.coverSection}>
                                <View style={styles.coverWrapper}>
                                    {getCoverUriToDisplay() ? (
                                        <Animated.Image 
                                            source={getCoverUriToDisplay()!} 
                                            style={styles.coverImage} 
                                        />
                                    ) : (
                                        <View style={styles.coverPlaceholder}>
                                            <Ionicons name="musical-notes-outline" size={48} color={colors.textSecondary} />
                                        </View>
                                    )}
                                    {!isSaving && (
                                        <View style={styles.coverActionsOverlay}>
                                            <TouchableOpacity 
                                                style={styles.coverActionBtn} 
                                                onPress={handlePickImage}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="camera" size={18} color="#FFF" />
                                            </TouchableOpacity>
                                            {(coverArtPath !== '' && (coverArtPath !== null || initialCoverUrl)) && (
                                                <TouchableOpacity 
                                                    style={[styles.coverActionBtn, styles.coverActionBtnDelete]} 
                                                    onPress={handleRemoveCover}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="trash" size={18} color="#FFF" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.coverHelpText}>
                                    {isBatchMode 
                                        ? t('metadata_editor.cover_help_batch') 
                                        : t('metadata_editor.cover_help_single')}
                                </Text>
                            </View>

                            {/* FIELD: Title */}
                            <View style={styles.fieldWrapper}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.label}>{t('metadata_editor.field_title')}</Text>
                                    {isBatchMode && (
                                        <View style={styles.lockedBadge}>
                                            <Ionicons name="lock-closed" size={10} color={colors.textSecondary} />
                                            <Text style={styles.lockedText}>{t('metadata_editor.locked_batch')}</Text>
                                        </View>
                                    )}
                                </View>
                                <TextInput
                                    style={[styles.input, (isBatchMode || isSaving) && styles.inputDisabled]}
                                    value={title}
                                    onChangeText={setTitle}
                                    editable={!isBatchMode && !isSaving}
                                    placeholder={isBatchMode ? t('metadata_editor.locked_batch') : '...'}
                                    placeholderTextColor={colors.textSecondary}
                                />
                            </View>

                            {/* FIELD: Track Number */}
                            <View style={styles.fieldWrapper}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.label}>{t('metadata_editor.field_track')}</Text>
                                    {isBatchMode && (
                                        <View style={styles.lockedBadge}>
                                            <Ionicons name="lock-closed" size={10} color={colors.textSecondary} />
                                            <Text style={styles.lockedText}>{t('metadata_editor.locked_batch')}</Text>
                                        </View>
                                    )}
                                </View>
                                {!isBatchMode ? (
                                    <TextInput
                                        style={[styles.input, isSaving && styles.inputDisabled]}
                                        value={trackNumber}
                                        onChangeText={setTrackNumber}
                                        keyboardType="numeric"
                                        editable={!isSaving}
                                        placeholder="..."
                                        placeholderTextColor={colors.textSecondary}
                                    />
                                ) : (
                                    <View style={{ gap: 6 }}>
                                        <TouchableOpacity
                                            style={[
                                                styles.input,
                                                isAutoNumbering && { borderColor: colors.accent, borderWidth: 1.5 },
                                                isSaving && styles.inputDisabled,
                                                { flexDirection: 'row', alignItems: 'center', gap: 8 }
                                            ]}
                                            onPress={() => !isSaving && setIsAutoNumbering(prev => !prev)}
                                            activeOpacity={0.7}
                                            disabled={isSaving}
                                        >
                                            <Ionicons 
                                                name={isAutoNumbering ? "checkmark-circle" : "ellipse-outline"} 
                                                size={18} 
                                                color={isAutoNumbering ? colors.accent : colors.textSecondary} 
                                            />
                                            <Text style={{ 
                                                color: isAutoNumbering ? colors.text : colors.textSecondary,
                                                fontFamily: fonts.regular,
                                                fontSize: 15
                                            }}>
                                                {isAutoNumbering ? t('metadata_editor.auto_number_active') : t('metadata_editor.auto_number_inactive')}
                                            </Text>
                                        </TouchableOpacity>
                                        {isAutoNumbering && (
                                            <Text style={{
                                                fontSize: 12,
                                                color: colors.textSecondary,
                                                fontFamily: fonts.regular,
                                                lineHeight: 16,
                                                paddingHorizontal: 4
                                            }}>
                                                {t('metadata_editor.auto_number_help')}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* FIELD: Disc Number */}
                            <View style={styles.fieldWrapper}>
                                <Text style={styles.label}>{t('metadata_editor.field_disc')}</Text>
                                <TextInput
                                    style={[styles.input, isSaving && styles.inputDisabled]}
                                    value={discNumber}
                                    onChangeText={setDiscNumber}
                                    keyboardType="numeric"
                                    editable={!isSaving}
                                    placeholder="..."
                                    placeholderTextColor={colors.textSecondary}
                                />
                            </View>

                            {/* FIELD: Artist */}
                            <View style={styles.fieldWrapper}>
                                <Text style={styles.label}>{t('metadata_editor.field_artist')}</Text>
                                <TextInput
                                    style={[styles.input, isSaving && styles.inputDisabled]}
                                    value={artist}
                                    onChangeText={handleArtistChange}
                                    onFocus={handleArtistFocus}
                                    onBlur={() => setTimeout(() => setActiveSuggestionField(null), 250)}
                                    editable={!isSaving}
                                    placeholder="..."
                                    placeholderTextColor={colors.textSecondary}
                                />
                                {activeSuggestionField === 'artist' && filteredArtists.length > 0 && (
                                    <ScrollView 
                                        horizontal 
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.suggestionsContainer}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {filteredArtists.map((item, index) => (
                                            <TouchableOpacity 
                                                key={index} 
                                                style={styles.suggestionPill}
                                                onPress={() => {
                                                    setArtist(item);
                                                    setActiveSuggestionField(null);
                                                }}
                                            >
                                                <Text style={styles.suggestionText}>{item}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>

                            {/* FIELD: Album */}
                            <View style={styles.fieldWrapper}>
                                <Text style={styles.label}>{t('metadata_editor.field_album')}</Text>
                                <TextInput
                                    style={[styles.input, isSaving && styles.inputDisabled]}
                                    value={album}
                                    onChangeText={handleAlbumChange}
                                    onFocus={handleAlbumFocus}
                                    onBlur={() => setTimeout(() => setActiveSuggestionField(null), 250)}
                                    editable={!isSaving}
                                    placeholder="..."
                                    placeholderTextColor={colors.textSecondary}
                                />
                                {activeSuggestionField === 'album' && filteredAlbums.length > 0 && (
                                    <ScrollView 
                                        horizontal 
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.suggestionsContainer}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {filteredAlbums.map((item, index) => (
                                            <TouchableOpacity 
                                                key={index} 
                                                style={styles.suggestionPill}
                                                onPress={() => {
                                                    setAlbum(item);
                                                    setActiveSuggestionField(null);
                                                }}
                                            >
                                                <Text style={styles.suggestionText}>{item}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>

                            {/* FIELD: Album Artist */}
                            <View style={styles.fieldWrapper}>
                                <Text style={styles.label}>{t('metadata_editor.field_album_artist')}</Text>
                                <TextInput
                                    style={[styles.input, isSaving && styles.inputDisabled]}
                                    value={albumArtist}
                                    onChangeText={handleAlbumArtistChange}
                                    onFocus={handleAlbumArtistFocus}
                                    onBlur={() => setTimeout(() => setActiveSuggestionField(null), 250)}
                                    editable={!isSaving}
                                    placeholder="..."
                                    placeholderTextColor={colors.textSecondary}
                                />
                                {activeSuggestionField === 'albumArtist' && filteredAlbumArtists.length > 0 && (
                                    <ScrollView 
                                        horizontal 
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.suggestionsContainer}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {filteredAlbumArtists.map((item, index) => (
                                            <TouchableOpacity 
                                                key={index} 
                                                style={styles.suggestionPill}
                                                onPress={() => {
                                                    setAlbumArtist(item);
                                                    setActiveSuggestionField(null);
                                                }}
                                            >
                                                <Text style={styles.suggestionText}>{item}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>

                            {/* FIELD: Year */}
                            <View style={styles.fieldWrapper}>
                                <Text style={styles.label}>{t('metadata_editor.field_year')}</Text>
                                <TextInput
                                    style={[styles.input, isSaving && styles.inputDisabled]}
                                    value={year}
                                    onChangeText={setYear}
                                    keyboardType="numeric"
                                    editable={!isSaving}
                                    placeholder="..."
                                    placeholderTextColor={colors.textSecondary}
                                />
                            </View>

                            {/* FIELD: Genre */}
                            <View style={styles.fieldWrapper}>
                                <Text style={styles.label}>{t('metadata_editor.field_genre')}</Text>
                                <TextInput
                                    style={[styles.input, isSaving && styles.inputDisabled]}
                                    value={genre}
                                    onChangeText={setGenre}
                                    editable={!isSaving}
                                    placeholder="..."
                                    placeholderTextColor={colors.textSecondary}
                                />
                            </View>

                            {/* BUTTONS */}
                            <View style={styles.actionsRow}>
                                <TouchableOpacity 
                                    style={styles.cancelBtn} 
                                    onPress={isSaving ? handleCancelSave : closeSheet}
                                >
                                    <Text style={styles.cancelBtnText}>
                                        {isSaving ? t('metadata_editor.abort') : t('metadata_editor.cancel')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} 
                                    onPress={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <ActivityIndicator size="small" color="#FFF" />
                                            <Text style={styles.saveBtnText}>
                                                {saveProgress.total > 0
                                                    ? `${t('metadata_editor.saving').replace('...', '')} ${saveProgress.current}/${saveProgress.total}`
                                                    : t('metadata_editor.saving')}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.saveBtnText}>{t('metadata_editor.save')}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, fontWeights: any) => StyleSheet.create({
    containerAbsolute: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    keyboardAvoid: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#0F0F0F',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: SCREEN_HEIGHT * 0.85,
        borderTopWidth: 1,
        borderColor: '#1E1E1E',
        overflow: 'hidden',
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#2E2E2E',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 14,
        marginBottom: 16,
    },
    header: {
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 20,
        fontFamily: fonts.bold,
        fontWeight: fontWeights.bold,
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 14,
        fontFamily: fonts.regular,
        color: colors.textSecondary,
        marginTop: 4,
    },
    betaBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'center',
    },
    betaBadgeText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '900',
        fontFamily: fonts.regular,
        letterSpacing: 0.5,
    },
    loadingContainer: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: colors.textSecondary,
        marginTop: 12,
        fontFamily: fonts.regular,
        fontSize: 14,
    },
    formContainer: {
        padding: 24,
        paddingBottom: 48,
        gap: 16,
    },
    fieldWrapper: {
        gap: 8,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.semiBold,
        color: colors.textSecondary,
    },
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    lockedText: {
        fontSize: 11,
        color: colors.textSecondary,
        fontFamily: fonts.regular,
    },
    input: {
        backgroundColor: '#1E1E1E',
        color: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        fontFamily: fonts.regular,
        borderWidth: 1,
        borderColor: '#2D2D2D',
    },
    inputDisabled: {
        backgroundColor: '#141414',
        color: colors.textSecondary,
        borderColor: '#1D1D1D',
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 16,
    },
    cancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: '#1E1E1E',
    },
    cancelBtnText: {
        color: colors.text,
        fontSize: 15,
        fontFamily: fonts.bold,
        fontWeight: fontWeights.bold,
    },
    saveBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: colors.accent,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: fonts.bold,
        fontWeight: fontWeights.bold,
    },
    coverSection: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 12,
        gap: 8,
    },
    coverWrapper: {
        width: 140,
        height: 140,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#2D2D2D',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    coverImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    coverPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
    },
    coverActionsOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 16,
    },
    coverActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    coverActionBtnDelete: {
        backgroundColor: '#EF4444',
    },
    coverHelpText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontFamily: fonts.regular,
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    suggestionsContainer: {
        flexDirection: 'row',
        paddingVertical: 6,
        gap: 8,
    },
    suggestionPill: {
        backgroundColor: '#1E1E1E',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2D2D2D',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    suggestionText: {
        color: colors.text,
        fontSize: 13,
        fontFamily: fonts.regular,
    },
});
