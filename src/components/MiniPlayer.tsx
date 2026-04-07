// src/components/MiniPlayer.tsx
import withObservables from '@nozbe/with-observables';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BlurredBackground from './BlurredBackground';

import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';

// --- FONDO DIFUMINADO ---

const MiniPlayerBackground = withObservables(['track'], ({ track }: { track: any }) => ({
    track: track.observe(),
    album: track.album.observe(),
}))(({ album }: { album: Album }) => (
    <BlurredBackground
        imageUrl={album.coverUrl}
        blurIntensity={Platform.OS === 'ios' ? 40 : 70}
        gradientColors={['rgba(26, 26, 26, 0.3)', 'rgba(0, 0, 0, 0.6)']}
    />
));


import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
    useProgress
} from 'react-native-track-player';

import { MainNavigationProp } from '../navigation/types';
import { usePlayerStore } from '../store/usePlayerStore';
import PlayPauseButton from './PlayPauseButton';


interface MiniPlayerUIProps {
    track: Track;
    album: Album;
    artist: Artist;
    progress: number;
    onPress: () => void;
}

const MiniPlayerUI = ({ track, album, artist, progress, onPress }: MiniPlayerUIProps) => {

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={styles.container}
        >
            <MiniPlayerBackground track={track} />

            <View style={styles.content}>
                <View style={styles.leftSection}>
                    <View style={styles.artworkContainer}>
                        {album.coverUrl ? (
                            <Image
                                source={{ uri: album.coverUrl }}
                                style={styles.artwork}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={styles.artworkPlaceholder}>
                                <Ionicons name="musical-note" size={24} color="#535353" />
                            </View>
                        )}
                    </View>

                    <View style={styles.info}>
                        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
                        <Text style={styles.artist} numberOfLines={1}>{artist.name}</Text>
                    </View>
                </View>

                <View style={styles.controls}>
                    {/* USAMOS EL COMPONENTE UNIVERSAL AQUÍ */}
                    <PlayPauseButton size={32} style={styles.playPauseButton} />
                </View>
            </View>

            <View style={styles.progressContainer}>
                <View style={[styles.progressIndicator, { width: `${progress}%` }]} />
            </View>
        </TouchableOpacity>
    );
};

const ObservableMiniPlayerUI = withObservables(['trackModel'], ({ trackModel }) => ({
    track: trackModel.observe(),
    album: trackModel.album.observe(),
    artist: trackModel.artist.observe(),
}))(MiniPlayerUI);

const MiniPlayer = () => {
    const activeTrackModel = usePlayerStore(state => state.activeTrack);
    const { position, duration } = useProgress();
    const navigation = useNavigation<MainNavigationProp>();



    if (!activeTrackModel) return null;

    const progress = duration > 0 ? (position / duration) * 100 : 0;

    return (
        <ObservableMiniPlayerUI
            trackModel={activeTrackModel}
            progress={progress}
            onPress={() => navigation.navigate('Player')}
        />
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', height: 64, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', elevation: 10 },
    content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    leftSection: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    artwork: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#282828' },
    artworkContainer: { width: 44, height: 44, borderRadius: 6, overflow: 'hidden' },
    artworkPlaceholder: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' },
    info: { flex: 1, marginLeft: 12 },
    title: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Montserrat', fontWeight: '700' },
    artist: { color: '#B3B3B3', fontSize: 12, fontFamily: 'Montserrat', marginTop: 2 },
    controls: { flexDirection: 'row', alignItems: 'center' },
    controlIcon: { padding: 8 },
    playPauseButton: { padding: 4 },
    progressContainer: { width: '100%', height: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.15)', position: 'absolute', bottom: 0 },
    progressIndicator: { height: '100%', backgroundColor: '#ffffffff' },
});

export default MiniPlayer;