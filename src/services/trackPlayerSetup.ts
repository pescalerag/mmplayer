import TrackPlayer, { 
    Capability, 
    AppKilledPlaybackBehavior, 
    RatingType,
    RepeatMode
} from 'react-native-track-player';

export async function setupPlayer() {
    let isSetup = false;
    try {
        await TrackPlayer.getActiveTrack();
        isSetup = true;
    } catch {
        await TrackPlayer.setupPlayer({
            waitForBuffer: true,
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
                Capability.Stop,
            ],
            compactCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
            ],
            notificationCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.SeekTo,
                Capability.Stop,
            ],
    });
    
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    isSetup = true;
    return isSetup;
}
