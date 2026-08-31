import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import withObservables from '@nozbe/with-observables';

import { useAppTheme } from '@/hooks/useAppTheme';
import DetailHeaderLayout from '@/components/layouts/DetailHeaderLayout';
import SectionHeader from '@/components/common/SectionHeader';
import { MediaCard } from '@/components/cards/MediaCard';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useStatsStore } from '../../store/useStatsStore';
import { useUIStore, openEditAlias } from '../../store/useUIStore';
import { MediaAssetService } from '../../services/MediaAssetService';
import { SmartListService } from '../../services/SmartListService';
import { HistoryService } from '../../services/HistoryService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../../theme/theme';
import { database } from '../../database';
import Playlist from '../../database/models/Playlist';
import Track from '../../database/models/Track';

const { width } = Dimensions.get('window');

interface UserProfileProps {
    readonly tracksCount: number;
    readonly albumsCount: number;
    readonly artistsCount: number;
    readonly playlistsCount: number;
    readonly playlists: Playlist[];
}

function UserProfileScreenBase({
    tracksCount,
    albumsCount,
    artistsCount,
    playlistsCount,
    playlists,
}: UserProfileProps) {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors, fonts, layout, spacing, radii, fontWeights } = useAppTheme();

    const userAlias = useSettingsStore(state => state.userAlias);
    const userAvatarUri = useSettingsStore(state => state.userAvatarUri);
    const setUserAvatarUri = useSettingsStore(state => state.setUserAvatarUri);
    const userTier = useSettingsStore(state => state.userTier);

    // Stats Store
    const totalHours = useStatsStore(state => state.totalHours);
    const topSong = useStatsStore(state => state.topSong);
    const topSongArtist = useStatsStore(state => state.topSongArtist);
    const topSongImg = useStatsStore(state => state.topSongImg);
    const topSongId = useStatsStore(state => state.topSongId);
    const topArtist = useStatsStore(state => state.topArtist);
    const topArtistImg = useStatsStore(state => state.topArtistImg);
    const topArtistId = useStatsStore(state => state.topArtistId);

    // Top Artists and Top Albums (Total Usage)
    const [topAlbums, setTopAlbums] = useState<any[]>([]);
    const [topArtists, setTopArtists] = useState<any[]>([]);

    useEffect(() => {
        useStatsStore.getState().fetchStats();
    }, []);

    useEffect(() => {
        let isMounted = true;
        const loadTopStats = async () => {
            try {
                const stats = await HistoryService.getDetailedStatsForPeriod('all', 'duration');
                if (isMounted) {
                    setTopAlbums(stats.topAlbums.slice(0, 10));
                    setTopArtists(stats.topArtists.slice(0, 10));
                }
            } catch (err) {
                console.error('Error loading top albums/artists in UserProfile:', err);
            }
        };
        loadTopStats();
        return () => {
            isMounted = false;
        };
    }, []);

    // Smart playlists
    const [smartLists, setSmartLists] = useState<any[]>([]);

    useEffect(() => {
        let isMounted = true;
        const loadSmartLists = async () => {
            try {
                const lists = SmartListService.getSmartLists();
                const loaded = await Promise.all(
                    lists.map(async (list) => {
                        const tracks = await list.getTracks();
                        return {
                            id: `smart-list-${list.id}`,
                            smartId: list.id,
                            title: list.name,
                            subtitle: `${tracks.length} ${tracks.length === 1 ? t('library.song_singular') : t('library.song_plural')}`,
                            trackCount: tracks.length,
                        };
                    })
                );
                if (isMounted) {
                    setSmartLists(loaded.filter(item => item.trackCount > 0));
                }
            } catch (err) {
                console.error('Error loading smart lists in UserProfile:', err);
            }
        };

        loadSmartLists();
        return () => {
            isMounted = false;
        };
    }, [t]);

    // Edit Name via EditAliasSheet
    const handleEditName = useCallback(() => {
        openEditAlias();
    }, []);

    // Pick / Delete Photo
    const performPickPhoto = useCallback(async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                copyToCacheDirectory: true,
            });

            const asset = result.assets?.[0];
            if (!asset) return;

            const permanentUri = await MediaAssetService.saveUserAvatar(asset.uri);
            setUserAvatarUri(permanentUri);
            Alert.alert(t('actions.success'), t('profile.photo_updated') || 'Foto de perfil actualizada correctamente.');
        } catch (error) {
            console.error('PickPhoto error:', error);
            Alert.alert(t('actions.error'), t('actions.save_photo_error') || 'Error al guardar la foto.');
        }
    }, [setUserAvatarUri, t]);

    const handleDeletePhoto = useCallback(async () => {
        try {
            await MediaAssetService.removeUserAvatar();
            setUserAvatarUri(null);
            Alert.alert(t('actions.success'), t('profile.photo_deleted') || 'Foto de perfil eliminada.');
        } catch (error) {
            console.error('DeletePhoto error:', error);
            Alert.alert(t('actions.error'), t('actions.error') || 'Error al eliminar la imagen.');
        }
    }, [setUserAvatarUri, t]);

    const handlePickPhoto = useCallback(() => {
        if (!userAvatarUri) {
            performPickPhoto();
            return;
        }

        Alert.alert(
            userAlias || t('profile.default_user', 'Usuario'),
            t('profile.photo_options') || '¿Qué deseas hacer con tu foto de perfil?',
            [
                { text: t('actions.cancel') || 'Cancelar', style: 'cancel' },
                {
                    text: t('profile.delete_photo') || 'Eliminar foto',
                    style: 'destructive',
                    onPress: handleDeletePhoto,
                },
                {
                    text: t('profile.set_photo') || 'Seleccionar foto',
                    style: 'default',
                    onPress: performPickPhoto,
                },
            ]
        );
    }, [userAvatarUri, userAlias, performPickPhoto, handleDeletePhoto, t]);

    const handlePlayTopSong = useCallback(async () => {
        if (!topSongId) return;
        try {
            const track = await database.get<Track>('tracks').find(topSongId);
            if (track) {
                usePlayerStore.getState().playSingleTrack(track, 'profile-top-song');
            }
        } catch (err) {
            console.error('Error playing top song from profile:', err);
        }
    }, [topSongId]);

    const handleTopArtistPress = useCallback(() => {
        if (topArtistId) {
            navigation.navigate('ArtistDetail', { artistId: topArtistId });
        }
    }, [topArtistId, navigation]);

    const handleSmartListPress = useCallback((smartListId: string) => {
        navigation.navigate('SmartListDetail', { smartListId });
    }, [navigation]);

    const handlePlaylistPress = useCallback((playlistId: string) => {
        if (playlistId === 'favorites') {
            navigation.navigate('FavoritesDetail');
        } else {
            navigation.navigate('PlaylistDetail', { playlistId });
        }
    }, [navigation]);

    const styles = useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights), [colors, fonts, layout, spacing, radii, fontWeights]);

    return (
        <View style={styles.container}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Cabecera limpia con avatar, alias, insignias de tier y acciones */}
                <DetailHeaderLayout
                    title={userAlias || t('profile.default_user', 'Usuario')}
                    imageUrl={userAvatarUri}
                    placeholderIcon="person"
                    subtitle={
                        <View style={styles.subtitleRow}>
                            <TouchableOpacity
                                style={[
                                    styles.userTierBadge,
                                    userTier === 'VIP' && styles.userTierBadgeVip,
                                    userTier === 'SUPPORTER' && styles.userTierBadgeSupporter,
                                ]}
                                onPress={() => navigation.navigate('Support')}
                                activeOpacity={0.7}
                            >
                                {userTier === 'VIP' && (
                                    <MaterialCommunityIcons name="crown" size={13} color="#FBBF24" />
                                )}
                                {userTier === 'SUPPORTER' && (
                                    <Ionicons name="heart" size={12} color="#2DD4BF" />
                                )}
                                <Text style={[
                                    styles.userTierBadgeText,
                                    userTier === 'VIP' && styles.userTierBadgeTextVip,
                                    userTier === 'SUPPORTER' && styles.userTierBadgeTextSupporter,
                                ]}>
                                    {userTier === 'VIP' ? 'VIP' : userTier === 'SUPPORTER' ? 'SUPPORTER' : 'USER'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    }
                    onBack={() => navigation.goBack()}
                    onPickPhoto={handlePickPhoto}
                    onEditTitle={handleEditName}
                />

                {/* --- 1. CONTADOR DE BIBLIOTECA (VISUAL) --- */}
                <View style={styles.sectionWrapper}>
                    <TouchableOpacity
                        style={styles.statsCard}
                        onPress={() => navigation.navigate('Biblioteca')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.statsCardTitle}>{t('profile.library_overview') || 'Estado de tu biblioteca'}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                        </View>
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{tracksCount}</Text>
                                <Text style={styles.statLabel}>{t('library.songs')}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{albumsCount}</Text>
                                <Text style={styles.statLabel}>{t('library.albums')}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{artistsCount}</Text>
                                <Text style={styles.statLabel}>{t('library.artists')}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{playlistsCount + 1}</Text>
                                <Text style={styles.statLabel}>{t('library.playlists')}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* --- 2. ARTISTAS FAVORITOS (MÁS ESCUCHADOS TOTAL) --- */}
                {topArtists.length > 0 && (
                    <View style={styles.sectionWrapper}>
                        <SectionHeader
                            title={t('profile.top_artists_title') || 'Tus artistas favoritos'}
                        />
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.horizontalScrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {topArtists.map((artist) => (
                                <MediaCard
                                    key={`profile-top-artist-${artist.id}`}
                                    id={artist.id}
                                    type="artist"
                                    title={artist.name}
                                    subtitle={t('library.artist_singular')}
                                    imageUrl={artist.imageUrl}
                                    onPress={() => navigation.navigate('ArtistDetail', { artistId: artist.id })}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* --- 3. ÁLBUMES FAVORITOS (MÁS ESCUCHADOS TOTAL) --- */}
                {topAlbums.length > 0 && (
                    <View style={styles.sectionWrapper}>
                        <SectionHeader
                            title={t('profile.top_albums_title') || 'Tus álbumes favoritos'}
                        />
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.horizontalScrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {topAlbums.map((album) => (
                                <MediaCard
                                    key={`profile-top-album-${album.id}`}
                                    id={album.id}
                                    type="album"
                                    title={album.title}
                                    subtitle={album.artistName || t('library.album_singular')}
                                    imageUrl={album.coverUrl}
                                    onPress={() => navigation.navigate('AlbumDetail', { albumId: album.id })}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* --- 4. LISTAS INTELIGENTES (SMART PLAYLISTS) --- */}
                {smartLists.length > 0 && (
                    <View style={styles.sectionWrapper}>
                        <SectionHeader
                            title={t('profile.smart_playlists_title') || 'Listas inteligentes'}
                        />
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.horizontalScrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {smartLists.map((item) => (
                                <MediaCard
                                    key={item.id}
                                    id={item.id}
                                    type="playlist"
                                    title={item.title}
                                    subtitle={item.subtitle}
                                    onPress={() => handleSmartListPress(item.smartId)}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* --- 5. SUS PLAYLISTS (MIS LISTAS DE REPRODUCCIÓN) --- */}
                <View style={styles.sectionWrapper}>
                    <SectionHeader
                        title={t('profile.my_playlists_title') || 'Tus playlists'}
                    />
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Favoritos como playlist destacada */}
                        <MediaCard
                            id="favorites"
                            type="playlist"
                            title={t('home.your_favourites') || 'Tus Favoritos'}
                            subtitle={t('home.most_liked_songs') || 'Canciones favoritas'}
                            onPress={() => handlePlaylistPress('favorites')}
                        />

                        {playlists.map((playlist) => (
                            <MediaCard
                                key={`user-playlist-${playlist.id}`}
                                id={playlist.id}
                                type="playlist"
                                title={playlist.name}
                                subtitle={playlist.description || t('library.playlist_singular')}
                                customCoverUrl={playlist.coverCustomUrl}
                                onPress={() => handlePlaylistPress(playlist.id)}
                            />
                        ))}
                    </ScrollView>
                </View>

                {/* --- 6. RESUMEN RÁPIDO DE ACTIVIDAD / DESTACADOS --- */}
                <View style={styles.sectionWrapper}>
                    <SectionHeader
                        title={t('profile.quick_stats_title') || 'Destacados de reproducción'}
                    />

                    <View style={styles.highlightsCard}>
                        {/* Fila superior con tiempo de escucha */}
                        <View style={styles.highlightHeader}>
                            <View style={styles.highlightTimeContainer}>
                                <Ionicons name="time-outline" size={20} color={colors.accentLight} />
                                <Text style={styles.highlightTimeValue}>
                                    {totalHours > 0 ? `${totalHours.toFixed(1)} h` : '0 h'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.viewFullStatsButton}
                                onPress={() => navigation.navigate('WeeklyActivity')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.viewFullStatsText}>
                                    {t('profile.view_full_stats') || 'Ver estadísticas'}
                                </Text>
                                <Ionicons name="arrow-forward" size={14} color={colors.accentLight} />
                            </TouchableOpacity>
                        </View>

                        {/* Top Song y Top Artist en mini cards */}
                        {(topSong || topArtist) ? (
                            <View style={styles.topItemsRow}>
                                {topSong ? (
                                    <TouchableOpacity
                                        style={styles.topItemBox}
                                        onPress={handlePlayTopSong}
                                        activeOpacity={0.7}
                                    >
                                        {topSongImg ? (
                                            <Image source={{ uri: topSongImg }} style={styles.topItemImage} contentFit="cover" />
                                        ) : (
                                            <View style={[styles.topItemImage, styles.topItemPlaceholder]}>
                                                <Ionicons name="musical-note" size={20} color={colors.textSecondary} />
                                            </View>
                                        )}
                                        <View style={styles.topItemInfo}>
                                            <Text style={styles.topItemBadge}>{t('home.weekly_stats_song') || 'Canción top'}</Text>
                                            <Text style={styles.topItemTitle} numberOfLines={1}>{topSong}</Text>
                                            <Text style={styles.topItemSubtitle} numberOfLines={1}>{topSongArtist || t('actions.unknown')}</Text>
                                        </View>
                                        <Ionicons name="play-circle" size={24} color={colors.accentLight} />
                                    </TouchableOpacity>
                                ) : null}

                                {topArtist ? (
                                    <TouchableOpacity
                                        style={styles.topItemBox}
                                        onPress={handleTopArtistPress}
                                        activeOpacity={0.7}
                                    >
                                        {topArtistImg ? (
                                            <Image source={{ uri: topArtistImg }} style={[styles.topItemImage, { borderRadius: 20 }]} contentFit="cover" />
                                        ) : (
                                            <View style={[styles.topItemImage, styles.topItemPlaceholder, { borderRadius: 20 }]}>
                                                <Ionicons name="person" size={20} color={colors.textSecondary} />
                                            </View>
                                        )}
                                        <View style={styles.topItemInfo}>
                                            <Text style={styles.topItemBadge}>{t('home.weekly_stats_artist') || 'Artista top'}</Text>
                                            <Text style={styles.topItemTitle} numberOfLines={1}>{topArtist}</Text>
                                            <Text style={styles.topItemSubtitle} numberOfLines={1}>{t('library.artist_singular')}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ) : (
                            <View style={styles.emptyHighlights}>
                                <Text style={styles.emptyHighlightsText}>
                                    {t('profile.empty_stats') || 'Escucha música para ver tus destacados aquí.'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const getStyles = (
    colors: any,
    fonts: any,
    layout: any,
    spacing: any = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    radii: any = { sm: 4, md: 8, lg: 12, full: 9999 },
    fontWeights: any = { regular: '400', semiBold: '600', bold: '700' }
) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    userTierBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        gap: 4,
    },
    userTierBadgeSupporter: {
        backgroundColor: 'rgba(20, 184, 166, 0.18)',
        borderColor: '#14B8A6',
    },
    userTierBadgeVip: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    userTierBadgeText: {
        color: colors.textSecondary,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    userTierBadgeTextSupporter: {
        color: '#2DD4BF',
    },
    userTierBadgeTextVip: {
        color: '#FBBF24',
    },
    sectionWrapper: {
        marginBottom: 20,
    },
    horizontalScrollContent: {
        paddingHorizontal: spacing.lg || 20,
        gap: 12,
    },
    // Stats Card (Library Overview)
    statsCard: {
        backgroundColor: colors.cardBackground,
        marginHorizontal: spacing.lg || 20,
        padding: 16,
        borderRadius: radii.lg || 12,
        borderWidth: 1,
        borderColor: colors.overlayAlpha08 || 'rgba(255, 255, 255, 0.08)',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    statsCardTitle: {
        color: colors.text,
        fontSize: 15,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        color: colors.accentLight || '#A78BFA',
        fontSize: 20,
        fontFamily: fonts.regular,
        fontWeight: '800',
        marginBottom: 2,
    },
    statLabel: {
        color: colors.textSecondary,
        fontSize: 11,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: colors.overlayAlpha08 || 'rgba(255, 255, 255, 0.08)',
    },
    // Highlights Card
    highlightsCard: {
        backgroundColor: colors.cardBackground,
        marginHorizontal: spacing.lg || 20,
        padding: 16,
        borderRadius: radii.lg || 12,
        borderWidth: 1,
        borderColor: colors.overlayAlpha08 || 'rgba(255, 255, 255, 0.08)',
    },
    highlightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    highlightTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    highlightTimeValue: {
        color: colors.text,
        fontSize: 18,
        fontFamily: fonts.regular,
        fontWeight: '800',
    },
    viewFullStatsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    viewFullStatsText: {
        color: colors.accentLight || '#A78BFA',
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    topItemsRow: {
        flexDirection: 'column',
        gap: 10,
    },
    topItemBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        padding: 10,
        borderRadius: 10,
        gap: 12,
    },
    topItemImage: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: colors.cardBackground,
    },
    topItemPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.overlayAlpha12 || 'rgba(255, 255, 255, 0.12)',
    },
    topItemInfo: {
        flex: 1,
    },
    topItemBadge: {
        color: colors.accentLight || '#A78BFA',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    topItemTitle: {
        color: colors.text,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    topItemSubtitle: {
        color: colors.textSecondary,
        fontSize: 12,
        fontFamily: fonts.regular,
    },
    emptyHighlights: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    emptyHighlightsText: {
        color: colors.textSecondary,
        fontSize: 13,
        fontFamily: fonts.regular,
        textAlign: 'center',
    },
});

const ObservableUserProfileScreen = withObservables([], () => ({
    tracksCount: database.get('tracks').query().observeCount(),
    albumsCount: database.get('albums').query().observeCount(),
    artistsCount: database.get('artists').query().observeCount(),
    playlistsCount: database.get('playlists').query().observeCount(),
    playlists: database.get<Playlist>('playlists').query().observe(),
}))(UserProfileScreenBase);

export default function UserProfileScreen() {
    return <ObservableUserProfileScreen />;
}
