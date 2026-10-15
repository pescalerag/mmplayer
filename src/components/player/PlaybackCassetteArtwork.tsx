import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { State, usePlaybackState, useProgress } from 'react-native-track-player';
import { CassetteArtwork } from './CassetteArtwork';
import { cassetteProgress } from '../../utils/cassetteTape';
import { useSettingsStore } from '../../store/useSettingsStore';

export function PlaybackCassetteArtwork({ size, coverUrl, coverColor, albumTitle, onReady }: Readonly<{ onReady?: () => void; size: number; coverUrl: string | null; coverColor?: string | null; albumTitle?: string | null }>) {
    const showAlbumName = useSettingsStore(state => state.showCassetteAlbumName);
    const { position, duration } = useProgress(250);
    const playback = usePlaybackState();
    const isFocused = useIsFocused();
    const [isActive, setIsActive] = useState(AppState.currentState === 'active');
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setIsActive(state === 'active'));
        return () => subscription.remove();
    }, []);
    return <CassetteArtwork onReady={onReady} size={size} coverUrl={coverUrl} coverColor={coverColor} albumTitle={showAlbumName ? albumTitle : null} progress={cassetteProgress(position, duration)}
        isPlaying={playback.state === State.Playing && isFocused && isActive} />;
}
