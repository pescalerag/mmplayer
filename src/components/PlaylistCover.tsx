import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { database } from '../database';
import PlaylistTrack from '../database/models/PlaylistTrack';

interface PlaylistCoverProps {
    playlistId: string;
    isFavorites?: boolean;
    size?: number;
    customCoverUrl?: string | null;
    width?: number;
    height?: number;
    borderRadius?: number;
}

export default function PlaylistCover({
    playlistId,
    isFavorites = false,
    size = 120,
    customCoverUrl = null,
    width: propWidth,
    height: propHeight,
    borderRadius = 12,
}: PlaylistCoverProps) {
    const [covers, setCovers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const w = propWidth ?? size;
    const h = propHeight ?? size;

    useEffect(() => {
        if (isFavorites || customCoverUrl) {
            setLoading(false);
            return;
        }

        const loadCovers = async () => {
            try {
                const pts = await database.collections.get<PlaylistTrack>('playlist_tracks')
                    .query(Q.where('playlist_id', playlistId), Q.sortBy('order', Q.asc))
                    .fetch();

                const uniqueCovers = new Set<string>();
                for (const pt of pts) {
                    const track = await pt.track.fetch();
                    if (track) {
                        const album = await track.album.fetch();
                        if (album?.coverUrl) uniqueCovers.add(album.coverUrl);
                    }
                    if (uniqueCovers.size === 4) break; // Paramos cuando tengamos 4 distintas
                }
                setCovers(Array.from(uniqueCovers));
            } catch (e) {
                console.error('Error al cargar carátulas para PlaylistCover:', e);
            } finally {
                setLoading(false);
            }
        };

        loadCovers();
    }, [playlistId, isFavorites, customCoverUrl]);

    if (isFavorites) {
        return (
            <LinearGradient
                colors={['#7C3AED', '#4C1D95']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.container, { width: w, height: h, borderRadius }]}
            >
                <Ionicons name="heart" size={Math.min(w, h) * 0.45} color="#FFFFFF" />
            </LinearGradient>
        );
    }

    if (customCoverUrl) {
        return (
            <Image
                source={{ uri: customCoverUrl }}
                style={[styles.container, { width: w, height: h, borderRadius }]}
                contentFit="cover"
                transition={200}
            />
        );
    }

    if (loading) {
        return (
            <View style={[styles.placeholder, { width: w, height: h, borderRadius }]}>
                <Ionicons name="musical-notes" size={Math.min(w, h) * 0.35} color="#444" />
            </View>
        );
    }

    if (covers.length >= 4) {
        return (
            <View style={[styles.gridContainer, { width: w, height: h, borderRadius }]}>
                <View style={styles.gridRow}>
                    <Image source={{ uri: covers[0] }} style={styles.gridCell} contentFit="cover" />
                    <Image source={{ uri: covers[1] }} style={styles.gridCell} contentFit="cover" />
                </View>
                <View style={styles.gridRow}>
                    <Image source={{ uri: covers[2] }} style={styles.gridCell} contentFit="cover" />
                    <Image source={{ uri: covers[3] }} style={styles.gridCell} contentFit="cover" />
                </View>
            </View>
        );
    }

    if (covers.length > 0 && covers[0]) {
        return (
            <Image
                source={{ uri: covers[0] }}
                style={[styles.container, { width: w, height: h, borderRadius }]}
                contentFit="cover"
                transition={200}
            />
        );
    }

    // Por defecto (vacío)
    return (
        <LinearGradient
            colors={['#1A1A1A', '#0D0D0D']}
            style={[styles.placeholder, { width: w, height: h, borderRadius }]}
        >
            <Ionicons name="musical-note" size={Math.min(w, h) * 0.4} color="#555" />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
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
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    gridContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#111',
    },
    gridRow: {
        flex: 1,
        flexDirection: 'row',
    },
    gridCell: {
        flex: 1,
    },
});
