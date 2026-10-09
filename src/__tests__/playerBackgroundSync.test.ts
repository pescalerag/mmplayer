import TrackPlayer from 'react-native-track-player';
import { database } from '../database';
import { usePlayerStore } from '../store/usePlayerStore';
import { handleActiveTrackChangedEvent } from '../components/player/TrackPlayerSync';

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('foreground reconciliation after extended background playback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        usePlayerStore.setState({ activeTrack: { id: 'song0' } as any, activeTrackInstanceId: null,
            isQueueLoading: false, isRestoring: false, userQueueSize: 0 });
        jest.spyOn(usePlayerStore.getState(), 'updateQueueStatus').mockResolvedValue(undefined);
        jest.spyOn(usePlayerStore.getState(), 'savePlaybackState').mockResolvedValue(undefined);
        (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(200);
        (database.get as jest.Mock).mockReturnValue({ find: jest.fn(async id => ({ id })) });
    });
    afterEach(() => jest.restoreAllMocks());

    it('starts the next song immediately on its event even if the previous song was paused', async () => {
        await handleActiveTrackChangedEvent({ track: { id: 'next-instance' }, index: 1, lastIndex: 0 });
        expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.getActiveTrackIndex).not.toHaveBeenCalled();
    });

    it('does not start playback when restoring a saved paused queue', async () => {
        usePlayerStore.setState({ isRestoring: true });
        await handleActiveTrackChangedEvent({ track: { id: 'restored-instance' }, index: 0 });
        expect(TrackPlayer.play).not.toHaveBeenCalled();
    });

    it('recovers the actual song after 200 native advances with no delivered JS events', async () => {
        let nativeSong = 'song0';
        (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => ({ id: nativeSong + '-instance' }));
        for (let i = 1; i <= 200; i++) nativeSong = 'song' + i;
        await usePlayerStore.getState().syncWithTrackPlayer();
        expect(usePlayerStore.getState().activeTrack?.id).toBe('song200');
        expect(usePlayerStore.getState().activeTrackInstanceId).toBe('instance');
    });

    it('does not let a delayed foreground DB lookup overwrite a subsequent native song event', async () => {
        let finishOld!: (track: any) => void;
        const find = jest.fn().mockImplementation(id => id === 'song199'
            ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve({ id }));
        (database.get as jest.Mock).mockReturnValue({ find });
        (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'song199-instance' });
        const foreground = usePlayerStore.getState().syncWithTrackPlayer();
        await settle();
        await handleActiveTrackChangedEvent({ track: { id: 'song200-instance' }, index: 200, lastIndex: 199 });
        finishOld({ id: 'song199' });
        await foreground;
        expect(usePlayerStore.getState().activeTrack?.id).toBe('song200');
    });

    it('ignores a delayed native foreground read when a newer song event arrived', async () => {
        let finishOld!: (track: any) => void;
        (TrackPlayer.getActiveTrack as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }));
        const foreground = usePlayerStore.getState().syncWithTrackPlayer();
        await handleActiveTrackChangedEvent({ track: { id: 'song201-instance' }, index: 201, lastIndex: 200 });
        finishOld({ id: 'song200-instance' });
        await foreground;
        expect(usePlayerStore.getState().activeTrack?.id).toBe('song201');
    });

    it('keeps the newest of overlapping foreground reconciliations', async () => {
        let finishOld!: (track: any) => void;
        (TrackPlayer.getActiveTrack as jest.Mock)
            .mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
            .mockResolvedValueOnce({ id: 'song202-instance' });
        const old = usePlayerStore.getState().syncWithTrackPlayer();
        await usePlayerStore.getState().syncWithTrackPlayer();
        finishOld({ id: 'song201-instance' });
        await old;
        expect(usePlayerStore.getState().activeTrack?.id).toBe('song202');
    });

    it('keeps the last of 200 events with out-of-order metadata, even while loading a large queue', async () => {
        usePlayerStore.setState({ isQueueLoading: true });
        const finishes: (() => void)[] = [];
        (database.get as jest.Mock).mockReturnValue({ find: jest.fn(id => new Promise(resolve => {
            finishes.push(() => resolve({ id }));
        })) });
        const changes = Array.from({ length: 200 }, (_, i) => handleActiveTrackChangedEvent({
            track: { id: `song${i + 1}-instance` }, index: i + 1, lastIndex: i,
        }));
        expect(finishes).toHaveLength(200);
        for (const finish of [...finishes].reverse()) finish();
        await Promise.all(changes);
        expect(usePlayerStore.getState().activeTrack?.id).toBe('song200');
        expect(usePlayerStore.getState().activeTrackInstanceId).toBe('instance');
    });

    it('ignores an older incomplete event whose native track lookup finishes last', async () => {
        let finishOld!: (track: any) => void;
        (TrackPlayer.getActiveTrack as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }));
        const oldEvent = handleActiveTrackChangedEvent({ index: 199, lastIndex: 198 });
        await handleActiveTrackChangedEvent({ track: { id: 'song200-instance' }, index: 200, lastIndex: 199 });
        finishOld({ id: 'song199-instance' });
        await oldEvent;
        expect(usePlayerStore.getState().activeTrack?.id).toBe('song200');
    });

    it('updates the playing instance when the same song appears again in the queue', async () => {
        usePlayerStore.setState({ activeTrack: { id: 'song200' } as any, activeTrackInstanceId: 'first' });
        (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'song200-second' });
        await usePlayerStore.getState().syncWithTrackPlayer();
        expect(usePlayerStore.getState().activeTrackInstanceId).toBe('second');
    });
});
