import TrackPlayer from 'react-native-track-player';
import { createMMKV } from 'react-native-mmkv';
import { MultipleQueuesService } from '../services/MultipleQueuesService';
import { getQueueSession, isSuspendedQueueListen, migrateQueueShuffleOnEnd, persistQueueTime, QueueSession, removeDeletedTracksFromInactiveQueues, selectShuffleOnQueueEnd, useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { syncWidgetState } from '../services/PlaybackService';
import { PlaybackListenService } from '../services/PlaybackListenService';
import { useQueueSnapshotStore } from '../store/useQueueSnapshotStore';
import { useUIStore } from '../store/useUIStore';

jest.mock('react-native-mmkv', () => {
    const values = new Map();
    const storage = { set: jest.fn((key, value) => values.set(key, value)), getString: (key: string) => values.get(key), getNumber: (key: string) => values.get(key), remove: (key: string) => values.delete(key) };
    return { createMMKV: () => storage };
});
let mockQueue: any[] = [];
let mockIndex = 0;
let mockPosition = 0;
let mockRepeat = 0;
let mockCast = false;
let mockFailRestore = false;
let mockInstance = 0;
const mockSeconds = new Map<string, number>();
const mockPauseTimer = jest.fn();
const mockAddActive = jest.fn();
const mockPlayer: any = {
    userQueueSize: 1, playbackContext: 'album:original', isShuffleEnabled: true, shuffleOriginalQueue: [],
    playbackSpeed: 1, playbackPitch: 1, isVinylModeEnabled: true, isQueueLoading: false,
    queueVersion: 0, windowVersion: 0, activeTrack: { id: 'a' },
    cancelQueueLoading: jest.fn(async () => {}), addMultipleToQueueEnd: mockAddActive,
    updateQueueStatus: jest.fn(async () => {}),
    restorePlaybackState: jest.fn(async (suppliedSession?: QueueSession) => {
        if (mockFailRestore) { mockFailRestore = false; throw new Error('Native failure'); }
        const session = suppliedSession ?? JSON.parse(createMMKV().getString('@player_persistence')!);
        mockQueue = session.queue; mockIndex = session.index; mockPosition = session.position;
        mockPlayer.userQueueSize = session.userQueueSize; mockPlayer.isShuffleEnabled = session.isShuffleEnabled;
        mockPlayer.shuffleOriginalQueue = session.shuffleOriginalQueue; mockPlayer.playbackContext = session.playbackContext;
        mockPlayer.playbackSpeed = session.playbackSpeed; mockPlayer.playbackPitch = session.playbackPitch;
        mockPlayer.isVinylModeEnabled = session.isVinylModeEnabled;
        mockRepeat = session.repeatMode;
        mockPlayer.activeTrack = { id: mockQueue[mockIndex].id };
        mockSeconds.set(mockQueue[mockIndex].id, session.accumulatedTime);
    }),
    savePlaybackState: jest.fn(async () => {}),
};
jest.mock('../store/usePlayerStore', () => ({
    usePlayerStore: { getState: () => mockPlayer, setState: (value: any) => Object.assign(mockPlayer, typeof value === 'function' ? value(mockPlayer) : value) },
    mapToTPTrack: async (track: any) => ({ id: `${track.id}-instance${++mockInstance}`, url: track.fileUrl, title: track.title }),
}));
jest.mock('../store/useCastStore', () => ({ useCastStore: { getState: () => ({ isLocalCastActive: mockCast, isServerRunning: mockCast }) } }));
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: { getState: () => ({ queueAddBehavior: 'user_queue' }) } }));
jest.mock('../services/PlaybackService', () => ({ PlaybackTimeTracker: { getAccumulatedSeconds: (id: string) => mockSeconds.get(id) || 0, onStateNotPlaying: () => mockPauseTimer(), reset: () => mockSeconds.clear() }, syncWidgetState: jest.fn(async () => {}) }));
jest.mock('../services/PlaybackListenService', () => ({ PlaybackListenService: { save: jest.fn(async () => {}) } }));
jest.mock('../store/useToastStore', () => ({ useToastStore: { getState: () => ({ hideToast: jest.fn() }) } }));
jest.mock('../services/QueueActionsService', () => ({ QueueActionsService: { waitForPendingActions: async () => {} } }));
jest.mock('../store/usePlaybackSnapshotStore', () => ({ refreshPlaybackSnapshot: jest.fn(async () => {}) }));
jest.mock('../store/useABRepeatStore', () => ({ useABRepeatStore: { getState: () => ({ clearAB: jest.fn() }) } }));

const session = (id: string): QueueSession => ({ queue: [{ id: `${id}-instance`, url: `file:///${id}.mp3` }], index: 0, position: 42, accumulatedTime: 27,
    userQueueSize: 0, playbackContext: `album:${id}`, isShuffleEnabled: false, shuffleOriginalQueue: [], repeatMode: 2,
    playbackSpeed: 1, playbackPitch: 1, isVinylModeEnabled: true });
beforeEach(() => {
    jest.clearAllMocks(); mockCast = false; mockFailRestore = false; mockInstance = 0; mockSeconds.clear();
    mockQueue = [{ id: 'a-instance', url: 'file:///a.mp3' }, { id: 'manual-instance', url: 'file:///manual.mp3', isManual: true }, { id: 'context-instance', url: 'file:///context.mp3' }];
    mockIndex = 0; mockPosition = 81; mockRepeat = 1; mockSeconds.set('a-instance', 64);
    Object.assign(mockPlayer, { userQueueSize: 1, playbackContext: 'album:original', isShuffleEnabled: true, isQueueLoading: false, activeTrack: { id: 'a' }, playbackSpeed: 1, playbackPitch: 1, isVinylModeEnabled: true });
    useMultipleQueuesStore.setState({ activeId: 0, isSwitching: false, pendingEdits: 0, slots: Array.from({ length: 5 }, (_, id) => ({ id, name: '', session: null })) });
    createMMKV().remove('@multiple_queues_v1');
    for (let id = 0; id < 5; id++) { createMMKV().remove(`@queue_position_${id}`); createMMKV().remove(`@queue_accumulated_${id}`); createMMKV().remove(`@queue_session_${id}`); }
    (syncWidgetState as jest.Mock).mockResolvedValue(undefined);
    (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => mockQueue);
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () => mockIndex);
    (TrackPlayer.getActiveTrack as jest.Mock).mockImplementation(async () => mockQueue[mockIndex]);
    (TrackPlayer.getProgress as jest.Mock).mockImplementation(async () => ({ position: mockPosition, duration: 180 }));
    (TrackPlayer.getRepeatMode as jest.Mock).mockImplementation(async () => mockRepeat);
    (TrackPlayer.setRepeatMode as jest.Mock).mockImplementation(async repeat => { mockRepeat = repeat; });
    (TrackPlayer.reset as jest.Mock).mockImplementation(async () => { mockQueue = []; mockIndex = 0; });
});

it('resets all queues, names, autoplay preferences and listening state permanently', async () => {
    const state = useMultipleQueuesStore.getState();
    for (let id = 0; id < 5; id++) {
        state.rename(id, `Custom ${id}`);
        state.saveSession(id, session(`saved${id}`));
    }
    state.setShuffleOnQueueEnd(true);
    useUIStore.getState().openSheet('queue');
    await MultipleQueuesService.resetAllQueues();
    expect(mockQueue).toEqual([]);
    expect(mockRepeat).toBe(0);
    expect(mockPlayer).toMatchObject({ activeTrack: null, userQueueSize: 0, playbackContext: null, isShuffleEnabled: false });
    expect(useUIStore.getState().activeSheet).toBeNull();
    expect(useQueueSnapshotStore.getState()).toMatchObject({ queue: [], activeIndex: -1 });
    expect(useMultipleQueuesStore.getState()).toMatchObject({ activeId: 0, isSwitching: false });
    expect(mockSeconds.size).toBe(0);
    expect(PlaybackListenService.save).toHaveBeenCalledWith('a-instance', 64, true);
    expect(PlaybackListenService.save).toHaveBeenCalledWith('saved1-instance', 27, true);
    for (let id = 0; id < 5; id++) {
        expect(useMultipleQueuesStore.getState().slots[id]).toMatchObject({ name: '', session: null, shuffleOnQueueEnd: false });
        expect(createMMKV().getString(`@queue_session_${id}`)).toBeUndefined();
        expect(createMMKV().getNumber(`@queue_position_${id}`)).toBeUndefined();
        expect(createMMKV().getNumber(`@queue_accumulated_${id}`)).toBeUndefined();
    }
    expect(createMMKV().getString('@player_persistence')).toBeUndefined();
    await jest.isolateModulesAsync(async () => {
        const restored = await import('../store/useMultipleQueuesStore');
        restored.migrateQueueShuffleOnEnd(true);
        expect(restored.useMultipleQueuesStore.getState().slots.every(slot => !slot.name && !slot.session && slot.shuffleOnQueueEnd === false)).toBe(true);
    });
});

it('unlocks the empty player before slow history writes finish', async () => {
    let finish!: () => void;
    (PlaybackListenService.save as jest.Mock).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const reset = MultipleQueuesService.resetAllQueues();
    for (let i = 0; i < 40; i++) await Promise.resolve();
    expect(useMultipleQueuesStore.getState()).toMatchObject({ activeId: 0, isSwitching: false });
    expect(mockPlayer.activeTrack).toBeNull();
    expect(useQueueSnapshotStore.getState().queue).toEqual([]);
    finish(); await reset;
});

it('does not reset queues during casting or an existing queue operation', async () => {
    mockCast = true;
    await expect(MultipleQueuesService.resetAllQueues()).rejects.toThrow('Local Cast');
    mockCast = false; useMultipleQueuesStore.setState({ pendingEdits: 1 });
    await expect(MultipleQueuesService.resetAllQueues()).rejects.toThrow('unavailable');
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
});

it('keeps saved queues and names when the native reset fails', async () => {
    useMultipleQueuesStore.getState().rename(0, 'Original');
    useMultipleQueuesStore.getState().saveSession(1, session('b'));
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('Reset failed'));
    await expect(MultipleQueuesService.resetAllQueues()).rejects.toThrow('Reset failed');
    expect(mockQueue[0].id).toBe('a-instance');
    expect(useMultipleQueuesStore.getState().slots[0].name).toBe('Original');
    expect(getQueueSession(1)?.queue[0].id).toBe('b-instance');
    expect(useMultipleQueuesStore.getState().isSwitching).toBe(false);
    expect(PlaybackListenService.save).not.toHaveBeenCalled();
});

it('captures the current, manual and context queue with listening time, then restores another paused', async () => {
    useMultipleQueuesStore.getState().saveSession(1, session('b'));
    await MultipleQueuesService.switchQueue(1);
    expect(getQueueSession(0)).toMatchObject({ position: 81, accumulatedTime: 64, userQueueSize: 1, repeatMode: 1, isShuffleEnabled: true });
    expect(getQueueSession(0)?.queue).toHaveLength(3);
    expect(mockPosition).toBe(42);
    expect(mockSeconds.get('b-instance')).toBe(27);
    expect(TrackPlayer.pause).toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(mockRepeat).toBe(2);
    expect(useMultipleQueuesStore.getState().activeId).toBe(1);
    expect(isSuspendedQueueListen('a-instance')).toBe(true);
});

it('returns to the previous queue at its saved position with its own shuffle and repeat', async () => {
    useMultipleQueuesStore.getState().saveSession(1, session('b'));
    await MultipleQueuesService.switchQueue(1); await MultipleQueuesService.switchQueue(0);
    expect(mockQueue.map(track => track.id)).toEqual(['a-instance', 'manual-instance', 'context-instance']);
    expect(mockPosition).toBe(81); expect(mockRepeat).toBe(1); expect(mockPlayer.isShuffleEnabled).toBe(true);
    expect(mockSeconds.get('a-instance')).toBe(64);
});

it('keeps speed and pitch global when selecting a session with older settings', async () => {
    const saved = session('b'); saved.playbackSpeed = 0.75; saved.playbackPitch = 1.5;
    useMultipleQueuesStore.getState().saveSession(1, saved);
    mockPlayer.playbackSpeed = 1.25; mockPlayer.playbackPitch = 1.1;
    await MultipleQueuesService.switchQueue(1);
    expect(mockPlayer.playbackSpeed).toBe(1.25); expect(mockPlayer.playbackPitch).toBe(1.1);
});

it('does not touch native playback or the active queue when appending to an inactive queue', async () => {
    await MultipleQueuesService.addToQueue(2, [{ id: 'c', title: 'C', fileUrl: 'file:///c.mp3' }, { id: 'd', fileUrl: 'file:///d.mp3' }] as any);
    expect(useMultipleQueuesStore.getState().activeId).toBe(0);
    expect(getQueueSession(2)).toMatchObject({ index: 0, position: 0, userQueueSize: 1 });
    expect(mockQueue[0].id).toBe('a-instance');
    expect(TrackPlayer.reset).not.toHaveBeenCalled(); expect(TrackPlayer.add).not.toHaveBeenCalled();
    await MultipleQueuesService.switchQueue(2);
    expect(mockQueue[0].id).toMatch(/^c-/); expect(TrackPlayer.play).not.toHaveBeenCalled();
});

it('inserts new manual items before the inactive context queue', async () => {
    const saved = session('b'); saved.queue.push({ id: 'ctx', url: 'file:///ctx.mp3' });
    useMultipleQueuesStore.getState().saveSession(1, saved);
    await MultipleQueuesService.addToQueue(1, [{ id: 'new', fileUrl: 'file:///new.mp3' }] as any);
    expect(getQueueSession(1)?.queue.map(track => track.id)).toEqual(['b-instance', 'new-instance1', 'ctx']);
    expect(getQueueSession(1)?.userQueueSize).toBe(1);
});

it('blocks queue switching during Local Cast and while a queue is loading', async () => {
    mockCast = true; await expect(MultipleQueuesService.switchQueue(1)).rejects.toThrow('Local Cast');
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
    mockCast = false; mockPlayer.isQueueLoading = true;
    await expect(MultipleQueuesService.switchQueue(1)).rejects.toThrow('loading');
});

it('rolls back to the original paused queue when loading the target fails', async () => {
    useMultipleQueuesStore.getState().saveSession(1, session('b')); mockFailRestore = true;
    await expect(MultipleQueuesService.switchQueue(1)).rejects.toThrow('Native failure');
    expect(useMultipleQueuesStore.getState()).toMatchObject({ activeId: 0, isSwitching: false });
    expect(mockPosition).toBe(81); expect(mockQueue[0].id).toBe('a-instance');
});

it('persists five names and independent timing values', () => {
    const queues = useMultipleQueuesStore.getState(); queues.rename(0, '  Work  '); queues.rename(4, 'Sleep'); queues.saveSession(0, session('a'));
    persistQueueTime(93, 50);
    expect(getQueueSession(0)).toMatchObject({ position: 93, accumulatedTime: 50 });
    const persisted = JSON.parse(createMMKV().getString('@multiple_queues_v1')!);
    expect(persisted.slots).toHaveLength(5); expect(persisted.slots[0].name).toBe('Work'); expect(persisted.slots[4].name).toBe('Sleep');
    useMultipleQueuesStore.setState({ isSwitching: true }); persistQueueTime(0, 0);
    expect(getQueueSession(0)?.position).toBe(93);
});

it('keeps random autoplay independent per queue, including empty queues and after restarting', async () => {
    const state = useMultipleQueuesStore.getState();
    state.setShuffleOnQueueEnd(true);
    await MultipleQueuesService.switchQueue(1);
    expect(selectShuffleOnQueueEnd(useMultipleQueuesStore.getState())).toBe(false);
    state.setShuffleOnQueueEnd(true);
    await MultipleQueuesService.switchQueue(2);
    expect(selectShuffleOnQueueEnd(useMultipleQueuesStore.getState())).toBe(false);
    await MultipleQueuesService.switchQueue(0);
    expect(selectShuffleOnQueueEnd(useMultipleQueuesStore.getState())).toBe(true);
    await jest.isolateModulesAsync(async () => {
        const restored = await import('../store/useMultipleQueuesStore');
        expect(restored.selectShuffleOnQueueEnd(restored.useMultipleQueuesStore.getState())).toBe(true);
        expect(restored.useMultipleQueuesStore.getState().slots[1].shuffleOnQueueEnd).toBe(true);
        expect(restored.useMultipleQueuesStore.getState().slots[2].shuffleOnQueueEnd ?? false).toBe(false);
    });
});

it('passes the destination autoplay preference to restoration without changing the previous queue', async () => {
    const state = useMultipleQueuesStore.getState();
    state.setShuffleOnQueueEnd(true);
    state.saveSession(1, session('b'));
    await MultipleQueuesService.switchQueue(1);
    expect(mockPlayer.restorePlaybackState).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }), false);
    expect(useMultipleQueuesStore.getState().slots[0].shuffleOnQueueEnd).toBe(true);
});

it('migrates the legacy setting to the first queue once and respects subsequently edited choices', () => {
    migrateQueueShuffleOnEnd(true);
    expect(useMultipleQueuesStore.getState().slots.map(slot => slot.shuffleOnQueueEnd)).toEqual([true, false, false, false, false]);
    useMultipleQueuesStore.getState().setShuffleOnQueueEnd(false);
    migrateQueueShuffleOnEnd(true);
    expect(selectShuffleOnQueueEnd(useMultipleQueuesStore.getState())).toBe(false);
});

it('starts an empty destination with no active track and no inherited repeat mode', async () => {
    await MultipleQueuesService.switchQueue(3);
    expect(mockQueue).toEqual([]); expect(mockPlayer.activeTrack).toBeNull(); expect(mockRepeat).toBe(0);
});

it('routes additions to the active queue through the existing queue behavior', async () => {
    const tracks = [{ id: 'c', fileUrl: 'file:///c.mp3' }] as any;
    await MultipleQueuesService.addToQueue(0, tracks);
    expect(mockAddActive).toHaveBeenCalledWith(tracks);
});

it('reloads all five queues, names and positions after a new app session', async () => {
    const state = useMultipleQueuesStore.getState();
    state.rename(1, 'Podcasts'); state.saveSession(1, session('b')); state.select(1);
    persistQueueTime(65, 36);
    await jest.isolateModulesAsync(async () => {
        const restored = await import('../store/useMultipleQueuesStore');
        expect(restored.useMultipleQueuesStore.getState().activeId).toBe(1);
        expect(restored.useMultipleQueuesStore.getState().slots).toHaveLength(5);
        expect(restored.useMultipleQueuesStore.getState().slots[1].name).toBe('Podcasts');
        expect(restored.getQueueSession(1)).toMatchObject({ position: 65, accumulatedTime: 36 });
    });
});

it('saves only the edited session and keeps queue metadata small', () => {
    const storage = createMMKV();
    const state = useMultipleQueuesStore.getState();
    state.saveSession(1, session('b'));
    const inactive = storage.getString('@queue_session_1');
    (storage.set as jest.Mock).mockClear();
    state.saveSession(0, session('a'));
    expect(storage.getString('@queue_session_1')).toBe(inactive);
    expect(storage.set).not.toHaveBeenCalledWith('@queue_session_1', expect.anything());
    expect(JSON.parse(storage.getString('@multiple_queues_v1')!).slots.every((slot: any) => !('session' in slot))).toBe(true);
});

it('does not notify subscribers or write storage when names, sessions or timing have not changed', () => {
    const state = useMultipleQueuesStore.getState();
    const saved = session('a');
    state.saveSession(0, saved); state.rename(0, 'Work');
    const listener = jest.fn();
    const stop = useMultipleQueuesStore.subscribe(listener);
    (createMMKV().set as jest.Mock).mockClear();
    state.select(0); state.rename(0, '  Work  '); state.saveSession(0, { ...saved });
    persistQueueTime(saved.position, saved.accumulatedTime);
    expect(listener).not.toHaveBeenCalled();
    expect(createMMKV().set).not.toHaveBeenCalled();
    stop();
});

it('passes the destination directly from memory and does not recapture or save the installed native queue', async () => {
    const saved = session('b');
    useMultipleQueuesStore.getState().saveSession(1, saved);
    await MultipleQueuesService.switchQueue(1);
    expect(mockPlayer.restorePlaybackState).toHaveBeenCalledWith(saved, false);
    expect(TrackPlayer.getQueue).toHaveBeenCalledTimes(1);
    expect(mockPlayer.savePlaybackState).not.toHaveBeenCalled();
    expect(TrackPlayer.pause).toHaveBeenCalledWith(true);
    expect(TrackPlayer.setRepeatMode).not.toHaveBeenCalled();
    expect(useQueueSnapshotStore.getState()).toMatchObject({ queue: saved.queue, activeIndex: 0 });
    expect(JSON.parse(createMMKV().getString('@player_persistence')!).queue).toEqual(saved.queue);
});

it('unlocks the selector without waiting for a slow Android widget update', async () => {
    useMultipleQueuesStore.getState().saveSession(1, session('b'));
    let finish!: () => void;
    (syncWidgetState as jest.Mock).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await MultipleQueuesService.switchQueue(1);
    expect(useMultipleQueuesStore.getState()).toMatchObject({ activeId: 1, isSwitching: false });
    finish();
});

it('migrates previously saved queues without losing inactive sessions or names', async () => {
    const storage = createMMKV();
    storage.set('@multiple_queues_v1', JSON.stringify({ activeId: 2, slots: [
        { id: 0, name: 'Music', session: session('a') }, { id: 2, name: 'Podcasts', session: session('c') },
    ] }));
    await jest.isolateModulesAsync(async () => {
        const restored = await import('../store/useMultipleQueuesStore');
        expect(restored.useMultipleQueuesStore.getState().activeId).toBe(2);
        expect(restored.useMultipleQueuesStore.getState().slots[0]).toMatchObject({ name: 'Music', session: session('a') });
        expect(restored.useMultipleQueuesStore.getState().slots[2]).toMatchObject({ name: 'Podcasts', session: session('c') });
    });
    expect(JSON.parse(storage.getString('@multiple_queues_v1')!).storageVersion).toBe(2);
    expect(JSON.parse(storage.getString('@queue_session_2')!)).toEqual(session('c'));
});

it('removes deleted tracks from inactive sessions without altering the active native queue', () => {
    const saved = session('b'); saved.queue.push({ id: 'manual-instance', url: 'file:///manual.mp3' }); saved.userQueueSize = 1;
    useMultipleQueuesStore.getState().saveSession(1, saved);
    removeDeletedTracksFromInactiveQueues(['manual']);
    expect(getQueueSession(1)?.userQueueSize).toBe(0); expect(getQueueSession(1)?.queue).toHaveLength(1);
    removeDeletedTracksFromInactiveQueues(['b']); expect(getQueueSession(1)).toBeNull();
    expect(mockQueue[0].id).toBe('a-instance'); expect(TrackPlayer.reset).not.toHaveBeenCalled();
});
