import TrackPlayer from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';
import { useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { useCastStore } from '../store/useCastStore';

const track: any = { id: 'song', title: 'Song', fileUrl: 'file:///song.mp3', duration: 100,
    album: { fetch: async () => null }, artist: { fetch: async () => ({ name: 'Artist' }) } };

beforeEach(() => {
    jest.clearAllMocks();
    usePlayerStore.setState({ activeTrack: null, isPreparingExternal: false, isQueueLoading: false });
    useMultipleQueuesStore.setState({ isSwitching: false, pendingEdits: 0 });
    useCastStore.setState({ isServerRunning: false, isLocalCastActive: false, isChromecastConnected: false });
});

it('clears the previous play intent before preparing a new queue without autoplay', async () => {
    await usePlayerStore.getState().loadQueue([track], 0, 'album:test', undefined, false);
    expect(TrackPlayer.pause).toHaveBeenCalledWith(true);
    expect((TrackPlayer.pause as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((TrackPlayer.reset as jest.Mock).mock.invocationCallOrder[0]);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(usePlayerStore.getState()).toMatchObject({ isPreparingExternal: true, activeTrack: track });
});

it('preserves autoplay for existing mobile queue-loading callers', async () => {
    await usePlayerStore.getState().loadQueue([track], 0, 'album:test');
    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().isPreparingExternal).toBe(false);
});
