import TrackPlayer, { Event } from 'react-native-track-player';
import { refreshPlaybackSnapshot, subscribeToPlaybackSnapshot, usePlaybackSnapshotStore } from '../store/usePlaybackSnapshotStore';

jest.mock('react-native-track-player', () => ({
    __esModule: true,
    Event: { PlaybackActiveTrackChanged: 'track' },
    default: {
        addEventListener: jest.fn(),
        getActiveTrack: jest.fn(),
        getProgress: jest.fn(),
        getPlaybackState: jest.fn(),
        getPlayWhenReady: jest.fn(),
    },
}));

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('event-driven player metadata', () => {
    let onTrack: (event: any) => void;
    const remove = jest.fn();
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        (TrackPlayer.addEventListener as jest.Mock).mockImplementation((event, callback) => {
            onTrack = callback;
            return { remove };
        });
        (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'a-instance', artwork: 'cover-a' });
        usePlaybackSnapshotStore.setState({ trackId: null, artwork: null });
    });
    afterEach(() => jest.useRealTimers());

    it('reads initial metadata without polling progress or interpreting transport state', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        expect(usePlaybackSnapshotStore.getState()).toEqual({ trackId: 'a', artwork: 'cover-a' });
        await jest.advanceTimersByTimeAsync(5000);
        expect(TrackPlayer.getActiveTrack).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.getProgress).not.toHaveBeenCalled();
        expect(TrackPlayer.getPlaybackState).not.toHaveBeenCalled();
        expect(TrackPlayer.getPlayWhenReady).not.toHaveBeenCalled();
        expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.PlaybackActiveTrackChanged, expect.any(Function));
        dispose();
        expect(remove).toHaveBeenCalledTimes(1);
    });

    it('rejects a late initial read after a new song event', async () => {
        let finish!: (track: any) => void;
        (TrackPlayer.getActiveTrack as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const dispose = subscribeToPlaybackSnapshot();
        onTrack({ track: { id: 'b-instance', artwork: 'cover-b' } });
        finish({ id: 'a-instance', artwork: 'cover-a' });
        await settle();
        expect(usePlaybackSnapshotStore.getState()).toEqual({ trackId: 'b', artwork: 'cover-b' });
        dispose();
    });

    it('recovers the cover on foreground after missed background events', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'song200-instance', artwork: 'cover-200' });
        await refreshPlaybackSnapshot();
        expect(usePlaybackSnapshotStore.getState()).toEqual({ trackId: 'song200', artwork: 'cover-200' });
        dispose();
    });

    it('rejects an old foreground read when a newer native event arrives', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        let finish!: (track: any) => void;
        (TrackPlayer.getActiveTrack as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const pending = refreshPlaybackSnapshot();
        onTrack({ track: { id: 'new-instance', artwork: 'new-cover' } });
        finish({ id: 'old-instance', artwork: 'old-cover' });
        await pending;
        expect(usePlaybackSnapshotStore.getState()).toEqual({ trackId: 'new', artwork: 'new-cover' });
        dispose();
    });

    it('does not notify the screen when metadata is unchanged', async () => {
        const dispose = subscribeToPlaybackSnapshot();
        await settle();
        const listener = jest.fn();
        const unsubscribe = usePlaybackSnapshotStore.subscribe(listener);
        onTrack({ track: { id: 'a-instance', artwork: 'cover-a' } });
        await refreshPlaybackSnapshot();
        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
        dispose();
    });

    it('ignores pending reads after unmount', async () => {
        let finish!: (track: any) => void;
        (TrackPlayer.getActiveTrack as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const dispose = subscribeToPlaybackSnapshot();
        dispose();
        finish({ id: 'late', artwork: 'late-cover' });
        await settle();
        expect(usePlaybackSnapshotStore.getState()).toEqual({ trackId: null, artwork: null });
    });
});
