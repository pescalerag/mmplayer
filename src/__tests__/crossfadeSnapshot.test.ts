import TrackPlayer from 'react-native-track-player';
import { getNativePlaybackSnapshot } from '../../modules/native-equalizer';
import { readPlaybackSnapshot } from '../services/playbackSnapshot';

let mockCasting = false;
jest.mock('../store/useCastStore', () => ({ useCastStore: { getState: () => ({ isServerRunning: mockCasting }) } }));
jest.mock('../../modules/native-equalizer', () => ({ getNativePlaybackSnapshot: jest.fn() }));

beforeEach(() => { mockCasting = false; jest.clearAllMocks(); });

it('captures the incoming identity and position atomically instead of mixing two transitions', async () => {
    const snapshot = { queue: [{ id: 'b', url: 'b.mp3' }], index: 0,
        progress: { position: 2.5, duration: 180, buffered: 10 }, repeatMode: 0 };
    (getNativePlaybackSnapshot as jest.Mock).mockResolvedValue(snapshot);
    expect(await readPlaybackSnapshot()).toBe(snapshot);
    expect(TrackPlayer.getQueue).not.toHaveBeenCalled();
    expect(TrackPlayer.getProgress).not.toHaveBeenCalled();
});

it('preserves the remote progress implementation while casting', async () => {
    mockCasting = true;
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'remote' }]);
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
    (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 50, duration: 180, buffered: 180 });
    expect(await readPlaybackSnapshot()).toMatchObject({ index: 0, progress: { position: 50 } });
    expect(getNativePlaybackSnapshot).not.toHaveBeenCalled();
});

it('can still capture a player before the native snapshot service is bound', async () => {
    (getNativePlaybackSnapshot as jest.Mock).mockResolvedValue(null);
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(undefined);
    expect(await readPlaybackSnapshot()).toMatchObject({ queue: [], index: 0 });
});
