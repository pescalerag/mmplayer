import TrackPlayer from 'react-native-track-player';
import { handleAutoRequest , startAndroidAutoService } from '../services/AndroidAutoService';
import { AndroidAutoCatalog, autoTracks } from '../services/AndroidAutoCatalog';
import { MultipleQueuesService } from '../services/MultipleQueuesService';
import { QueueActionsService } from '../services/QueueActionsService';
import { usePlayerStore } from '../store/usePlayerStore';
import { useCastStore } from '../store/useCastStore';
import { readPlaybackSnapshot } from '../services/playbackSnapshot';
import { autoId } from '../utils/androidAuto';
import { requireNativeModule } from 'expo-modules-core';
import { database } from '../database';
jest.mock('../services/playerBootstrap', () => ({ ensurePlaybackReady: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/AndroidAutoCatalog', () => ({ AndroidAutoCatalog: { children: jest.fn(), search: jest.fn() }, autoTracks: jest.fn() }));
jest.mock('../services/MultipleQueuesService', () => ({ MultipleQueuesService: { switchQueue: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../services/QueueActionsService', () => ({ QueueActionsService: { waitForPendingActions: jest.fn().mockResolvedValue(undefined), play: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../services/playbackSnapshot', () => ({ readPlaybackSnapshot: jest.fn() }));
jest.mock('../store/usePlayerStore', () => {
    const state = { isSyncingLyrics: false, loadQueue: jest.fn().mockResolvedValue(undefined), savePlaybackState: jest.fn().mockResolvedValue(undefined) };
    return { usePlayerStore: { getState: () => state, setState: jest.fn(value => Object.assign(state, value)), subscribe: jest.fn() } };
});

beforeEach(() => {
    jest.clearAllMocks();
    useCastStore.setState({ isServerRunning: false, isLocalCastActive: false, isChromecastConnected: false });
    (readPlaybackSnapshot as jest.Mock).mockResolvedValue({ queue: [{ id: 'song-first', title: 'Song', url: 'file:///song' }], index: 0, progress: { position: 15 } });
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'song-first' });
});

it('prepares a selected duplicate playlist entry without autoplay', async () => {
    const tracks = [{ id: 'song' }, { id: 'song' }];
    (autoTracks as jest.Mock).mockResolvedValue({ tracks, instances: ['first', 'second'] });
    await handleAutoRequest({ id: '1', kind: 'prepare', mediaId: autoId('entry', JSON.stringify(['playlist:mix', 'song', 'second'])) });
    expect(usePlayerStore.getState().loadQueue).toHaveBeenCalledWith(tracks, 1, 'playlist:mix', ['first', 'second'], false);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
});

it('prepares all songs in a tag returned by voice search', async () => {
    const tracks = [{ id: 'direct' }, { id: 'album-track' }];
    (AndroidAutoCatalog.search as jest.Mock).mockResolvedValue([{ id: 'tag:zelda', title: 'Zelda', playable: true }]);
    (autoTracks as jest.Mock).mockResolvedValue({ tracks });
    await handleAutoRequest({ id: 'voice-tag', kind: 'prepare', query: 'Zelda' });
    expect(autoTracks).toHaveBeenCalledWith('tag:zelda');
    expect(usePlayerStore.getState().loadQueue).toHaveBeenCalledWith(tracks, 0, 'tag:zelda', undefined, false);
});

it('restores the selected queue paused, including an empty queue', async () => {
    (readPlaybackSnapshot as jest.Mock).mockResolvedValue({ queue: [], index: -1, progress: { position: 0 } });
    const result = await handleAutoRequest({ id: '2', kind: 'prepare', mediaId: 'queue:4' });
    expect(MultipleQueuesService.switchQueue).toHaveBeenCalledWith(4);
    expect(result).toMatchObject({ suppressPlay: true, nativeSnapshot: true });
    expect(TrackPlayer.play).not.toHaveBeenCalled();
});

it.each(['isServerRunning', 'isLocalCastActive', 'isChromecastConnected'])('blocks transport while %s is active', async flag => {
    useCastStore.setState({ [flag]: true });
    await expect(handleAutoRequest({ id: '3', kind: 'prepare', mediaId: 'continue' })).rejects.toThrow();
    expect(usePlayerStore.getState().loadQueue).not.toHaveBeenCalled();
});

it('allows browsing while casting', async () => {
    useCastStore.setState({ isLocalCastActive: true });
    (AndroidAutoCatalog.children as jest.Mock).mockResolvedValue([{ id: 'albums' }]);
    expect(await handleAutoRequest({ id: '4', kind: 'children', mediaId: 'library' })).toEqual({ items: [{ id: 'albums' }] });
});

it('resumes the active entry and position without replacing its queue', async () => {
    const result = await handleAutoRequest({ id: '5', kind: 'prepare', mediaId: 'continue' });
    expect(result).toMatchObject({ nativeSnapshot: true });
    expect(readPlaybackSnapshot).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().loadQueue).not.toHaveBeenCalled();
});

it('selects by captured entry identity when the native queue has since moved', async () => {
    const target = { id: 'song-second', title: 'Song', url: 'file:///song' };
    (readPlaybackSnapshot as jest.Mock).mockResolvedValue({ queue: [target, { id: 'song-first' }], index: 1 });
    await handleAutoRequest({ id: '6', kind: 'select', index: 1, mediaId: target.id, position: 7 });
    expect(QueueActionsService.play).toHaveBeenCalledWith(target);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(7);
});

it('does not replace a queue when the request expires during catalog resolution', async () => {
    (autoTracks as jest.Mock).mockResolvedValue({ tracks: [{ id: 'song' }] });
    const check = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValue(new Error('expired'));
    await expect(handleAutoRequest({ id: '7', kind: 'prepare', mediaId: 'album:test' }, check)).rejects.toThrow('expired');
    expect(usePlayerStore.getState().loadQueue).not.toHaveBeenCalled();
});

it('prepares a saved native entry at the requested position without rebuilding its context', async () => {
    await handleAutoRequest({ id: '8', kind: 'prepare', mediaId: 'song-first', position: 42 });
    expect(TrackPlayer.pause).toHaveBeenCalledWith(true);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(0, 42);
    expect(usePlayerStore.getState().loadQueue).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
});

it('rejects an empty generic resume without starting arbitrary music', async () => {
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(null);
    await expect(handleAutoRequest({ id: '9', kind: 'prepare', mediaId: 'continue' })).rejects.toThrow();
    expect(usePlayerStore.getState().loadQueue).not.toHaveBeenCalled();
});

it('registers the native bridge once and drops expired transport requests before dispatch', async () => {
    const native = { addListener: jest.fn(), startAndroidAutoBridge: jest.fn().mockResolvedValue(undefined),
        isAndroidAutoRequestPending: jest.fn().mockResolvedValue(false),
        completeAndroidAutoRequest: jest.fn().mockResolvedValue(undefined), updateAndroidAutoState: jest.fn().mockResolvedValue(undefined) };
    (requireNativeModule as jest.Mock).mockReturnValueOnce(native);
    Object.assign(database, { withChangesForTables: jest.fn(() => ({ subscribe: jest.fn() })) });
    Object.assign(useCastStore, { subscribe: jest.fn() });
    startAndroidAutoService();
    startAndroidAutoService();
    expect(native.addListener).toHaveBeenCalledTimes(1);
    expect(native.startAndroidAutoBridge).toHaveBeenCalledTimes(1);
    native.addListener.mock.calls[0][1]({ id: 'expired', kind: 'prepare', mediaId: 'album:test' });
    await new Promise(resolve => setImmediate(resolve));
    expect(usePlayerStore.getState().loadQueue).not.toHaveBeenCalled();
    expect(native.completeAndroidAutoRequest).not.toHaveBeenCalled();
});
