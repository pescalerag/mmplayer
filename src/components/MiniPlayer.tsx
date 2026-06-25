// src/components/MiniPlayer.tsx
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { scheduleOnRN } from 'react-native-worklets';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { MainNavigationProp } from '../navigation/types';
import { usePlayerStore } from '../store/usePlayerStore';
import BlurredBackground from './BlurredBackground';
import PlayPauseButton from './PlayPauseButton';

// --- FONDO DIFUMINADO ---

const MiniPlayerBackground = withObservables(['track'], ({ track }: { track: any }) => ({
    track: track.observe(),
    album: track.album.observe(),
}))(({ album }: { album: Album }) => {
    const { colors } = useAppTheme();
    return (
        <BlurredBackground
            imageUrl={album.coverUrl}
            blurIntensity={Platform.OS === 'ios' ? 40 : 70}
            gradientColors={['rgba(18,18,18,0.6)', 'rgba(18,18,18,0.6)']}
            placeholderColors={[colors.cardBackground, colors.cardBackground]}
        />
    );
});



interface MiniPlayerUIProps {
    track: Track;
    album: Album;
    artist: Artist;
    artists: Artist[];
    onPress: () => void;
}

const MiniProgressBar = () => {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const { position, duration } = useProgress();
    const progress = duration > 0 ? (position / duration) * 100 : 0;

    return (
        <View style={styles.progressContainer}>
            <View style={[styles.progressIndicator, { width: `${progress}%` }]} />
        </View>
    );
};

const MiniPlayerUI = ({ track, album, artist, artists, onPress }: MiniPlayerUIProps) => {
    const { colors, fonts, layout, spacing, radii, fontWeights, shadows } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights, shadows), [colors, fonts, layout, spacing, radii, fontWeights, shadows]);
    const [imageError, setImageError] = React.useState(false);

    const hasNext = usePlayerStore(state => state.hasNext);
    const hasPrevious = usePlayerStore(state => state.hasPrevious);

    const translateX = useSharedValue(0);
    const hasTriggeredHaptic = useSharedValue(false);
    const SWIPE_THRESHOLD = 60;

    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const skipNext = () => TrackPlayer.skipToNext().catch(() => { });
    const skipPrevious = () => TrackPlayer.skipToPrevious().catch(() => { });

    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onUpdate((event) => {
            translateX.value = event.translationX;
            if (Math.abs(translateX.value) > SWIPE_THRESHOLD && !hasTriggeredHaptic.value) {
                hasTriggeredHaptic.value = true;
                scheduleOnRN(triggerHaptic);
            } else if (Math.abs(translateX.value) <= SWIPE_THRESHOLD) {
                hasTriggeredHaptic.value = false;
            }
        })
        .onEnd(() => {
            if (translateX.value < -SWIPE_THRESHOLD && hasNext) {
                scheduleOnRN(skipNext);
            } else if (translateX.value > SWIPE_THRESHOLD && hasPrevious) {
                scheduleOnRN(skipPrevious);
            }
            translateX.value = withSpring(0, { damping: 30, stiffness: 90, mass: 1 });
            hasTriggeredHaptic.value = false;
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }]
    }));

    React.useEffect(() => {
        setImageError(false);
    }, [track.id]);

    return (
        <View style={styles.container}>
            <MiniPlayerBackground track={track} />

            <View style={styles.miniPlayerRow}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.swipeableArea, animatedStyle]}>
                        <TouchableOpacity
                            style={styles.swipeableContent}
                            onPress={onPress}
                            activeOpacity={0.9}
                        >
                            <View style={styles.artworkContainer}>
                                {album.coverUrl && !imageError ? (
                                    <Image
                                        key={track.id}
                                        source={{ uri: album.coverUrl as string }}
                                        style={styles.artwork}
                                        contentFit="cover"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <View style={[styles.artwork, styles.artworkPlaceholder]}>
                                        <Ionicons name="musical-notes" size={16} color={colors.textSecondary} />
                                    </View>
                                )}
                            </View>

                            <View style={styles.info}>
                                <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
                                <Text style={styles.artist} numberOfLines={1}>
                                    {artists && artists.length > 0 ? artists.map(a => a.name).join(', ') : (artist?.name || 'Artista Desconocido')}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </GestureDetector>

                <View style={styles.safeControlsArea}>
                    <PlayPauseButton size={32} style={styles.playPauseButton} />
                </View>
            </View>

            <MiniProgressBar />
        </View>
    );
};

const ObservableMiniPlayerUI = withObservables(['trackModel'], ({ trackModel }) => ({
    track: trackModel.observe(),
    album: trackModel.album.observe(),
    artist: trackModel.artist.observe(),
    artists: trackModel.queryCollaborators.observe(),
}))(MiniPlayerUI);

const MiniPlayer = () => {
    const activeTrackModel = usePlayerStore(state => state.activeTrack);
    const navigation = useNavigation<MainNavigationProp>();



    if (!activeTrackModel) return null;

    return (
        <ObservableMiniPlayerUI
            trackModel={activeTrackModel}
            onPress={() => navigation.navigate('Player')}
        />
    );
};

const getStyles = (colors: any, fonts: any, layout: any, spacing: any = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }, radii: any = { sm: 4, md: 8, lg: 12, full: 9999 }, fontWeights: any = { regular: '400', semiBold: '600', bold: '700' }, shadows: any = { lg: {} }) => StyleSheet.create({
    container: { width: '100%', height: layout.MINI_PLAYER_HEIGHT, borderRadius: radii.lg || 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.overlayAlpha10, ...shadows.lg },
    miniPlayerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', width: '100%' },
    swipeableArea: { flex: 1 },
    swipeableContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md || 12 },
    safeControlsArea: { paddingHorizontal: spacing.md || 12, justifyContent: 'center', alignItems: 'center' },
    artwork: { width: 44, height: 44, borderRadius: radii.sm || 6, backgroundColor: colors.cardBackground },
    artworkPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    artworkContainer: { width: 44, height: 44, borderRadius: radii.sm || 6, overflow: 'hidden' },
    info: { flex: 1, marginLeft: spacing.sm || 12 },
    title: { color: colors.text, fontSize: 14, fontFamily: fonts.regular, fontWeight: fontWeights.bold },
    artist: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.regular, fontWeight: fontWeights.bold, marginTop: 2 },
    playPauseButton: { padding: spacing.xs || 4 },
    progressContainer: { width: '100%', height: 2.5, backgroundColor: colors.overlayAlpha15, position: 'absolute', bottom: 0 },
    progressIndicator: { height: '100%', backgroundColor: colors.text },
});

export default MiniPlayer;