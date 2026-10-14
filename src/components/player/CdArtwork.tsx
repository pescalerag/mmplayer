import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

export function CdArtwork({ size, customImageUrl, coverUrl, spinStyle, holeSize }: Readonly<{
    size: number;
    customImageUrl?: string | null;
    coverUrl?: string | null;
    spinStyle: any;
    holeSize: number;
}>) {
    // Existing custom CD images remain authoritative; no stored asset or album is changed.
    const imageUrl = customImageUrl || coverUrl;
    const imageSize = size * 0.98;
    const holeRadius = holeSize / size * 200;
    return <View style={{ width: size, height: size, alignSelf: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, spinStyle]}
            renderToHardwareTextureAndroid={Boolean(spinStyle)} shouldRasterizeIOS={Boolean(spinStyle)}>
        <MaskedView style={StyleSheet.absoluteFillObject} androidRenderingMode="hardware" maskElement={
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: (size - holeSize) / 2, borderColor: '#000', backgroundColor: 'transparent' }} />
        }>
            <View style={StyleSheet.absoluteFillObject}>
                <Svg width="100%" height="100%" viewBox="0 0 400 400">
                    <Defs>
                        <LinearGradient id="cd-metal" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor="#f3f3e9" /><Stop offset="0.28" stopColor="#b4bdbd" />
                            <Stop offset="0.5" stopColor="#eeeeea" /><Stop offset="0.76" stopColor="#949e9f" />
                            <Stop offset="1" stopColor="#d8dcda" />
                        </LinearGradient>
                    </Defs>
                    <Circle cx="200" cy="200" r="198" fill="url(#cd-metal)" stroke="#727a79" strokeWidth="2" />
                </Svg>
                {imageUrl && <Image source={{ uri: imageUrl }} recyclingKey={imageUrl} contentFit="cover" transition={0}
                    style={{ position: 'absolute', left: (size - imageSize) / 2, top: (size - imageSize) / 2, width: imageSize, height: imageSize, borderRadius: imageSize / 2 }} />}
                <Svg width="100%" height="100%" viewBox="0 0 400 400" style={StyleSheet.absoluteFillObject}>
                    <Defs>
                        <LinearGradient id="cd-iridescence" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor="#8bdcd6" /><Stop offset="0.3" stopColor="#c9b5ea" />
                            <Stop offset="0.6" stopColor="#edc5ab" /><Stop offset="1" stopColor="#b1d2eb" />
                        </LinearGradient>
                        <RadialGradient id="cd-hub" cx="50%" cy="50%" r="50%">
                            <Stop offset="0" stopColor="#dde2df" stopOpacity="0.9" />
                            <Stop offset="0.7" stopColor="#c7cfcb" stopOpacity="0.75" />
                            <Stop offset="1" stopColor="#f0f0e6" stopOpacity="0.85" />
                        </RadialGradient>
                    </Defs>
                    <Circle cx="200" cy="200" r="193" fill="none" stroke="#f3f3ed" strokeWidth="1.5" opacity="0.65" />
                    <Circle cx="200" cy="200" r="187" fill="none" stroke="#181d1b" strokeWidth="1" opacity="0.25" />
                    <Path d="M44 84 A194 194 0 0 1 122 23 L181 153 A50 50 0 0 0 160 169 Z" fill="url(#cd-iridescence)" opacity="0.28" />
                    <Path d="M356 316 A194 194 0 0 1 278 377 L219 247 A50 50 0 0 0 240 231 Z" fill="url(#cd-iridescence)" opacity="0.22" />
                    <Circle cx="200" cy="200" r="51" fill="none" stroke="#161c19" strokeWidth="2" opacity="0.3" />
                    <Circle cx="200" cy="200" r="48" fill="url(#cd-hub)" stroke="#f3f4ec" strokeWidth="1" />
                    <Circle cx="200" cy="200" r="39" fill="none" stroke="#65736c" strokeWidth="1" opacity="0.5" />
                    <Circle cx="200" cy="200" r={holeRadius + 1} fill="none" stroke="#555f59" strokeWidth="2" />
                </Svg>
            </View>
        </MaskedView>
        </Animated.View>
    </View>;
}
