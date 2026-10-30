import React, { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, withTiming } from 'react-native-reanimated';
import { cassetteTapeRadius } from '../../utils/cassetteTape';

interface CassetteArtworkProps {
    size: number;
    onReady?: () => void;
    coverUrl?: string | null;
    progress?: number;
    isPlaying?: boolean;
    coverColor?: string | null;
    albumTitle?: string | null;
}

const screwPositions = [[13, 13], [387, 13], [13, 247], [387, 247], [200, 211]];

// Physical cassette proportions use a 400 × 260 frame inside the unchanged square player slot.
function CassetteShell() {
    return <Svg width="100%" height="100%" viewBox="0 0 400 260">
        <Defs>
            <LinearGradient id="plastic" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#343534" /><Stop offset="1" stopColor="#202120" />
            </LinearGradient>
        </Defs>
        <Rect x="2" y="2" width="396" height="256" rx="12" fill="url(#plastic)" stroke="#111211" strokeWidth="3" />
        <Rect x="7" y="7" width="386" height="246" rx="8" fill="none" stroke="#4b4c49" strokeWidth="0.8" />
        <Rect x="24" y="24" width="352" height="166" rx="8" fill="#efe4cc" stroke="#111211" strokeWidth="3" />
        <Path d="M61 258 L75 207 Q77 201 84 201 H316 Q323 201 325 207 L339 258" fill="#242523" stroke="#72716a" strokeWidth="2" />
        <Path d="M64 258 L78 211 M336 258 L322 211" stroke="#0c0d0c" strokeWidth="3" />
        <Circle cx="99" cy="239" r="9" fill="#090a09" stroke="#777770" />
        <Circle cx="301" cy="239" r="9" fill="#090a09" stroke="#777770" />
        <Circle cx="97" cy="237" r="6" fill="#e1dfd5" />
        <Circle cx="299" cy="237" r="6" fill="#e1dfd5" />
        <Rect x="127" y="224" width="13" height="12" rx="3" fill="#080908" stroke="#74746e" />
        <Rect x="260" y="224" width="13" height="12" rx="3" fill="#080908" stroke="#74746e" />
        <Path d="M26 197 H65 M335 197 H374" stroke="#111211" strokeWidth="2" />
    </Svg>;
}

function CassetteDetails() {
    return <Svg width="100%" height="100%" viewBox="0 0 400 260">
        <Rect x="25" y="25" width="350" height="45" rx="7" fill="#f8edd4" opacity="0.94" />
        <Rect x="25" y="61" width="350" height="9" fill="#f8edd4" opacity="0.94" />
        <SvgText x="37" y="60" fontSize="30" fontFamily="sans-serif" fontWeight="bold" fill="#272825">A</SvgText>
        <Path d="M88 44 H360 M88 62 H360" stroke="#8f8a78" strokeWidth="0.8" />
        <Rect x="82" y="98" width="236" height="76" rx="10" fill="#242522" stroke="#10110f" strokeWidth="2" />
        <Path d="M94 102 H306" stroke="#6f7068" opacity="0.55" />
        {screwPositions.map(([x, y]) => <G key={`${x}-${y}`}>
            <Circle cx={x} cy={y} r="5" fill="#10110f" stroke="#666760" strokeWidth="0.7" />
            <Circle cx={x} cy={y} r="3.5" fill="#aaa99f" />
            <Path d={`M${x - 2} ${y} h4 M${x} ${y - 2} v4`} stroke="#30312e" strokeWidth="1" />
        </G>)}
        <Path d="M28 8 H372" stroke="#deddd3" opacity="0.13" />
    </Svg>;
}

function ReelHub() {
    return <Svg width="100%" height="100%" viewBox="0 0 44 44">
        <Circle cx="22" cy="22" r="21" fill="#797b73" stroke="#10110e" strokeWidth="1" />
        <Circle cx="22" cy="22" r="17" fill="#f6f4eb" />
        {[0, 60, 120, 180, 240, 300].map(angle => <Rect key={angle} x="18" y="4" width="8" height="7" rx="1" fill="#797b73" transform={`rotate(${angle} 22 22)`} />)}
    </Svg>;
}

export const CassetteArtwork = React.memo(({ size, coverUrl, progress = 0, isPlaying = false, coverColor, albumTitle, onReady }: Readonly<CassetteArtworkProps>) => {
    const scale = size / 400;
    const tapeColor = coverColor || '#777b82';
    const tapeProgress = useSharedValue(progress);
    const leftRotation = useSharedValue(0);
    const rightRotation = useSharedValue(0);
    useEffect(() => {
        tapeProgress.value = withTiming(progress, { duration: 250 });
    }, [progress, tapeProgress]);

    const onFrame = useCallback(({ timeSincePreviousFrame }: { timeSincePreviousFrame: number | null }) => {
        'worklet';
        if (!timeSincePreviousFrame) return;
        const elapsed = Math.min(timeSincePreviousFrame, 64);
        // Constant tape speed: smaller rolls turn faster. No React updates per frame.
        leftRotation.value = (leftRotation.value + elapsed * 3 / cassetteTapeRadius(1 - tapeProgress.value)) % 360;
        rightRotation.value = (rightRotation.value + elapsed * 3 / cassetteTapeRadius(tapeProgress.value)) % 360;
    }, [leftRotation, rightRotation, tapeProgress]);
    const frame = useFrameCallback(onFrame, false);
    useEffect(() => {
        frame.setActive(isPlaying);
        return () => frame.setActive(false);
    }, [isPlaying, frame]);

    const leftTapeStyle = useAnimatedStyle(() => {
        const radius = cassetteTapeRadius(1 - tapeProgress.value) * scale;
        return { width: radius * 2, height: radius * 2, borderRadius: radius, transform: [{ translateX: -radius }, { translateY: -radius }] };
    }, [tapeProgress, scale]);
    const rightTapeStyle = useAnimatedStyle(() => {
        const radius = cassetteTapeRadius(tapeProgress.value) * scale;
        return { width: radius * 2, height: radius * 2, borderRadius: radius, transform: [{ translateX: -radius }, { translateY: -radius }] };
    }, [tapeProgress, scale]);
    const leftHubStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${leftRotation.value}deg` }] }), [leftRotation]);
    const rightHubStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rightRotation.value}deg` }] }), [rightRotation]);
    const hubSize = 44 * scale;

    return <View testID="player-cassette-artwork" style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: size, height: size * 0.65 }}>
            <CassetteShell />
            {coverUrl && <Image source={{ uri: coverUrl }} recyclingKey={coverUrl} contentFit="cover" blurRadius={20 * scale} transition={0} onLoad={onReady} onError={onReady}
                style={{ position: 'absolute', left: 24 * scale, top: 24 * scale, width: 352 * scale, height: 166 * scale, borderRadius: 8 * scale }} />}
            <View pointerEvents="none" style={StyleSheet.absoluteFillObject}><CassetteDetails /></View>
            {!!albumTitle?.trim() && <Text numberOfLines={2} ellipsizeMode="tail" pointerEvents="none"
                style={{ position: 'absolute', left: 88 * scale, top: 26 * scale, width: 272 * scale, height: 36 * scale,
                    fontSize: 17 * scale, lineHeight: 18 * scale, color: '#252a36', includeFontPadding: false,
                    fontFamily: Platform.OS === 'android' ? 'cursive' : 'Noteworthy' }}>{albumTitle.trim()}</Text>}
            {/* The rolls sit behind the label; only their inner edges show through the central window. */}
            <View style={{ position: 'absolute', left: 158 * scale, top: 108 * scale, width: 84 * scale, height: 56 * scale, borderRadius: 3 * scale, backgroundColor: '#d6d5ca', overflow: 'hidden', borderWidth: scale, borderColor: '#0c0d0b' }}>
                <Animated.View testID="player-cassette-left-tape" style={[styles.tape, { left: -40 * scale, top: 28 * scale, backgroundColor: tapeColor, borderWidth: 2 * scale }, leftTapeStyle]} />
                <Animated.View testID="player-cassette-right-tape" style={[styles.tape, { left: 124 * scale, top: 28 * scale, backgroundColor: tapeColor, borderWidth: 2 * scale }, rightTapeStyle]} />
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8 * scale, backgroundColor: '#00000030' }} />
                <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 7 * scale, backgroundColor: '#ffffff25' }} />
            </View>
            <Animated.View testID="player-cassette-left-reel" style={[{ position: 'absolute', width: hubSize, height: hubSize, left: 96 * scale, top: 114 * scale }, leftHubStyle]}><ReelHub /></Animated.View>
            <Animated.View testID="player-cassette-right-reel" style={[{ position: 'absolute', width: hubSize, height: hubSize, left: 260 * scale, top: 114 * scale }, rightHubStyle]}><ReelHub /></Animated.View>
        </View>
    </View>;
});
CassetteArtwork.displayName = 'CassetteArtwork';

const styles = StyleSheet.create({ tape: { position: 'absolute', borderColor: '#00000040' } });
