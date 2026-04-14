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

export default function PlayPauseButton({ size = 32, color = '#FFFFFF', style, iconType = 'normal' }: Readonly<Props>) {
    const isPlaying = usePlayerStore(state => state.isPlaying);

    const togglePlayback = async () => {
        try {
            if (isPlaying) {
                console.log("⏸️ [PlayPauseButton] Presionado: Pausa");
                await TrackPlayer.pause();
            } else {
                console.log("▶️ [PlayPauseButton] Presionado: Play");
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
