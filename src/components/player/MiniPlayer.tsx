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
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import Track from '../../database/models/Track';
import { MainNavigationProp } from '../../navigation/types';
import { usePlayerStore } from '../../store/usePlayerStore';
import BlurredBackground from '@/components/layouts/BlurredBackground';
import PlayPauseButton from '@/components/common/PlayPauseButton';
import { extractColorFromImage } from '../../../modules/native-equalizer';

// Helper functions for hex color conversions and dark overlay generation
const hexToHsl = (hex: string): { h: number, s: number, l: number } => {
    let r = 0, g = 0, b = 0;
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const y = Math.min(Math.max(Math.min(k(n) - 3, 9 - k(n)), -1), 1);
        return Math.round(255 * (l - a * y)).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

const hexToRgba = (hex: string, alpha: number): string => {
    hex = hex.replace(/^#/, '');
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// --- FONDO DIFUMINADO ---

const MiniPlayerBackground = withObservables(['track'], ({ track }: { track: any }) => ({
    track: track.observe(),
    album: track.album.observe(),
}))(({ album }: { album: Album }) => {
    const { colors } = useAppTheme();
    const [coverColor, setCoverColor] = React.useState<string | null>(null);

    React.useEffect(() => {
        let isMounted = true;
        if (!album.coverUrl) {
            setCoverColor(null);
            return;
        }

        extractColorFromImage(album.coverUrl)
            .then(color => {
                if (isMounted) {
                    setCoverColor(color);
                }
            })
            .catch(err => {
                console.error("Error extracting cover color in MiniPlayer:", err);
                if (isMounted) {
                    setCoverColor(null);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [album.coverUrl]);

    const overlayColors = React.useMemo(() => {
        if (coverColor) {
            try {
                const hsl = hexToHsl(coverColor);
                // Create a dark version of the color: Saturation 25%, Lightness 12%
                const darkHex = hslToHex(hsl.h, 25, 12);
                // Convert it to RGBA with 0.65 opacity to overlay on the cover
                const rgbaVal = hexToRgba(darkHex, 0.65);
                return [rgbaVal, rgbaVal];
            } catch (e) {
                return ['rgba(18,18,18,0.6)', 'rgba(18,18,18,0.6)'];
            }
        }
        return ['rgba(18,18,18,0.6)', 'rgba(18,18,18,0.6)'];
    }, [coverColor]);

    const placeholderBg = React.useMemo(() => {
        if (coverColor) {
            try {
                const hsl = hexToHsl(coverColor);
                // Solid dark color: Saturation 25%, Lightness 10%
                return hslToHex(hsl.h, 25, 10);
            } catch (e) {
                return colors.cardBackground;
            }
        }
        return colors.cardBackground;
    }, [coverColor, colors.cardBackground]);

    return (
        <BlurredBackground
            imageUrl={album.coverUrl}
            blurIntensity={Platform.OS === 'ios' ? 40 : 70}
            gradientColors={overlayColors}
            placeholderColors={[placeholderBg, placeholderBg]}
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