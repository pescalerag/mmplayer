import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../theme/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { State, usePlaybackState } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayingIndicator } from '../components/PlayingIndicator';
import RecentPlaylistCard from '../components/RecentPlaylistCard';
import { database } from '../database';
import Track from '../database/models/Track';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import { usePlayerStore } from '../store/usePlayerStore';
import { HistoryService } from '../services/HistoryService';
import { useTrackMenuStore } from '../store/useTrackMenuStore';
import { useAlbumMenuStore } from '../store/useAlbumMenuStore';
import { useArtistMenuStore } from '../store/useArtistMenuStore';
import { usePlaylistMenuStore } from '../store/usePlaylistMenuStore';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const gridItemWidth = (width - 48) / 2;

const RecentMediaCard = React.memo(({ item, isActuallyPlaying, activeTrack, onPress, onLongPress }: any) => {
    const { colors, fonts, layout, radii, fontWeights } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, undefined, radii, fontWeights), [colors, fonts, layout, radii, fontWeights]);
    const [imageError, setImageError] = React.useState(false);
    
    React.useEffect(() => {
        setImageError(false);
    }, [item.id, item.imageUrl]);

    const isCurrentTrack = item.type === 'track' && activeTrack?.id === item.id;
    const isActive = isCurrentTrack;
    
    const showImage = Boolean(item.imageUrl && item.imageUrl !== 'null' && item.imageUrl.trim() !== '') && !imageError;

    const handlePress = React.useCallback(() => onPress(item), [item, onPress]);
    const handleLongPress = React.useCallback(() => onLongPress?.(item), [item, onLongPress]);

    return (
        <TouchableOpacity
            style={[styles.gridCard, isActive && styles.gridCardActive]}
            onPress={handlePress}
            onLongPress={handleLongPress}
            delayLongPress={300}
            activeOpacity={0.7}
        >
            {showImage ? (
                <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.gridImage}
                    contentFit="cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                <View style={[styles.gridImage, styles.placeholderGrid]}>
                    <Ionicons name={item.type === 'album' ? 'albums' : 'musical-note'} size={24} color={colors.textSecondary} />
                </View>
            )}
            <View style={styles.gridInfo}>
                <Text style={[styles.gridTitle, isActive && styles.gridTitleActive]} numberOfLines={2}>
                    {item.title}
                </Text>
                {isCurrentTrack && (
                    <PlayingIndicator isPaused={!isActuallyPlaying} color={colors.accentLight} />
                )}
            </View>
        </TouchableOpacity>
    );
});
RecentMediaCard.displayName = 'RecentMediaCard';

export default function HomeScreen() {
    const { colors, fonts, layout, spacing, radii, fontWeights } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights), [colors, fonts, layout, spacing, radii, fontWeights]);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { t } = useTranslation();
    const [headerHeight, setHeaderHeight] = React.useState(100);

    const getGreetingKey = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'home.welcome_morning';
        if (hour < 20) return 'home.welcome_afternoon';
        return 'home.welcome_evening';
    };

    const recentMediaRaw = usePlayerStore(state => state.recentMedia);
    const recentMedia = React.useMemo(() => recentMediaRaw || [], [recentMediaRaw]);
    const recentPlaylistsRaw = usePlayerStore(state => state.recentPlaylists);
    const recentPlaylists = React.useMemo(() => recentPlaylistsRaw || [], [recentPlaylistsRaw]);
    const activeTrack = usePlayerStore(state => state.activeTrack);

    // Modal logic moved to App.tsx
    useEffect(() => {
        HistoryService.initializeDefaultsIfNeeded();
    }, []);

    const playbackStateRN = usePlaybackState();
    const isActuallyPlaying = playbackStateRN.state === State.Playing || playbackStateRN.state === State.Buffering;

    const handleMediaPress = React.useCallback(async (item: any) => {
        if (item.type === 'album') {
            navigation.navigate('AlbumDetail', { albumId: item.id });
        } else if (item.type === 'artist') {
            navigation.navigate('ArtistDetail', { artistId: item.id });
        } else if (item.type === 'track') {
            try {
                const track = await database.get<Track>('tracks').find(item.id);
                usePlayerStore.getState().playSingleTrack(track, 'home-recents');
            } catch (error) {
                console.error('Error al reproducir track reciente:', error);
            }
        }
    }, [navigation]);

    const handleMediaLongPress = React.useCallback(async (item: any) => {
        try {
            if (item.type === 'album') {
                const album = await database.get<Album>('albums').find(item.id);
                useAlbumMenuStore.getState().openMenu(album);
            } else if (item.type === 'artist') {
                const artist = await database.get<Artist>('artists').find(item.id);
                useArtistMenuStore.getState().openMenu(artist);
            } else if (item.type === 'track') {
                const track = await database.get<Track>('tracks').find(item.id);
                useTrackMenuStore.getState().openMenu(track, {
                    album: (albumId) => navigation.navigate('AlbumDetail', { albumId }),
                    artist: (artistId) => navigation.navigate('ArtistDetail', { artistId })
                });
            }
        } catch (error) {
            console.error('Error al abrir menu contextual de reciente:', error);
        }
    }, [navigation]);

    const handlePlaylistPress = React.useCallback((id: string) => {
        if (id === 'favorites') {
            navigation.navigate('FavoritesDetail');
        } else {
            navigation.navigate('PlaylistDetail', { playlistId: id });
        }
    }, [navigation]);

    const handlePlaylistLongPress = React.useCallback((id: string) => {
        const playlist = recentPlaylists.find(p => p.id === id);
        if (playlist) {
            usePlaylistMenuStore.getState().openMenu(playlist as any);
        }
    }, [recentPlaylists]);

    return (
        <View style={styles.container}>
            {/* 2. CAPA DEL HUMO (INTERMEDIO) */}
            <LinearGradient
                colors={[
                    '#000000',
                    'rgba(0, 0, 0, 0.95)',
                    'rgba(0, 0, 0, 0.8)',
                    'transparent'
                ]}
                locations={[0, 0.45, 0.8, 1]}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: headerHeight + 30,
                    zIndex: 1,
                }}
                pointerEvents="none"
            />

            {/* 2.5 CAPA DE ILUMINACIÓN MORADA (SOBRE EL HUMO) */}
            <LinearGradient
                colors={[colors.accentAlpha20, "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
                pointerEvents="none"
            />

            {/* 3. CAPA DE LA INTERFAZ (FRENTE) */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    paddingTop: insets.top + 10,
                    paddingBottom: 10,
                    zIndex: 10,
                }}
            >
                <Text style={[styles.welcomeText, { marginBottom: 0 }]}>{t(getGreetingKey())}</Text>
            </View>

            {/* 1. CAPA DE CONTENIDO (AL FONDO) */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: headerHeight + 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >

            {/* SECCIÓN 1: Grid 2x3 de Recientes (Canciones y Álbumes) */}
            {recentMedia.length > 0 ? (
                <View style={styles.gridContainer}>
                    {recentMedia.map((item) => (
                        <RecentMediaCard 
                            key={`${item.id}-${item.type}`} 
                            item={item} 
                            isActuallyPlaying={isActuallyPlaying} 
                            activeTrack={activeTrack} 
                            onPress={handleMediaPress} 
                            onLongPress={handleMediaLongPress}
                        />
                    ))}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>{t('home.empty_recents')}</Text>
                </View>
            )}

            {/* SECCIÓN 2: Playlists Recientes */}
            <Text style={styles.sectionTitle}>{t('home.my_playlists')}</Text>

            {recentPlaylists.length > 0 ? (
                <View style={styles.playlistsContainer}>
                    {recentPlaylists.map((playlist, idx) => (
                        <RecentPlaylistCard
                            key={`${playlist.id}-${idx}`}
                            id={playlist.id}
                            name={playlist.name}
                            description={playlist.description}
                            customCoverUrl={(playlist as any).imageUrl}
                            onPress={handlePlaylistPress}
                            onLongPress={handlePlaylistLongPress}
                        />
                    ))}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>{t('home.empty_playlists')}</Text>
                </View>
            )}
        </ScrollView>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any, spacing: any = {xs: 4, sm: 8, md: 16, lg: 24, xl: 32}, radii: any = {sm: 4, md: 8, lg: 12, full: 9999}, fontWeights: any = {regular: '400', semiBold: '600', bold: '700'}) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background, // Fondo global
    },
    welcomeText: {
        color: colors.text,
        fontSize: 26,
        fontFamily: fonts.regular,
        fontWeight: '800', // Explicitly extra bold, but we can fall back to bold if not in token
        paddingHorizontal: spacing.lg || 20,
        marginBottom: spacing.lg || 20,
        letterSpacing: -0.5,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 20,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
        paddingHorizontal: spacing.lg || 20,
        marginTop: spacing.xl || 32,
        marginBottom: spacing.md || 16,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.md || 16,
        gap: spacing.sm || 8, // Adjusting gap to standard sm
        justifyContent: 'space-between'
    },
    gridCard: {
        width: gridItemWidth,
        height: 56,
        backgroundColor: colors.cardBackground,
        borderRadius: radii.md || 8, // originally 6, but 8 is close
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    gridCardActive: {
        backgroundColor: colors.accentAlpha18,
        borderWidth: 1,
        borderColor: colors.accentLightAlpha35,
    },
    gridImage: {
        width: 56,
        height: 56,
        backgroundColor: colors.cardBackground
    },
    placeholderGrid: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    gridInfo: {
        flex: 1,
        paddingHorizontal: 10,
        justifyContent: 'center',
    },
    gridTitle: {
        color: colors.text,
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
        lineHeight: 16,
    },
    gridTitleActive: {
        color: colors.accentLight,
    },
    playlistsContainer: {
        paddingBottom: spacing.lg || 20,
    },
    emptyState: {
        paddingHorizontal: spacing.lg || 20,
        paddingVertical: spacing.sm || 10,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
});