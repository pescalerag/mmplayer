import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Track from '../database/models/Track';
import { formatTrackTime } from '../utils/time';


interface TrackRowProps {
    track: Track;
    index?: number;
    coverUrl?: string | null;
    artistName?: string;
    onPress?: (trackId: string) => void;
}

function TrackRow({ track, index, coverUrl, artistName, onPress }: TrackRowProps) {

    return (
        <TouchableOpacity
            style={styles.row}
            onPress={() => onPress && onPress(track.id)}
            activeOpacity={0.6}
        >
            {/* Imagen o número de pista */}
            <View style={styles.leftCol}>
                {coverUrl ? (
                    <Image
                        source={{ uri: coverUrl }}
                        style={styles.cover}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={styles.coverPlaceholder}>
                        {index ? (
                            <Text style={styles.indexText}>{index}</Text>
                        ) : (
                            <Ionicons name="musical-notes" size={16} color="#B3B3B3" />
                        )}
                    </View>
                )}
            </View>

            {/* Info */}
            <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
                {artistName && <Text style={styles.artist} numberOfLines={1}>{artistName}</Text>}
            </View>

            {/* Duración */}
            <Text style={styles.duration}>{formatTrackTime(track.duration)}</Text>
        </TouchableOpacity>
    );
}

export default memo(TrackRow);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    leftCol: {
        marginRight: 12,
    },
    cover: {
        width: 44,
        height: 44,
        borderRadius: 4,
    },
    coverPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 4,
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    artist: {
        color: '#CCCCCC',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
        marginTop: 2,
    },
    duration: {
        color: '#CCCCCC',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
        marginLeft: 8,
    },
    indexText: {
        color: '#B3B3B3',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
});
