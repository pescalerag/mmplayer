import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient'; // Asegúrate de tener expo-linear-gradient instalado
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PlaylistCover from './PlaylistCover';

interface RecentPlaylistCardProps {
    id: string;
    name: string;
    description: string | null;
    customCoverUrl?: string | null;
    onPress: () => void;
}

const { width } = Dimensions.get('window');

export default function RecentPlaylistCard({ id, name, description, customCoverUrl, onPress }: RecentPlaylistCardProps) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            {/* Fondo con degradado oscuro de izquierda a derecha */}
            <LinearGradient
                colors={['#181818', 'rgba(24, 24, 24, 0.85)', 'rgba(24, 24, 24, 0.3)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientContainer}
            >
                <View style={styles.textSection}>
                    <Text style={styles.title} numberOfLines={1}>{name}</Text>
                    <Text style={styles.description} numberOfLines={2}>
                        {description || 'Lista de reproducción personalizada'}
                    </Text>
                </View>
            </LinearGradient>

            <View style={styles.imageSection}>
                <PlaylistCover playlistId={id} isFavorites={id === 'favorites'} width={90} height={90} borderRadius={0} customCoverUrl={customCoverUrl} />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: width - 40,
        height: 90,
        backgroundColor: '#121212',
        borderRadius: 8,
        flexDirection: 'row',
        overflow: 'hidden',
        marginBottom: 12,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    gradientContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 16,
        zIndex: 2,
    },
    textSection: {
        width: '75%',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    description: {
        color: '#B3B3B3',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '500',
        marginTop: 4,
        lineHeight: 16,
    },
    imageSection: {
        width: 90,
        height: 90,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1,
    },
});
