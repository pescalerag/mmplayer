import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

const grooveRadii = Array.from({ length: 32 }, (_, index) => 184 - index * 3.4);

export function VinylArtwork({ size, coverUrl, coverColor, spinStyle, onReady }: Readonly<{
    size: number;
    onReady?: () => void;
    coverUrl?: string | null;
    coverColor: string | null;
    spinStyle: any;
}>) {
    const labelSize = size * 0.32;
    const holeSize = size * 0.025;
    return <View style={{ width: size, height: size, alignSelf: 'center' }}>
        <MaskedView style={StyleSheet.absoluteFillObject} maskElement={
            <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: (size - holeSize) / 2, borderColor: '#000', backgroundColor: 'transparent' }} />
        }>
            <Animated.View style={[StyleSheet.absoluteFillObject, spinStyle]}>
                <Svg width="100%" height="100%" viewBox="0 0 400 400">
                    <Defs>
                        <RadialGradient id="vinyl-shading" cx="50%" cy="50%" r="50%">
                            <Stop offset="0" stopColor="#000" stopOpacity="0.12" />
                            <Stop offset="0.55" stopColor="#000" stopOpacity="0.25" />
                            <Stop offset="0.94" stopColor="#000" stopOpacity="0.4" />
                            <Stop offset="1" stopColor="#000" stopOpacity="0.7" />
                        </RadialGradient>
                    </Defs>
                    <Circle cx="200" cy="200" r="198" fill={coverColor || '#363b40'} />
                    <Circle cx="200" cy="200" r="197" fill="url(#vinyl-shading)" />
                    <Circle cx="200" cy="200" r="193" fill="none" stroke="#ffffff35" strokeWidth="1.2" />
                    {grooveRadii.map((radius, index) => <Circle key={radius} cx="200" cy="200" r={radius} fill="none"
                        stroke={index % 2 === 0 ? '#00000055' : '#ffffff28'} strokeWidth="0.8" />)}
                    <Path d="M64 66 A191 191 0 0 1 127 23 L172 129 A77 77 0 0 0 145 146 Z" fill="#fff" opacity="0.08" />
                    <Path d="M336 334 A191 191 0 0 1 273 377 L228 271 A77 77 0 0 0 255 254 Z" fill="#fff" opacity="0.06" />
                    <Circle cx="200" cy="200" r="72" fill="#171916" stroke="#ffffff30" strokeWidth="1.5" />
                    <Circle cx="200" cy="200" r="68" fill="#eee4cf" />
                </Svg>
                {coverUrl && <Image source={{ uri: coverUrl }} recyclingKey={coverUrl} contentFit="cover" transition={0} onLoad={onReady} onError={onReady}
                    style={{ position: 'absolute', left: (size - labelSize) / 2, top: (size - labelSize) / 2, width: labelSize, height: labelSize, borderRadius: labelSize / 2 }} />}
                <Svg width="100%" height="100%" viewBox="0 0 400 400" style={StyleSheet.absoluteFillObject}>
                    <Circle cx="200" cy="200" r="64" fill="none" stroke="#00000035" strokeWidth="1" />
                    <Circle cx="200" cy="200" r="10" fill="#232522" stroke="#e6e1d3" strokeWidth="1" />
                </Svg>
            </Animated.View>
        </MaskedView>
    </View>;
}
