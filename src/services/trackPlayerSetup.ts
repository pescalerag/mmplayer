import { Platform } from 'react-native';
import { initializeReplayGain } from './ReplayGainService';
import TrackPlayer, {
    AppKilledPlaybackBehavior,
    Capability,
    RepeatMode
} from 'react-native-track-player';

export async function setupPlayer() {
    await initializeReplayGain();
    let isSetup = false;
    try {
        await TrackPlayer.getActiveTrack();
        isSetup = true;
    } catch {
        await TrackPlayer.setupPlayer({
            autoHandleInterruptions: true,
        });
    }

    await TrackPlayer.updateOptions({
        android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
            alwaysPauseOnInterruption: true,
        },
        progressUpdateEventInterval: 1,
        capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
            Capability.PlayFromSearch,
            ...(Platform.OS === 'android' ? [Capability.Like] : []),
        ],
        notificationCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
            ...(Platform.OS === 'android' ? [Capability.Like] : []),
        ],
    });

    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    isSetup = true;
    return isSetup;
}
