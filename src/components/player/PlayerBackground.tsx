import React, { useEffect, useMemo, useRef } from 'react';
import { AppState, AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import type Track from '../../database/models/Track';
import BlurredBackground from '../layouts/BlurredBackground';

const CanvasVideo = React.memo(({
    sourceUri,
    isImmersive,
    gradientColors
}: {
    sourceUri: string;
    isImmersive: boolean;
    gradientColors: string[];
}) => {
    // El vídeo Canvas se reproduce en bucle y mudo de forma inmediata
    const player = useVideoPlayer(sourceUri, (playerInstance) => {
        playerInstance.loop = true;
        playerInstance.muted = true;
        playerInstance.play();
    });

    useEffect(() => {
        if (player) {
            player.play();
        }
    }, [player, sourceUri]);

    useEffect(() => {
        if (Platform.OS === 'web') return;
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && player) {
                player.play();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [player]);

    const blurOpacity = useSharedValue(isImmersive ? 0 : 1);
    const immersiveGradientOpacity = useSharedValue(isImmersive ? 1 : 0);

    useEffect(() => {
        blurOpacity.value = withTiming(isImmersive ? 0 : 1, { duration: 350, easing: Easing.bezier(0.25, 0.1, 0.25, 1.0) });
        immersiveGradientOpacity.value = withTiming(isImmersive ? 1 : 0, { duration: 350, easing: Easing.bezier(0.25, 0.1, 0.25, 1.0) });
    }, [isImmersive, blurOpacity, immersiveGradientOpacity]);

    const blurAnimatedStyle = useAnimatedStyle(() => ({
        opacity: blurOpacity.value,
    }));

    const normalGradientAnimatedStyle = useAnimatedStyle(() => ({
        opacity: 1 - immersiveGradientOpacity.value,
    }));

    const immersiveGradientAnimatedStyle = useAnimatedStyle(() => ({
        opacity: immersiveGradientOpacity.value,
    }));

    // HTML video is a replaced element: absolute insets alone leave its
    // intrinsic dimensions in place. Size it to fill the desktop panel.
    // Keep native's immersive background treatment separate from PC Canvas.
    if (Platform.OS === 'web') {
        return (
            <View testID="player-canvas" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} pointerEvents="none">
                <VideoView
                    key={sourceUri}
                    player={player}
                    style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
                    contentFit="cover"
                    nativeControls={false}
                    allowsFullscreen={false}
                />
                <LinearGradient
                    testID="player-canvas-controls-gradient"
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.95)']}
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' }}
                />
            </View>
        );
    }

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <VideoView
                key={sourceUri}
                player={player}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                nativeControls={false}
                allowsFullscreen={false}
                surfaceType="textureView"
            />
            <Animated.View style={[StyleSheet.absoluteFillObject, blurAnimatedStyle]}>
                <BlurView
                    intensity={20}
                    tint="dark"
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFillObject, normalGradientAnimatedStyle]}>
                <LinearGradient
                    colors={gradientColors as any}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFillObject, immersiveGradientAnimatedStyle]}>
                <LinearGradient
                    colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)'] as any}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>
        </View>
    );
});
CanvasVideo.displayName = 'CanvasVideo';

interface PlayerBackgroundSlotProps {
    style?: any;
    trackModel?: Track | null;
    coverUrl: string | null;
    bgVideo?: string | null;
    gradientColors: string[];
    showCanvas: boolean;
    isImmersive?: boolean;
    slotKey: string;
    showImage?: boolean;
}

const PlayerBackgroundSlot = React.memo(({
    style,
    trackModel,
    coverUrl,
    bgVideo,
    gradientColors,
    showCanvas,
    isImmersive = false,
    slotKey,
    showImage = true,
}: PlayerBackgroundSlotProps) => {
    const hasVideo = showCanvas && !!bgVideo;

    return (
        <View style={style}>
            {hasVideo ? (
                <CanvasVideo
                    key={`bg-canvas-${slotKey}-${trackModel?.id || 'curr'}-${bgVideo}`}
                    sourceUri={bgVideo!}
                    isImmersive={isImmersive}
                    gradientColors={gradientColors}
                />
            ) : (
                <BlurredBackground
                    key={`blur-${slotKey}`}
                    imageUrl={showImage ? coverUrl : null}
                    blurIntensity={10}
                    gradientColors={gradientColors}
                    showImage={showImage}
                />
            )}
        </View>
    );
});
PlayerBackgroundSlot.displayName = 'PlayerBackgroundSlot';

interface PlayerBackgroundProps {
    width: number;
    bgSwipeAnimatedStyle: any;
    prevTrackModel: Track | null;
    prevCoverUrl: string | null;
    track: Track;
    // WatermelonDB mutates model instances in place. Keep URI snapshots in
    // props so React.memo notices canvas edits without a focus/layout change.
    currentBgVideo: string | null;
    prevBgVideo: string | null;
    nextBgVideo: string | null;
    currentCoverUrl: string | null;
    nextTrackModel: Track | null;
    nextCoverUrl: string | null;
    showCanvas: boolean;
    isImmersive: boolean;
    isFocused: boolean;
    isTransitioning: boolean;
    playerBackgroundStyle: string;
    coverColor: string | null;
    topGradientColor: string;
    bottomGradientColor: string;
    prevCoverColor?: string | null;
    prevTopGradientColor?: string;
    prevBottomGradientColor?: string;
    nextCoverColor?: string | null;
    nextTopGradientColor?: string;
    nextBottomGradientColor?: string;
    backgroundColor: string;
}

export const PlayerBackground = React.memo(({
    width: bgWidth,
    bgSwipeAnimatedStyle,
    prevTrackModel,
    prevCoverUrl,
    track,
    currentBgVideo,
    prevBgVideo,
    nextBgVideo,
    currentCoverUrl,
    nextTrackModel,
    nextCoverUrl,
    showCanvas,
    isImmersive,
    isFocused,
    isTransitioning,
    playerBackgroundStyle,
    coverColor,
    topGradientColor,
    bottomGradientColor,
    prevCoverColor,
    prevTopGradientColor,
    prevBottomGradientColor,
    nextCoverColor,
    nextTopGradientColor,
    nextBottomGradientColor,
    backgroundColor,
}: PlayerBackgroundProps) => {
    const isGradientMode = playerBackgroundStyle === 'gradient';

    const defaultGrad = useMemo(
        () => ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', backgroundColor],
        [backgroundColor]
    );

    const lastValidCurrGradRef = useRef<string[] | null>(null);

    const currGrad = useMemo(() => {
        if (isGradientMode) {
            if (coverColor) {
                const grad = [topGradientColor, bottomGradientColor, bottomGradientColor];
                lastValidCurrGradRef.current = grad;
                return grad;
            }
            return lastValidCurrGradRef.current || ['#121212', backgroundColor, backgroundColor];
        }
        return defaultGrad;
    }, [isGradientMode, coverColor, topGradientColor, bottomGradientColor, defaultGrad, backgroundColor]);

    const prevGrad = useMemo(() => {
        if (isGradientMode) {
            if (prevCoverColor && prevTopGradientColor && prevBottomGradientColor) {
                return [prevTopGradientColor, prevBottomGradientColor, prevBottomGradientColor];
            }
            if (coverColor) {
                return [topGradientColor, bottomGradientColor, bottomGradientColor];
            }
            return lastValidCurrGradRef.current || ['#121212', backgroundColor, backgroundColor];
        }
        return defaultGrad;
    }, [isGradientMode, prevCoverColor, prevTopGradientColor, prevBottomGradientColor, coverColor, topGradientColor, bottomGradientColor, defaultGrad, backgroundColor]);

    const nextGrad = useMemo(() => {
        if (isGradientMode) {
            if (nextCoverColor && nextTopGradientColor && nextBottomGradientColor) {
                return [nextTopGradientColor, nextBottomGradientColor, nextBottomGradientColor];
            }
            if (coverColor) {
                return [topGradientColor, bottomGradientColor, bottomGradientColor];
            }
            return lastValidCurrGradRef.current || ['#121212', backgroundColor, backgroundColor];
        }
        return defaultGrad;
    }, [isGradientMode, nextCoverColor, nextTopGradientColor, nextBottomGradientColor, coverColor, topGradientColor, bottomGradientColor, defaultGrad, backgroundColor]);

    const canvasGrad = useMemo(
        () => ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.97)'],
        []
    );

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Animated.View style={[bgSwipeAnimatedStyle, { width: bgWidth, height: '100%' }]}>
                {/* Slot -1: Previous */}
                <PlayerBackgroundSlot
                    slotKey="prev"
                    style={{ position: 'absolute', left: -bgWidth, width: bgWidth, height: '100%', overflow: 'hidden' }}
                    trackModel={prevTrackModel}
                    coverUrl={prevCoverUrl}
                    bgVideo={prevBgVideo}
                    showCanvas={showCanvas}
                    isImmersive={false}
                    gradientColors={prevBgVideo && showCanvas ? canvasGrad : prevGrad}
                    showImage={!isGradientMode}
                />

                {/* Slot 0: Current */}
                <PlayerBackgroundSlot
                    slotKey="curr"
                    style={{ width: bgWidth, height: '100%', overflow: 'hidden' }}
                    trackModel={track}
                    coverUrl={currentCoverUrl}
                    bgVideo={currentBgVideo}
                    showCanvas={showCanvas}
                    isImmersive={isImmersive}
                    gradientColors={currentBgVideo && showCanvas ? canvasGrad : currGrad}
                    showImage={!isGradientMode}
                />

                {/* Slot +1: Next */}
                <PlayerBackgroundSlot
                    slotKey="next"
                    style={{ position: 'absolute', left: bgWidth, width: bgWidth, height: '100%', overflow: 'hidden' }}
                    trackModel={nextTrackModel}
                    coverUrl={nextCoverUrl}
                    bgVideo={nextBgVideo}
                    showCanvas={showCanvas}
                    isImmersive={false}
                    gradientColors={nextBgVideo && showCanvas ? canvasGrad : nextGrad}
                    showImage={!isGradientMode}
                />
            </Animated.View>
        </View>
    );
});
PlayerBackground.displayName = 'PlayerBackground';
