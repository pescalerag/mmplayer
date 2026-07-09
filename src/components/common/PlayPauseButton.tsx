import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import TrackPlayer, { State } from 'react-native-track-player';
import { usePlaybackState } from '../../hooks/usePlaybackState';

interface Props {
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
    iconType?: 'circle' | 'normal';
}

export default function PlayPauseButton({ size = 32, color = '#FFFFFF', style, iconType = 'normal' }: Readonly<Props>) {
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;

    const togglePlayback = async () => {
        try {
            if (isPlaying) {
                await TrackPlayer.pause();
            } else {
                await TrackPlayer.play();
            }
        } catch (e) {
            console.error('❌ [PlayPauseButton] Error alternando estado:', e);
        }
    };

    let iconName: string;
    if (iconType === 'circle') {
        iconName = isPlaying ? 'pause-circle' : 'play-circle';
    } else {
        iconName = isPlaying ? 'pause' : 'play';
    }

    return (
        <TouchableOpacity onPress={togglePlayback} style={style}>
            <Ionicons name={iconName as any} size={size} color={color} />
        </TouchableOpacity>
    );
}
