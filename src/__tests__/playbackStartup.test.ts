import TrackPlayer from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';
import { useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { useCastStore } from '../store/useCastStore';
import { database } from '../database';

const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const track = (id: string, album = Promise.resolve({ title: 'Album' })) => ({
    id, title: id, fileUrl: `file:///${id}.mp3`, duration: 180,
    album: { fetch: jest.fn(() => album) },
    queryCollaborators: { fetch: jest.fn().mockResolvedValue([{ name: 'Artist' }]) },
} as any);

beforeEach(async () => {
    await usePlayerStore.getState().cancelQueueLoading();
    jest.clearAllMocks(); jest.useFakeTimers();
    useMultipleQueuesStore.setState({ isSwitching: false, pendingEdits: 0 });
    useCastStore.setState({ isServerRunning: false, isLocalCastActive: false });
    usePlayerStore.setState({ activeTrack: null, isRestoring: false, isPreparingQueue: false, isQueueLoading: false });
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue(null) });
});
afterEach(async () => {
    await usePlayerStore.getState().cancelQueueLoading();
    await jest.runAllTimersAsync();
    jest.useRealTimers(); jest.restoreAllMocks();
});

it('starts the selected song without waiting for the following metadata and pauses before replacing native media', async () => {
    let finish!: (value: any) => void;
    const selected = track('selected');
    const following = track('following', new Promise(resolve => { finish = resolve; }));
    await usePlayerStore.getState().loadQueue([selected, following], 0, 'album', ['selected-entry', 'following-entry']);
    expect(TrackPlayer.setQueue).toHaveBeenCalledWith([expect.objectContaining({ id: 'selected-selected-entry' })]);
    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.stop).not.toHaveBeenCalled();
    expect((TrackPlayer.pause as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((TrackPlayer.setQueue as jest.Mock).mock.invocationCallOrder[0]);
    expect(usePlayerStore.getState()).toMatchObject({ activeTrack: selected, isPreparingQueue: false, isQueueLoading: true });
    finish({ title: 'Album' }); await jest.runAllTimersAsync();
    expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 'following-following-entry' })]);
    expect(usePlayerStore.getState().isQueueLoading).toBe(false);
});

it('loads the next songs before inserting a long played prefix and preserves every instance in order', async () => {
    const tracks = Array.from({ length: 40 }, (_, i) => track(`song${i}`));
    await usePlayerStore.getState().loadQueue(tracks, 20, 'playlist', tracks.map((_, i) => `entry${i}`));
    await jest.runAllTimersAsync();
    const calls = (TrackPlayer.add as jest.Mock).mock.calls;
    expect(calls[0][0].map((t: any) => t.id)).toEqual(tracks.slice(21, 36).map((_, i) => `song${21 + i}-entry${21 + i}`));
    expect(calls[0][1]).toBeUndefined();
    expect(calls[1][1]).toBe(0);
    expect(calls[2][1]).toBe(15);
    expect(calls[3][0].map((t: any) => t.id)).toEqual(['song36-entry36', 'song37-entry37', 'song38-entry38', 'song39-entry39']);
    expect(usePlayerStore.getState().isQueueLoading).toBe(false);
});

it('discards a previous request whose selected-song metadata finishes after a newer playback', async () => {
    let finish!: (value: any) => void;
    const old = track('old', new Promise(resolve => { finish = resolve; }));
    const oldRequest = usePlayerStore.getState().loadQueue([old], 0);
    await settle();
    const latest = track('latest');
    await usePlayerStore.getState().loadQueue([latest], 0);
    finish({ title: 'Old album' }); await oldRequest;
    expect(TrackPlayer.setQueue).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().activeTrack).toBe(latest);
});

it('never adds stale background tracks after replacing a queue', async () => {
    let finish!: (value: any) => void;
    const delayed = track('obsolete', new Promise(resolve => { finish = resolve; }));
    await usePlayerStore.getState().loadQueue([track('first'), delayed], 0);
    const latest = track('latest');
    await usePlayerStore.getState().loadQueue([latest], 0);
    finish({ title: 'Old album' }); await jest.runAllTimersAsync();
    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(usePlayerStore.getState()).toMatchObject({ activeTrack: latest, isQueueLoading: false, isPreparingQueue: false });
});

it('releases the preparation guard if native replacement fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (TrackPlayer.setQueue as jest.Mock).mockRejectedValueOnce(new Error('native failure'));
    await expect(usePlayerStore.getState().loadQueue([track('failed')], 0, 'auto', undefined, false)).rejects.toThrow('native failure');
    expect(usePlayerStore.getState()).toMatchObject({ isPreparingQueue: false, isQueueLoading: false });
    expect(TrackPlayer.play).not.toHaveBeenCalled();
});

it('clears the preparation guard when a replacement is cancelled while native work is pending', async () => {
    let finish!: () => void;
    (TrackPlayer.setQueue as jest.Mock).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const request = usePlayerStore.getState().loadQueue([track('cancelled')], 0);
    await settle();
    expect(usePlayerStore.getState().isPreparingQueue).toBe(true);
    const cancellation = usePlayerStore.getState().cancelQueueLoading();
    finish(); await Promise.all([request, cancellation]);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(usePlayerStore.getState()).toMatchObject({ isPreparingQueue: false, isQueueLoading: false });
});

it('applies the restored global speed and pitch before the next play instead of the initial defaults', async () => {
    usePlayerStore.setState({ playbackSpeed: 1, playbackPitch: 1, isVinylModeEnabled: false });
    await usePlayerStore.getState().restorePlaybackState({ queue: [{ id: 'saved-instance', url: 'file:///saved.mp3' }],
        index: 0, position: 20, accumulatedTime: 10, playbackSpeed: 1.5, playbackPitch: 1.2, isVinylModeEnabled: false,
        repeatMode: 0, playbackContext: 'album', isShuffleEnabled: false, shuffleOriginalQueue: [], userQueueSize: 0 });
    expect(TrackPlayer.setRate).toHaveBeenLastCalledWith(1.5);
    expect((TrackPlayer as any).setPitch).toHaveBeenLastCalledWith(1.2);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(0, 20);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
});
