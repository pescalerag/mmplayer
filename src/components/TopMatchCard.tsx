import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, Keyboard } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS, clamp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { TopMatch } from '../hooks/useMusicSearch';
import { useTrackMenuStore } from '../store/useTrackMenuStore';
import { useAlbumMenuStore } from '../store/useAlbumMenuStore';
import { useArtistMenuStore } from '../store/useArtistMenuStore';
import { useSettingsStore, SwipeAction } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import i18n from '../constants/i18n';
import BlurredBackground from './BlurredBackground';
import { useAppTheme } from "@/hooks/useAppTheme";

interface TopMatchCardProps {
    match: TopMatch;
    onPress: () => void;
}

interface LayoutProps {
    title: string;
    subtitle: string;
    imageUrl: string | null;
    type: 'artist' | 'album' | 'track';
    onPress: () => void;
    onLongPress?: () => void;
    containerStyle?: any;
}

// --- SHARED LAYOUT ---
const TopMatchCardLayout = ({ title, subtitle, imageUrl, type, onPress, onLongPress, containerStyle }: LayoutProps) => {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    return (
        <TouchableOpacity 
            style={[styles.container, containerStyle]} 
            activeOpacity={0.8} 
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={300}
        >
            {/* Fondo con la imagen usando BlurredBackground */}
            <BlurredBackground 
                imageUrl={imageUrl} 
                blurIntensity={60} 
                gradientColors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
            />

            <View style={styles.content}>
                <View style={styles.mainInfo}>
                    {/* Miniatura cuadrada o redonda según el tipo */}
                    {imageUrl ? (
                        <Image 
                            source={{ uri: imageUrl }} 
                            style={[
                                styles.thumbnail, 
                                type === 'artist' ? { borderRadius: 40 } : { borderRadius: 8 }
                            ]} 
                        />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholder]}>
                            <Ionicons name="musical-notes" size={24} color={colors.textSecondary} />
                        </View>
                    )}

                    <View style={styles.textContainer}>
                        <Text style={styles.title} numberOfLines={2}>{title}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// --- SPECIALIZED COMPONENTS ---

const TopMatchArtistCard = withObservables(['artist'], ({ artist }: { artist: Artist }) => ({
    artist: artist.observe(),
}))(({ artist, onPress }: { artist: Artist; onPress: () => void }) => {
    const openMenu = useArtistMenuStore(state => state.openMenu);
    return (
        <TopMatchCardLayout
            title={artist.name}
            subtitle="Artista"
            imageUrl={artist.imageUrl}
            type="artist"
            onPress={onPress}
            onLongPress={() => {
                Keyboard.dismiss();
                openMenu(artist);
            }}
        />
    );
});

const TopMatchAlbumCard = withObservables(['album'], ({ album }: { album: Album }) => ({
    album: album.observe(),
    artist: album.artist.observe(),
}))(({ album, artist, onPress }: { album: Album; artist: Artist; onPress: () => void }) => {
    const openMenu = useAlbumMenuStore(state => state.openMenu);
    return (
        <TopMatchCardLayout
            title={album.title}
            subtitle={`Álbum • ${artist?.name || 'Desconocido'}`}
            imageUrl={album.coverUrl}
            type="album"
            onPress={onPress}
            onLongPress={() => {
                Keyboard.dismiss();
                openMenu(album);
            }}
        />
    );
});

const TopMatchTrackCard = withObservables(['track'], ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe(),
    collaborators: track.queryCollaborators.observe() as any,
}))(({ track, album, collaborators, onPress }: { track: Track; album: Album; collaborators: Artist[]; onPress: () => void }) => {
    const artistNames = collaborators.length > 0 
        ? collaborators.map(a => a.name).join(', ') 
        : 'Desconocido';
    
    const openMenu = useTrackMenuStore(state => state.openMenu);
    
    const { colors } = useAppTheme();
    const swipeLeftAction = useSettingsStore((state) => state.swipeLeftAction);
    const swipeRightAction = useSettingsStore((state) => state.swipeRightAction);

    const translateX = useSharedValue(0);
    const hasTriggeredHaptic = useSharedValue(false);
    const SWIPE_LIMIT = 80;
    const SWIPE_THRESHOLD = 55;

    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleSwipeAction = React.useCallback(async (action: SwipeAction) => {
        const showToast = useToastStore.getState().showToast;
        if (action === 'add_next') {
            usePlayerStore.getState().addToQueueNext(track);
            showToast(i18n.t('toasts.playing_next'), 'return-down-forward');
        } else if (action === 'add_last') {
            usePlayerStore.getState().addToQueueEnd(track);
            showToast(i18n.t('toasts.added_to_queue'), 'list');
        } else if (action === 'add_to_playlist') {
            usePlaylistSelectorStore.getState().openSelector(track);
        } else if (action === 'toggle_favorite') {
            const wasFavorite = track.isFavorite;
            await track.toggleLike();
            if (!wasFavorite) {
                showToast(i18n.t('toasts.added_to_favourites'), 'heart');
            } else {
                showToast(i18n.t('actions.success'), 'heart-dislike');
            }
        }
    }, [track]);

    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onUpdate((event) => {
            const canSwipeRight = swipeRightAction !== 'none';
            const canSwipeLeft = swipeLeftAction !== 'none';

            let newTranslateX = event.translationX;
            if (!canSwipeRight && newTranslateX > 0) newTranslateX = 0;
            if (!canSwipeLeft && newTranslateX < 0) newTranslateX = 0;

            translateX.value = clamp(newTranslateX, -SWIPE_LIMIT, SWIPE_LIMIT);

            if (Math.abs(translateX.value) > SWIPE_THRESHOLD && !hasTriggeredHaptic.value) {
                hasTriggeredHaptic.value = true;
                runOnJS(triggerHaptic)();
            } else if (Math.abs(translateX.value) <= SWIPE_THRESHOLD) {
                hasTriggeredHaptic.value = false;
            }
        })
        .onEnd(() => {
            if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
                const action = translateX.value > 0 ? swipeRightAction : swipeLeftAction;
                runOnJS(handleSwipeAction)(action);
            }
            translateX.value = withSpring(0, {
                stiffness: 400,
                damping: 30,
                mass: 1,
            });
            hasTriggeredHaptic.value = false;
        });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        };
    });

    const leftIconStyle = useAnimatedStyle(() => {
        return {
            opacity: translateX.value > 0 ? 1 : 0,
            transform: [{ scale: translateX.value > SWIPE_THRESHOLD ? 1.2 : 1 }],
        };
    });

    const rightIconStyle = useAnimatedStyle(() => {
        return {
            opacity: translateX.value < 0 ? 1 : 0,
            transform: [{ scale: translateX.value < -SWIPE_THRESHOLD ? 1.2 : 1 }],
        };
    });

    const getActionIcon = (action: SwipeAction): any => {
        switch (action) {
            case 'add_next': return 'return-down-forward';
            case 'add_last': return 'list';
            case 'add_to_playlist': return 'add-circle-outline';
            case 'toggle_favorite': return 'heart';
            default: return 'close';
        }
    };

    return (
        <View style={{ 
            height: 140, 
            marginHorizontal: 20, 
            marginBottom: 20, 
            borderRadius: 16, 
            overflow: 'hidden', 
            borderWidth: 1, 
            borderColor: colors.overlayAlpha10 
        }}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }]}>
                {swipeRightAction !== 'none' ? (
                    <Animated.View style={leftIconStyle}>
                        <Ionicons name={getActionIcon(swipeRightAction)} size={24} color="#FFFFFF" />
                    </Animated.View>
                ) : <View />}
                {swipeLeftAction !== 'none' ? (
                    <Animated.View style={rightIconStyle}>
                        <Ionicons name={getActionIcon(swipeLeftAction)} size={24} color="#FFFFFF" />
                    </Animated.View>
                ) : <View />}
            </View>

            <GestureDetector gesture={panGesture}>
                <Animated.View style={[animatedStyle, StyleSheet.absoluteFillObject]}>
                    <TopMatchCardLayout
                        title={track.title}
                        subtitle={`Canción • ${artistNames}`}
                        imageUrl={album?.coverUrl || null}
                        type="track"
                        onPress={onPress}
                        onLongPress={() => {
                            Keyboard.dismiss();
                            openMenu(track);
                        }}
                        containerStyle={{ marginHorizontal: 0, marginBottom: 0, borderWidth: 0, borderRadius: 0, height: '100%' }}
                    />
                </Animated.View>
            </GestureDetector>
        </View>
    );
});

// --- MAIN ENTRY POINT ---
export default function TopMatchCard({ match, onPress }: TopMatchCardProps) {
    if (!match) return null;

    switch (match.type) {
        case 'artist':
            return <TopMatchArtistCard artist={match.item as Artist} onPress={onPress} />;
        case 'album':
            return <TopMatchAlbumCard album={match.item as Album} onPress={onPress} />;
        case 'track':
            return <TopMatchTrackCard track={match.item as Track} onPress={onPress} />;
        default:
            return null;
    }
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        height: 140,
        marginHorizontal: 20,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: colors.overlayAlpha10,
    },
    content: {
        flex: 1,
        padding: 16,
        justifyContent: 'center',
    },
    mainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    thumbnail: {
        width: 64,
        height: layout.MINI_PLAYER_HEIGHT,
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontFamily: fonts.regular,
        fontWeight: '800',
        marginBottom: 4,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
});
