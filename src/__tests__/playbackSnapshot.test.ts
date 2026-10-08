import TrackPlayer, { Event, State } from 'react-native-track-player';
import { subscribeToPlaybackSnapshot, usePlaybackSnapshotStore } from '../store/usePlaybackSnapshotStore';

jest.mock('react-native-track-player', () => ({
    __esModule: true,
    Event: { PlaybackState: 'state', PlaybackActiveTrackChanged: 'track', PlaybackPlayWhenReadyChanged: 'intent' },
    State: { Playing: 'playing', Paused: 'paused', Loading: 'loading', Buffering: 'buffering', Ready: 'ready', None: 'none', Error: 'error', Ended: 'ended', Stopped: 'stopped' },
    default: {
        addEventListener: jest.fn(),
        getProgress: jest.fn(),
        getPlaybackState: jest.fn(),
        getPlayWhenReady: jest.fn(),
        getActiveTrack: jest.fn(),
    },
}));

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('shared playback snapshot', () => {
    let listeners: Record<string, (event: any) => void>;
    let remove: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        listeners = {};
        remove = jest.fn();
        jest.clearAllMocks();
        (TrackPlayer.addEventListener as jest.Mock).mockImplementation((event, callback) => {
            listeners[event] = callback;
            return { remove };
        });
        (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'a', artwork: 'cover-a' });
        (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Playing });
        (TrackPlayer.getPlayWhenReady as jest.Mock).mockResolvedValue(true);
        (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 42, duration: 180, buffered: 180 });
        usePlaybackSnapshotStore.setState({ state: undefined, controlState: undefined, playWhenReady: undefined, trackId: null, artwork: null, position: 0, duration: 0, buffered: 0 });
    });

    afterEach(() => { jest.useRealTimers(); });

    it('retains the current state and position across reads and cleans up its subscriptions', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        expect(usePlaybackSnapshotStore.getState()).toMatchObject({ trackId: 'a', state: State.Playing, position: 42, duration: 180 });
        listeners[Event.PlaybackPlayWhenReadyChanged]({ playWhenReady: false });
        listeners[Event.PlaybackState]({ state: State.Paused });
        expect(usePlaybackSnapshotStore.getState().state).toBe(State.Paused);
        expect(usePlaybackSnapshotStore.getState().controlState).toBe(State.Paused);
        dispose();
        expect(remove).toHaveBeenCalledTimes(3);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('does not overwrite a track change with a late progress or initial track read', async () => {
        let resolveProgress!: (value: any) => void;
        (TrackPlayer.getProgress as jest.Mock).mockReturnValue(new Promise(resolve => { resolveProgress = resolve; }));
        const dispose = subscribeToPlaybackSnapshot();
        listeners[Event.PlaybackActiveTrackChanged]({ track: { id: 'b-instance', duration: 240, artwork: 'cover-b' } });
        resolveProgress({ position: 90, duration: 180, buffered: 180 });
        await settle();
        expect(usePlaybackSnapshotStore.getState()).toMatchObject({ trackId: 'b', position: 0, duration: 240, artwork: 'cover-b' });
        dispose();
    });

    it('does not overwrite a pause event with the initial playing state', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        listeners[Event.PlaybackState]({ state: State.Paused });
        await settle();
        expect(usePlaybackSnapshotStore.getState().state).toBe(State.Paused);
        expect(usePlaybackSnapshotStore.getState().controlState).toBe(State.Paused);
        dispose();
    });

    it('keeps the pause icon through loading, ready and buffering during a skip', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        const displayed: (State | undefined)[] = [];
        const unsubscribe = usePlaybackSnapshotStore.subscribe(snapshot => { displayed.push(snapshot.controlState); });
        for (const state of [State.Loading, State.Ready, State.Paused, State.Buffering, State.Ready, State.Playing]) {
            listeners[Event.PlaybackState]({ state });
        }
        expect(displayed).toEqual(Array(6).fill(State.Playing));
        unsubscribe();
        dispose();
    });

    it('keeps a paused track paused through buffering and allows pausing during loading', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        listeners[Event.PlaybackState]({ state: State.Loading });
        listeners[Event.PlaybackPlayWhenReadyChanged]({ playWhenReady: false });
        expect(usePlaybackSnapshotStore.getState().controlState).toBe(State.Paused);
        for (const state of [State.Ready, State.Buffering, State.Paused]) {
            listeners[Event.PlaybackState]({ state });
            expect(usePlaybackSnapshotStore.getState().controlState).toBe(State.Paused);
        }
        dispose();
    });

    it('does not replace a user pause with a late initial play-intent read', async () => {
        let finishIntent!: (intent: boolean) => void;
        (TrackPlayer.getPlayWhenReady as jest.Mock).mockReturnValue(new Promise(resolve => { finishIntent = resolve; }));
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        listeners[Event.PlaybackState]({ state: State.Buffering });
        listeners[Event.PlaybackPlayWhenReadyChanged]({ playWhenReady: false });
        finishIntent(true);
        await settle();
        expect(usePlaybackSnapshotStore.getState().controlState).toBe(State.Paused);
        dispose();
    });

    it('updates immediately on explicit pause intent and still shows terminal states', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        listeners[Event.PlaybackPlayWhenReadyChanged]({ playWhenReady: false });
        expect(usePlaybackSnapshotStore.getState().controlState).toBe(State.Paused);
        listeners[Event.PlaybackPlayWhenReadyChanged]({ playWhenReady: true });
        for (const state of [State.Error, State.Ended, State.None]) {
            listeners[Event.PlaybackState]({ state });
            expect(usePlaybackSnapshotStore.getState().controlState).toBe(state);
        }
        dispose();
    });
});
