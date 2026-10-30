import { usePlaybackSnapshotStore } from '../../store/usePlaybackSnapshotStore';
import React, { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { State, usePlaybackState, useProgress } from 'react-native-track-player';
import { CassetteArtwork } from './CassetteArtwork';
import { cassetteProgress } from '../../utils/cassetteTape';
import { useSettingsStore } from '../../store/useSettingsStore';

export function PlaybackCassetteArtwork({ size, coverUrl, coverColor, albumTitle, onReady }: Readonly<{ onReady?: () => void; size: number; coverUrl: string | null; coverColor?: string | null; albumTitle?: string | null }>) {
    const showAlbumName = useSettingsStore(state => state.showCassetteAlbumName);
    const { position, duration, trackId } = useProgress(250);
    const activeTrackId = usePlaybackSnapshotStore(state => state.trackId);
    const isCurrentProgress = !trackId || trackId.split('-')[0] === activeTrackId;
    const playback = usePlaybackState();
    const isFocused = useIsFocused();
    const [isActive, setIsActive] = useState(Platform.OS === 'web' || AppState.currentState === 'active');
    useEffect(() => {
        if (Platform.OS === 'web') return;
        const subscription = AppState.addEventListener('change', state => setIsActive(state === 'active'));
        return () => subscription.remove();
    }, []);
    return <CassetteArtwork onReady={onReady} size={size} coverUrl={coverUrl} coverColor={coverColor} albumTitle={showAlbumName ? albumTitle : null} progress={isCurrentProgress ? cassetteProgress(position, duration) : 0}
        isPlaying={playback.state === State.Playing && isFocused && isActive} />;
}
