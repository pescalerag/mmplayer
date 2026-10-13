import { database } from '../database';
import TrackPlayer, { RepeatMode, Track } from 'react-native-track-player';
import { LocalCastQueueService } from '../services/LocalCastQueueService';
import { setQueueSnapshot, useQueueSnapshotStore } from '../store/useQueueSnapshotStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePlayerStore } from '../store/usePlayerStore';

jest.mock('../store/usePlayerStore', () => {
  const state = { skipToNext: jest.fn(), playRandomQueueOnEnd: jest.fn() };
  return { usePlayerStore: { getState: () => state } };
});

describe('LocalCast queue preview and transport', () => {
  let queue: Track[];
  let index: number | undefined;
  beforeEach(() => {
    jest.clearAllMocks();
    queue = [{ id: 'one', url: 'one', title: 'One', duration: 180 }, { id: 'two', url: 'two', title: 'Two' }];
    index = 0;
    setQueueSnapshot(queue, 0);
    useSettingsStore.setState({ shuffleOnQueueEnd: false });
    (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Off);
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () => index);
    (TrackPlayer.getTrack as jest.Mock).mockImplementation(async (position: number) => queue[position]);
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => queue);
    (TrackPlayer.skip as jest.Mock).mockImplementation(async (position: number) => { index = position; });
    (usePlayerStore.getState().skipToNext as jest.Mock).mockImplementation(async () => { index = (index ?? 0) + 1; });
    (usePlayerStore.getState().playRandomQueueOnEnd as jest.Mock).mockImplementation(async () => {
      queue = [{ id: 'random', url: 'random' }]; index = 0; setQueueSnapshot(queue, 0);
    });
  });
  it('sends at most the current song and 50 upcoming rows, then omits unchanged lists', async () => {
    queue = Array.from({ length: 300 }, (_, i) => ({ id: String(i), url: String(i) }));
    setQueueSnapshot(queue, 0);
    const state = await LocalCastQueueService.read('session', null, 0);
    expect(state.queue?.items).toHaveLength(51);
    expect(state.queue?.remaining).toBe(299);
    expect(state.queue?.items[0]).toMatchObject({ title: '', artist: '', duration: 0 });
    const same = await LocalCastQueueService.read('session', state.queueVersion, 0);
    expect(same).not.toHaveProperty('queue');
    expect(TrackPlayer.getQueue).not.toHaveBeenCalled();
    useSettingsStore.setState({ shuffleOnQueueEnd: true });
    expect((await LocalCastQueueService.read('session', same.queueVersion, 0)).queue).toBeDefined();
  });
  it('initializes a missing snapshot and disables next for empty or completed queues', async () => {
    useQueueSnapshotStore.setState({ ready: false });
    await LocalCastQueueService.read('init', null, 0);
    expect(TrackPlayer.getQueue).toHaveBeenCalledTimes(1);
    expect((await LocalCastQueueService.read('init', null, 1)).hasNext).toBe(false);
    setQueueSnapshot([], -1);
    const empty = await LocalCastQueueService.read('init', null, undefined);
    expect(empty.hasNext).toBe(false); expect(empty.queue?.items).toEqual([]);
  });
  it.each(['content://covers/one?t=123', 'file:///data/My%20Cover.jpg', 'https://example.com/cover.jpg'])('prepares queue artwork %s only when requested', async artwork => {
    setQueueSnapshot([{ id: 'cover-instance', url: 'song', artwork }], 0);
    const prepare = jest.fn().mockResolvedValue('cast_cover_cover.jpg');
    const state = await LocalCastQueueService.read('covers', null, 0);
    expect(state.queue?.items[0].coverUrl).toBe('/api/queue/cover?index=0&id=cover-instance');
    expect(prepare).not.toHaveBeenCalled();
    expect(await LocalCastQueueService.cover(0, 'cover-instance', prepare)).toBe('/static/cast_cover_cover.jpg');
    expect(prepare).toHaveBeenCalledWith('cover', { coverUrl: artwork });
    expect(TrackPlayer.getQueue).not.toHaveBeenCalled();
  });
  it('rejects invalid or replaced rows and tolerates missing covers and preparation errors', async () => {
    const prepare = jest.fn().mockResolvedValue(null);
    for (const position of [-1, 0.5, 20]) expect(await LocalCastQueueService.cover(position, 'one', prepare)).toBeNull();
    expect(await LocalCastQueueService.cover(0, 'wrong', prepare)).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
    setQueueSnapshot([{ id: 'one', url: 'song', artwork: 'content://cover' }], 0);
    expect(await LocalCastQueueService.cover(0, 'one', prepare)).toBeNull();
    prepare.mockRejectedValueOnce(new Error('unavailable'));
    expect(await LocalCastQueueService.cover(0, 'one', prepare)).toBeNull();
  });
  it('resolves absent queue artwork from the album and tolerates missing albums or records', async () => {
    const find = jest.fn();
    (database.get as jest.Mock).mockReturnValue({ find });
    const prepare = jest.fn().mockResolvedValue(null);
    find.mockResolvedValueOnce({ album: { fetch: jest.fn().mockResolvedValue({ coverUrl: 'content://album' }) } });
    await LocalCastQueueService.cover(0, 'one', prepare);
    expect(prepare).toHaveBeenLastCalledWith('one', { coverUrl: 'content://album' });
    find.mockResolvedValueOnce({ album: { fetch: jest.fn().mockResolvedValue(null) } });
    await LocalCastQueueService.cover(0, 'one', prepare);
    expect(prepare).toHaveBeenLastCalledWith('one', { coverUrl: null });
    find.mockRejectedValueOnce(new Error('deleted'));
    expect(await LocalCastQueueService.cover(0, 'one', prepare)).toBeNull();
  });
  it('validates song identity, version and preview bounds against the real queue', async () => {
    const state = await LocalCastQueueService.read('select', null, 0);
    expect(await LocalCastQueueService.validate('select', state.queueVersion, 1, 'two')).toBe(true);
    expect(await LocalCastQueueService.validate('select', state.queueVersion, -1, 'one')).toBe(false);
    expect(await LocalCastQueueService.validate('select', state.queueVersion, 0.5, 'one')).toBe(false);
    expect(await LocalCastQueueService.validate('select', 'old', 1, 'two')).toBe(false);
    expect(await LocalCastQueueService.validate('select', state.queueVersion, 1, 'wrong')).toBe(false);
    queue = [queue[0], { id: 'replaced', url: 'new' }];
    expect(await LocalCastQueueService.validate('select', state.queueVersion, 1, 'two')).toBe(false);
    expect(await LocalCastQueueService.validate('select', state.queueVersion, 2, 'undefined')).toBe(false);
    index = 1;
    const moved = await LocalCastQueueService.read('select', null, 1);
    expect(await LocalCastQueueService.validate('select', moved.queueVersion, 0, 'one')).toBe(false);
    queue = Array.from({ length: 80 }, (_, i) => ({ id: String(i), url: String(i) }));
    setQueueSnapshot(queue, 1);
    const many = await LocalCastQueueService.read('select', null, 1);
    expect(await LocalCastQueueService.validate('select', many.queueVersion, 52, '52')).toBe(false);
    index = undefined;
    expect(await LocalCastQueueService.validate('select', many.queueVersion, 1, '1')).toBe(false);
  });
  it('uses application next logic and starts random playback at the end only when enabled', async () => {
    expect(await LocalCastQueueService.advance(false)).toBe(true);
    expect(usePlayerStore.getState().skipToNext).toHaveBeenCalledTimes(1);
    expect(await LocalCastQueueService.advance(true)).toBe(false);
    useSettingsStore.setState({ shuffleOnQueueEnd: true });
    expect(await LocalCastQueueService.advance(true)).toBe(true);
    expect(usePlayerStore.getState().playRandomQueueOnEnd).toHaveBeenCalledTimes(1);
  });
  it('does not replay the last song when no random tracks can be loaded or next fails', async () => {
    index = 1; useSettingsStore.setState({ shuffleOnQueueEnd: true });
    (usePlayerStore.getState().playRandomQueueOnEnd as jest.Mock).mockResolvedValue(undefined);
    expect(await LocalCastQueueService.advance(false)).toBe(false);
    index = 0;
    (usePlayerStore.getState().skipToNext as jest.Mock).mockImplementation(async () => { index = 1; });
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValueOnce(null);
    expect(await LocalCastQueueService.advance(false)).toBe(true);
    index = 0;
    (usePlayerStore.getState().skipToNext as jest.Mock).mockResolvedValue(undefined);
    expect(await LocalCastQueueService.advance(false)).toBe(false);
    index = undefined;
    expect(await LocalCastQueueService.advance(false)).toBe(false);
    index = 0;
    (usePlayerStore.getState().skipToNext as jest.Mock).mockImplementation(async () => { index = undefined; });
    expect(await LocalCastQueueService.advance(false)).toBe(false);
  });
  it('honors track repeat on natural end and queue repeat on next', async () => {
    (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Track);
    expect(await LocalCastQueueService.advance(true)).toBe(true);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(0);
    index = 1;
    (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Queue);
    expect(await LocalCastQueueService.advance(false)).toBe(true);
    expect(index).toBe(0);
    expect((await LocalCastQueueService.read('repeat', null, 1)).hasNext).toBe(true);
  });
});
