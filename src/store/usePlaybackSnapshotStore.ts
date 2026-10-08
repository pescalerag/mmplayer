import TrackPlayer, { Event, State } from 'react-native-track-player';
import { create } from 'zustand';

export const usePlaybackSnapshotStore = create(() => ({
    state: undefined as State | undefined,
    controlState: undefined as State | undefined,
    playWhenReady: undefined as boolean | undefined,
    trackId: null as string | null,
    artwork: null as string | null,
    position: 0,
    duration: 0,
    buffered: 0,
}));

let refreshCurrentSubscription: (() => Promise<void>) | undefined;

// Called on foreground/focus; track identity is event-driven between these reconciliations.
export async function refreshPlaybackSnapshot() {
    await refreshCurrentSubscription?.();
}

// Loading/ready are transport transitions, not user pauses. Keep the last
// settled display state until native play intent or a settled state changes it.
export function resolvePlaybackControlState(state: State | undefined, playWhenReady: boolean | undefined, previous: State | undefined) {
    if (state === undefined) return previous;
    if (state === State.None || state === State.Error || state === State.Ended) return state;
    if (playWhenReady !== undefined) return playWhenReady ? State.Playing : State.Paused;
    if (state === State.Loading || state === State.Buffering || state === State.Ready) {
        return previous;
    }
    return state;
}

// Keep one native subscription alive across screen mounts. Native events win
// over initial reads and over progress reads for a previous track.
export function subscribeToPlaybackSnapshot() {
    let disposed = false;
    let revision = 0;
    let stateRevision = 0;
    let intentRevision = 0;
    let reading = false;
    const refreshProgress = async () => {
        if (reading) return;
        reading = true;
        const requestedRevision = revision;
        try {
            const progress = await TrackPlayer.getProgress();
            if (!disposed && requestedRevision === revision) {
                usePlaybackSnapshotStore.setState(progress);
            }
        } catch {
            // The player may not have been set up yet.
        } finally {
            reading = false;
        }
    };
    const subscriptions = [
        TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
            stateRevision++;
            usePlaybackSnapshotStore.setState(snapshot => ({
                state,
                controlState: resolvePlaybackControlState(state, snapshot.playWhenReady, snapshot.controlState),
            }));
        }),
        TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, ({ playWhenReady }) => {
            intentRevision++;
            usePlaybackSnapshotStore.setState(snapshot => ({
                playWhenReady,
                controlState: resolvePlaybackControlState(snapshot.state, playWhenReady, snapshot.controlState),
            }));
        }),
        TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, ({ track }) => {
            revision++;
            usePlaybackSnapshotStore.setState({
                trackId: track?.id?.toString().split('-')[0] ?? null,
                artwork: typeof track?.artwork === 'string' ? track.artwork : null,
                position: 0,
                duration: track?.duration ?? 0,
                buffered: 0,
            });
            void refreshProgress();
        }),
    ];
    const refresh = async () => {
        const requestedRevision = ++revision;
        const requestedStateRevision = stateRevision;
        const requestedIntentRevision = intentRevision;
        try {
            const [track, playback, playWhenReady, progress] = await Promise.all([
                TrackPlayer.getActiveTrack(), TrackPlayer.getPlaybackState(),
                TrackPlayer.getPlayWhenReady(), TrackPlayer.getProgress(),
            ]);
            if (disposed || requestedRevision !== revision) return;
            usePlaybackSnapshotStore.setState(snapshot => {
                const state = requestedStateRevision === stateRevision ? playback.state : snapshot.state;
                const intent = requestedIntentRevision === intentRevision && requestedStateRevision === stateRevision
                    ? playWhenReady : snapshot.playWhenReady;
                return {
                    trackId: track?.id?.toString().split('-')[0] ?? null,
                    artwork: typeof track?.artwork === 'string' ? track.artwork : null,
                    ...progress,
                    state,
                    playWhenReady: intent,
                    controlState: resolvePlaybackControlState(state, intent, snapshot.controlState),
                };
            });
        } catch {
            // Setup or teardown may overlap a foreground transition.
        }
    };
    refreshCurrentSubscription = refresh;
    const initialRevision = revision;
    const initialStateRevision = stateRevision;
    const initialIntentRevision = intentRevision;
    void TrackPlayer.getPlaybackState().then(({ state }) => {
        if (!disposed && initialStateRevision === stateRevision) {
            usePlaybackSnapshotStore.setState(snapshot => ({
                state,
                controlState: resolvePlaybackControlState(state, snapshot.playWhenReady, snapshot.controlState),
            }));
        }
    }).catch(() => {});
    void TrackPlayer.getPlayWhenReady().then(playWhenReady => {
        if (!disposed && initialIntentRevision === intentRevision && initialStateRevision === stateRevision) {
            usePlaybackSnapshotStore.setState(snapshot => ({
                playWhenReady,
                controlState: resolvePlaybackControlState(snapshot.state, playWhenReady, snapshot.controlState),
            }));
        }
    }).catch(() => {});
    void TrackPlayer.getActiveTrack().then(track => {
        if (!disposed && initialRevision === revision) {
            usePlaybackSnapshotStore.setState({
                trackId: track?.id?.toString().split('-')[0] ?? null,
                artwork: typeof track?.artwork === 'string' ? track.artwork : null,
            });
        }
    }).catch(() => {});
    void refreshProgress();
    const timer = setInterval(() => { void refreshProgress(); }, 250);
    return () => {
        disposed = true;
        if (refreshCurrentSubscription === refresh) refreshCurrentSubscription = undefined;
        clearInterval(timer);
        subscriptions.forEach(subscription => subscription.remove());
    };
}
