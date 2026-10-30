import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import TrackPlayer, { State } from 'react-native-track-player';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import { useTranslation } from 'react-i18next';

interface Props {
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
    iconType?: 'circle' | 'normal';
}

export default function PlayPauseButton({ size = 32, color = '#FFFFFF', style, iconType = 'normal' }: Readonly<Props>) {
    const { t } = useTranslation();
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;
    const requestedPlaying = useRef<boolean | null>(null);
    const requestVersion = useRef(0);

    const togglePlayback = async () => {
        const nextPlaying = !(requestedPlaying.current ?? isPlaying);
        requestedPlaying.current = nextPlaying;
        const version = ++requestVersion.current;
        try {
            if (nextPlaying) {
                await TrackPlayer.play();
            } else {
                await TrackPlayer.pause();
            }
        } catch (e) {
            console.error('❌ [PlayPauseButton] Error alternando estado:', e);
        } finally {
            if (version === requestVersion.current) requestedPlaying.current = null;
        }
    };

    let iconName: string;
    if (iconType === 'circle') {
        iconName = isPlaying ? 'pause-circle' : 'play-circle';
    } else {
        iconName = isPlaying ? 'pause' : 'play';
    }

    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(isPlaying ? 'actions.pause' : 'actions.play')} onPress={togglePlayback} style={style}>
            <Ionicons name={iconName as any} size={size} color={color} />
        </TouchableOpacity>
    );
}
