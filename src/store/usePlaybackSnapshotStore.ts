import TrackPlayer, { Event } from 'react-native-track-player';
import { create } from 'zustand';

// Metadata only. Transport state and progress use TrackPlayer's own hooks,
// as in v2.3.2, without a second interpretation of native playback state.
export const usePlaybackSnapshotStore = create(() => ({
    trackId: null as string | null,
    artwork: null as string | null,
}));

let refreshCurrentSubscription: (() => Promise<void>) | undefined;

export async function refreshPlaybackSnapshot() {
    await refreshCurrentSubscription?.();
}

export function subscribeToPlaybackSnapshot() {
    let disposed = false;
    let revision = 0;
    const publish = (track: Awaited<ReturnType<typeof TrackPlayer.getActiveTrack>>) => {
        const metadata = {
            trackId: track?.id?.toString().split('-')[0] ?? null,
            artwork: typeof track?.artwork === 'string' ? track.artwork : null,
        };
        const previous = usePlaybackSnapshotStore.getState();
        if (previous.trackId !== metadata.trackId || previous.artwork !== metadata.artwork) {
            usePlaybackSnapshotStore.setState(metadata);
        }
    };
    const subscription = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, ({ track }) => {
        revision++;
        publish(track);
    });
    const refresh = async () => {
        const requestedRevision = ++revision;
        try {
            const track = await TrackPlayer.getActiveTrack();
            if (!disposed && requestedRevision === revision) publish(track);
        } catch {
            // Setup or teardown may overlap a foreground transition.
        }
    };
    refreshCurrentSubscription = refresh;
    void refresh();
    return () => {
        disposed = true;
        if (refreshCurrentSubscription === refresh) refreshCurrentSubscription = undefined;
        subscription.remove();
    };
}
