import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';

interface Props {
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
    iconType?: 'circle' | 'normal';
}

export default function PlayPauseButton({ size = 32, color = '#FFFFFF', style, iconType = 'normal' }: Props) {
    const isPlaying = usePlayerStore(state => state.isPlaying);

    const togglePlayback = async () => {
        try {
            if (isPlaying) await TrackPlayer.pause();
            else await TrackPlayer.play();
        } catch (e) {
            console.error('Error toggling playback:', e);
        }
    };

    const iconName = isPlaying
        ? (iconType === 'circle' ? 'pause-circle' : 'pause')
        : (iconType === 'circle' ? 'play-circle' : 'play');

    return (
        <TouchableOpacity onPress={togglePlayback} style={style}>
            <Ionicons name={iconName as any} size={size} color={color} />
        </TouchableOpacity>
    );
}
