import TrackPlayer from 'react-native-track-player';
import { mySchema } from '../database/schema';
import { myMigrations } from '../database/migrations';

const mockNative = { configureTimestamps: jest.fn(async (_policy: string) => {}), markTimestampSeek: jest.fn(async (_manual: boolean, _position: number) => {}), finishTimestampSeek: jest.fn(async () => {}) };
const mockFind = jest.fn();
const mockWrite = jest.fn(async (callback: () => unknown) => callback());
const mockMetadata = jest.fn(async () => {});
const mockLoad = jest.fn(async () => {});
const mockSaveSession = jest.fn();
const mockGetSession = jest.fn();
const mockPlayer: any = { activeTrack: null, isSyncingLyrics: false, updateTrackMetadata: mockMetadata, loadQueue: mockLoad };
const mockAB: any = { pointA: null, pointB: null };
const mockCast: any = { isServerRunning: false, isLocalCastActive: false, isChromecastConnected: false };
const mockPlayerListeners: any[] = [];
const mockABListeners: any[] = [];
const mockCastListeners: any[] = [];
const mockChrome = jest.fn(async (..._args: any[]) => {});
jest.mock('expo-modules-core', () => ({ requireNativeModule: () => mockNative }));
jest.mock('../database', () => ({ database: { get: () => ({ find: mockFind }), write: (callback: any) => mockWrite(callback) } }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: () => mockPlayer, subscribe: (callback: any) => mockPlayerListeners.push(callback) } }));
jest.mock('../store/useABRepeatStore', () => ({ useABRepeatStore: { getState: () => mockAB, subscribe: (callback: any) => mockABListeners.push(callback) } }));
jest.mock('../store/useCastStore', () => ({ useCastStore: { getState: () => mockCast, subscribe: (callback: any) => mockCastListeners.push(callback) } }));
jest.mock('../store/useMultipleQueuesStore', () => ({ getQueueSession: (id: number) => mockGetSession(id), useMultipleQueuesStore: { getState: () => ({ slots: [0, 1, 2, 3, 4].map(id => ({ id })), saveSession: mockSaveSession }) } }));
jest.mock('../services/ChromecastService', () => ({ ChromecastService: { updateTimestamps: (...args: any[]) => mockChrome(...args) } }));

let service: typeof import('../services/TimestampService').TimestampService;
let store: typeof import('../store/useTimestampStore').useTimestampStore;
const config = { enabled: true, segments: [{ id: 'one', startMs: 10000, endMs: 20000 }] };
const makeTrack = (id = 'song', skipSegments = JSON.stringify(config)) => {
    const listeners: any[] = [];
    const unsubscribe = jest.fn();
    const track: any = { id, duration: 120, skipSegments,
        observe: () => ({ subscribe: (callback: any) => { listeners.push(callback); callback(track); return { unsubscribe }; } }),
        update: jest.fn(async (callback: any) => { callback(track); listeners.forEach(listener => listener(track)); }),
    };
    return { track, unsubscribe };
};
const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
beforeEach(() => {
    jest.clearAllMocks(); mockGetSession.mockReset(); mockFind.mockReset();
    mockPlayer.activeTrack = null; mockPlayer.isSyncingLyrics = false;
    Object.assign(mockAB, { pointA: null, pointB: null });
    Object.assign(mockCast, { isServerRunning: false, isLocalCastActive: false, isChromecastConnected: false });
    mockPlayerListeners.length = 0; mockABListeners.length = 0; mockCastListeners.length = 0;
    jest.isolateModules(() => {
        service = require('../services/TimestampService').TimestampService;
        store = require('../store/useTimestampStore').useTimestampStore;
    });
});

it('adds an optional track field through migration and preserves existing songs', () => {
    expect(mySchema.version).toBe(23);
    expect(mySchema.tables.tracks.columns.skip_segments).toMatchObject({ type: 'string', isOptional: true });
    expect(myMigrations.sortedMigrations.find(item => item.toVersion === 23)?.steps).toEqual([
        { type: 'add_columns', table: 'tracks', columns: [{ name: 'skip_segments', type: 'string', isOptional: true }] },
    ]);
});

it('observes the current song once, applies embedded rules immediately and avoids repeated configuration', async () => {
    const { track } = makeTrack(); mockPlayer.activeTrack = track; mockFind.mockResolvedValue(track);
    const pending = service.initialize(); await settle(); await pending; await service.initialize();
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(store.getState().config).toEqual(config);
    expect(JSON.parse(mockNative.configureTimestamps.mock.calls[0][0])).toMatchObject({ trackId: 'song', config, blocked: false });
    const calls = mockNative.configureTimestamps.mock.calls.length;
    mockCastListeners[0](); mockABListeners[0]();
    expect(mockNative.configureTimestamps).toHaveBeenCalledTimes(calls);
    mockPlayerListeners[0]({ ...mockPlayer }, { ...mockPlayer });
    expect(mockFind).toHaveBeenCalledTimes(1);
});

it('disposes the old song observer and ignores a stale async database response', async () => {
    const old = makeTrack('old'), current = makeTrack('new');
    mockPlayer.activeTrack = old.track; mockFind.mockResolvedValueOnce(old.track);
    await service.initialize();
    let resolve!: (value: any) => void;
    mockFind.mockReturnValueOnce(new Promise(finish => { resolve = finish; }));
    mockPlayer.activeTrack = makeTrack('slow').track;
    mockPlayerListeners[0](mockPlayer, { activeTrack: old.track });
    mockFind.mockResolvedValueOnce(current.track); mockPlayer.activeTrack = current.track;
    mockPlayerListeners[0](mockPlayer, { activeTrack: { id: 'slow' } });
    await settle(); resolve(makeTrack('slow').track); await settle();
    expect(old.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.getState().trackId).toBe('new');
});

it('disables local execution during cast or original-audio editing and sends draft preview rules to Chromecast', async () => {
    const { track } = makeTrack(); mockPlayer.activeTrack = track; mockFind.mockResolvedValue(track);
    await service.initialize();
    mockCast.isChromecastConnected = true; mockCastListeners[0](); await settle();
    expect(mockChrome).toHaveBeenLastCalledWith(config, 'song');
    expect(JSON.parse(mockNative.configureTimestamps.mock.calls.at(-1)![0]).blocked).toBe(true);
    store.setState({ previewTrackId: 'song', previewConfig: null }); await settle();
    expect(mockChrome).toHaveBeenLastCalledWith({ enabled: false, segments: [] }, 'song');
    store.setState({ previewConfig: config }); await settle();
    expect(mockChrome).toHaveBeenLastCalledWith(config, 'song');
});

it('saves normalized intervals to the DB and every queue occurrence while preserving live saved time', async () => {
    const { track } = makeTrack();
    const occurrence = { id: 'song-instance', url: 'file:///song.mp3' };
    const unrelated = { id: 'other-instance', url: 'file:///other.mp3' };
    mockGetSession.mockImplementation(id => id === 1 ? { position: 78, accumulatedTime: 49, queue: [occurrence, unrelated], shuffleOriginalQueue: [occurrence] } : null);
    await service.save(track, config);
    expect(JSON.parse(track.skipSegments)).toEqual(config);
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockSaveSession).toHaveBeenCalledTimes(1);
    expect(mockSaveSession).toHaveBeenCalledWith(1, expect.objectContaining({ position: 78, accumulatedTime: 49,
        queue: [expect.objectContaining({ ...occurrence, skipSegments: track.skipSegments }), unrelated],
        shuffleOriginalQueue: [expect.objectContaining({ skipSegments: track.skipSegments })],
    }));
    expect(mockMetadata).toHaveBeenCalledWith('song');
});

it('rejects invalid ranges and fully omitted A–B loops before writing any data', async () => {
    const { track } = makeTrack();
    await expect(service.save(track, { enabled: true, segments: [{ id: 'bad', startMs: 30000, endMs: 10000 }] })).rejects.toThrow('range');
    store.setState({ trackId: 'song' }); Object.assign(mockAB, { pointA: 12, pointB: 18 });
    await expect(service.save(track, config)).rejects.toThrow('ab_range');
    expect(mockWrite).not.toHaveBeenCalled();
    await service.save(track, { ...config, enabled: false });
    expect(mockWrite).toHaveBeenCalledTimes(1);
});

it('distinguishes manual seeks from automatic seeks and isolates A–B while editing', async () => {
    await service.markSeek(15); await service.markSeek(15, true); await service.finishSeek();
    expect(mockNative.markTimestampSeek.mock.calls).toEqual([[true, 15], [false, 15]]);
    expect(mockNative.finishTimestampSeek).toHaveBeenCalledTimes(1);
    await service.seekAutomatically(20); expect(TrackPlayer.seekTo).toHaveBeenCalledWith(20, true);
    store.setState({ trackId: 'song', config }); expect(service.nativeHandlesAB()).toBe(true);
    store.setState({ previewTrackId: 'song' }); expect(service.nativeHandlesAB()).toBe(false);
});

it('opens an editor without replacing playback until the user requests a different song preview', async () => {
    const { track } = makeTrack();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValueOnce({ id: 'song-instance' });
    await service.prepareEditorTrack(track); expect(mockLoad).not.toHaveBeenCalled();
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValueOnce({ id: 'other-instance' });
    await service.prepareEditorTrack(track);
    expect(mockLoad).toHaveBeenCalledWith([track], 0, 'timestamps:song', undefined, false);
});
