import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { database } from '../../database';
import PlaylistTrack from '../../database/models/PlaylistTrack';
import Playlist from '../../database/models/Playlist';
import { useAppTheme } from "@/hooks/useAppTheme";
import { SmartListService } from '../../services/SmartListService';

interface PlaylistCoverProps {
    readonly playlistId: string;
    readonly isFavorites?: boolean;
    readonly size?: number;
    readonly customCoverUrl?: string | null;
    readonly width?: number;
    readonly height?: number;
    readonly borderRadius?: number;
}

export default function PlaylistCover({
    playlistId,
    isFavorites = false,
    size = 120,
    customCoverUrl = null,
    width: propWidth,
    height: propHeight,
    borderRadius = 12,
}: Readonly<PlaylistCoverProps>) {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const [firstCover, setFirstCover] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const w = propWidth ?? size;
    const h = propHeight ?? size;

    if (playlistId.startsWith('smart-list-')) {
        const id = playlistId.replace('smart-list-', '');
        const smartList = SmartListService.getSmartLists().find(l => l.id === id);
        const iconName = smartList?.placeholderIcon || 'musical-notes';
        
        let gradientColors: readonly [string, string] = ['#F59E0B', '#D97706']; // Gold default
        if (id.includes('week')) {
            gradientColors = ['#3B82F6', '#1D4ED8']; // Blue
        } else if (id.includes('month')) {
            gradientColors = ['#10B981', '#047857']; // Green
        } else if (id === 'rating_5') {
            gradientColors = ['#F59E0B', '#B45309']; // Gold
        } else if (id === 'rating_unrated') {
            gradientColors = ['#4B5563', '#1F2937']; // Slate Gray
        } else if (id === 'rating_1_2') {
            gradientColors = ['#EF4444', '#B91C1C']; // Red
        } else if (id === 'rating_2_3') {
            gradientColors = ['#F97316', '#C2410C']; // Orange
        } else if (id === 'rating_3_4') {
            gradientColors = ['#8B5CF6', '#6D28D9']; // Purple
        } else if (id.includes('rating')) {
            gradientColors = ['#EC4899', '#BE185D']; // Pink
        } else if (id === 'top_50') {
            gradientColors = ['#8B5CF6', '#6D28D9']; // Violet
        }

        return (
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.container, { width: w, height: h, borderRadius }]}
            >
                <Ionicons name={iconName} size={Math.min(w, h) * 0.45} color={colors.text} />
            </LinearGradient>
        );
    }

    useEffect(() => {
        if (isFavorites || customCoverUrl) {
            setLoading(false);
            return;
        }

        const loadCover = async () => {
            try {
                try {
                    const playlist = await database.get<Playlist>('playlists').find(playlistId);
                    if (playlist?.coverCustomUrl && playlist.coverCustomUrl !== 'null') {
                        setFirstCover(playlist.coverCustomUrl);
                        setLoading(false);
                        return;
                    }
                } catch {
                    // Ignoramos si no se encuentra (ej: id 'favorites')
                }

                const pts = await database.collections.get<PlaylistTrack>('playlist_tracks')
                    .query(Q.where('playlist_id', playlistId), Q.sortBy('order', Q.asc))
                    .fetch();

                for (const pt of pts) {
                    const track = await pt.track.fetch();
                    if (track) {
                        const album = await track.album.fetch();
                        const url = album?.coverUrl;
                        if (url && url !== 'null' && url.trim() !== '') {
                            setFirstCover(url);
                            break; // Paramos con la primera cover real
                        }
                    }
                }
            } catch (e) {
                console.error('Error al cargar carátula para PlaylistCover:', e);
            } finally {
                setLoading(false);
            }
        };

        loadCover();
    }, [playlistId, isFavorites, customCoverUrl]);

    if (isFavorites) {
        return (
            <LinearGradient
                colors={['#7C3AED', '#4C1D95']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.container, { width: w, height: h, borderRadius }]}
            >
                <Ionicons name="heart" size={Math.min(w, h) * 0.45} color={colors.text} />
            </LinearGradient>
        );
    }

    const customSource = React.useMemo(() => {
        if (!customCoverUrl) return null;
        if (customCoverUrl.startsWith('file://') && !customCoverUrl.includes('?t=')) {
            return { uri: `${customCoverUrl}?t=${Date.now()}` };
        }
        return { uri: customCoverUrl };
    }, [customCoverUrl]);

    const firstCoverSource = React.useMemo(() => {
        if (!firstCover) return null;
        if (firstCover.startsWith('file://') && !firstCover.includes('?t=')) {
            return { uri: `${firstCover}?t=${Date.now()}` };
        }
        return { uri: firstCover };
    }, [firstCover]);

    if (customSource) {
        return (
            <Image
                source={customSource}
                style={[styles.container, { width: w, height: h, borderRadius }]}
                contentFit="cover"
                transition={200}
            />
        );
    }

    if (loading) {
        return (
            <View style={[styles.placeholder, { width: w, height: h, borderRadius }]}>
                <Ionicons name="musical-note" size={Math.min(w, h) * 0.35} color="#444" />
            </View>
        );
    }

    if (firstCoverSource) {
        return (
            <Image
                source={firstCoverSource}
                style={[styles.container, { width: w, height: h, borderRadius }]}
                contentFit="cover"
                transition={200}
            />
        );
    }

    // Sin canciones con portada → placeholder
    return (
        <LinearGradient
            colors={['#1A1A1A', '#0D0D0D']}
            style={[styles.placeholder, { width: w, height: h, borderRadius }]}
        >
            <Ionicons name="musical-note" size={Math.min(w, h) * 0.4} color="#555" />
        </LinearGradient>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholder: {
        borderRadius: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
});
