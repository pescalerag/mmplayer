import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';

interface PlayerDiscArtworkProps {
    playerCoverStyle: 'cd' | 'vinyl';
    album: { cdArtUrl: string | null } | null;
    artworkSize: number;
    spinStyle: any;
    coverColor: string | null;
    holeSize?: number;
}

export const PlayerDiscArtwork = React.memo(({ playerCoverStyle, album, artworkSize, spinStyle, coverColor, holeSize = 35 }: Readonly<PlayerDiscArtworkProps>) => {
    if (playerCoverStyle === 'cd') {
        if (album?.cdArtUrl) {
            return (
                <View style={{ width: artworkSize, height: artworkSize, alignSelf: 'center', position: 'relative' }}>
                    <MaskedView
                        style={StyleSheet.absoluteFillObject}
                        maskElement={
                            <View style={{
                                width: artworkSize,
                                height: artworkSize,
                                borderRadius: artworkSize / 2,
                                borderWidth: (artworkSize - holeSize) / 2,
                                borderColor: 'black',
                                backgroundColor: 'transparent',
                            }} />
                        }
                    >
                        <Animated.View style={[{ width: '100%', height: '100%' }, spinStyle]}>
                            <Image
                                source={{ uri: album.cdArtUrl }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                            />
                        </Animated.View>
                    </MaskedView>
                    <Animated.View style={[StyleSheet.absoluteFillObject, spinStyle]}>
                        <Image
                            source={require('../../assets/cd-custom.svg')}
                            style={{ position: 'absolute', width: '100%', height: '100%' }}
                            contentFit="contain"
                        />
                    </Animated.View>
                </View>
            );
        }
        return (
            <View style={{ width: artworkSize, height: artworkSize, alignSelf: 'center', position: 'relative' }}>
                <Animated.View style={[{ width: '100%', height: '100%' }, spinStyle]}>
                    <Image
                        source={require('../../assets/cd-base.webp')}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="contain"
                    />
                </Animated.View>
            </View>
        );
    }

    return (
        <View style={{ width: artworkSize, height: artworkSize, alignSelf: 'center', position: 'relative' }}>
            <Animated.View style={[{ width: '100%', height: '100%' }, spinStyle]}>
                <Image
                    source={require('../../assets/vinyl.svg')}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                />
                {coverColor && (
                    <View
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            borderRadius: artworkSize / 2,
                            backgroundColor: coverColor,
                            opacity: 0.25,
                        }}
                        pointerEvents="none"
                    />
                )}
            </Animated.View>
        </View>
    );
});
PlayerDiscArtwork.displayName = 'PlayerDiscArtwork';
