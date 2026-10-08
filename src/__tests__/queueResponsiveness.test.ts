import TrackPlayer, { Event, Track } from 'react-native-track-player';
import { QueueActionsService } from '../services/QueueActionsService';
import { usePlayerStore } from '../store/usePlayerStore';
import {
    refreshQueueSnapshot, setQueueSnapshot, subscribeToQueueSnapshot, useQueueSnapshotStore,
} from '../store/useQueueSnapshotStore';

jest.mock('../store/usePlayerStore', () => ({
    usePlayerStore: { getState: jest.fn(), setState: jest.fn() },
}));
jest.mock('react-native-track-player', () => ({
    __esModule: true,
    Event: { PlaybackActiveTrackChanged: 'track-changed' },
    default: {
        getQueue: jest.fn(), getActiveTrackIndex: jest.fn(), addEventListener: jest.fn(),
        skip: jest.fn(), play: jest.fn(), remove: jest.fn(), add: jest.fn(), move: jest.fn(),
    },
}));

const settle = async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve();
};

describe('QueueSheet responsiveness and reconciliation', () => {
    let nativeQueue: Track[];
    let activeId: string;
    let playerState: any;
    let listener: (event: any) => void;
    let removeListener: jest.Mock;
    let stop: (() => void) | undefined;

    const ids = () => useQueueSnapshotStore.getState().queue.map(track => track.id);
    const entry = (id: string) => useQueueSnapshotStore.getState().queue.find(track => track.id === id)!;

    beforeEach(() => {
        jest.clearAllMocks();
        nativeQueue = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id, url: id, isManual: id === 'b' || id === 'c' }));
        activeId = 'a';
        playerState = {
            userQueueSize: 2,
            updateQueueStatus: jest.fn().mockResolvedValue(undefined),
            savePlaybackState: jest.fn().mockResolvedValue(undefined),
            cancelQueueLoading: jest.fn().mockResolvedValue(undefined),
            clearPlayer: jest.fn().mockImplementation(async () => { nativeQueue = []; }),
        };
        (usePlayerStore.getState as jest.Mock).mockReturnValue(playerState);
        (usePlayerStore.setState as jest.Mock).mockImplementation(update => {
            Object.assign(playerState, typeof update === 'function' ? update(playerState) : update);
        });
        (TrackPlayer.getQueue as jest.Mock).mockImplementation(async () => [...nativeQueue]);
        (TrackPlayer.getActiveTrackIndex as jest.Mock).mockImplementation(async () => nativeQueue.findIndex(track => track.id === activeId));
        (TrackPlayer.skip as jest.Mock).mockImplementation(async index => { activeId = nativeQueue[index].id; });
        (TrackPlayer.play as jest.Mock).mockResolvedValue(undefined);
        (TrackPlayer.remove as jest.Mock).mockImplementation(async indices => {
            const positions = Array.isArray(indices) ? indices : [indices];
            for (const index of [...positions].sort((a, b) => b - a)) nativeQueue.splice(index, 1);
        });
        (TrackPlayer.add as jest.Mock).mockImplementation(async (tracks, index) => { nativeQueue.splice(index, 0, ...tracks); });
        (TrackPlayer.move as jest.Mock).mockImplementation(async (from, to) => {
            const [track] = nativeQueue.splice(from, 1);
            nativeQueue.splice(to, 0, track);
        });
        removeListener = jest.fn();
        (TrackPlayer.addEventListener as jest.Mock).mockImplementation((_event, callback) => {
            listener = callback;
            return { remove: removeListener };
        });
        setQueueSnapshot([...nativeQueue], 0);
    });

    afterEach(async () => {
        await settle();
        stop?.();
        stop = undefined;
    });

    it('uses event data immediately and ignores an old initial read on reopening', async () => {
        let resolve!: (queue: Track[]) => void;
        (TrackPlayer.getQueue as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; }));
        stop = subscribeToQueueSnapshot();
        expect(useQueueSnapshotStore.getState().ready).toBe(true);
        listener({ type: Event.PlaybackActiveTrackChanged, track: nativeQueue[2], index: 2 });
        expect(useQueueSnapshotStore.getState().activeIndex).toBe(2);
        resolve([...nativeQueue]);
        await settle();
        expect(useQueueSnapshotStore.getState().activeIndex).toBe(2);
        expect(TrackPlayer.getQueue).toHaveBeenCalledTimes(1);
        stop();
        stop = undefined;
        expect(removeListener).toHaveBeenCalledTimes(1);
    });

    it('shows a selected song before the native skip or persistence finishes', async () => {
        let finishSkip!: () => void;
        (TrackPlayer.skip as jest.Mock).mockImplementationOnce(index => new Promise<void>(done => {
            finishSkip = () => { activeId = nativeQueue[index].id; done(); };
        }));
        playerState.updateQueueStatus.mockReturnValue(new Promise(() => {}));
        playerState.savePlaybackState.mockReturnValue(new Promise(() => {}));
        const first = QueueActionsService.play(entry('c'));
        expect(useQueueSnapshotStore.getState().activeIndex).toBe(2);
        await settle();
        const second = QueueActionsService.play(entry('b'));
        expect(useQueueSnapshotStore.getState().activeIndex).toBe(1);
        finishSkip();
        await Promise.all([first, second]);
        await settle();
        expect(activeId).toBe('b');
        expect(useQueueSnapshotStore.getState().activeIndex).toBe(1);
    });

    it('does not overwrite an instant deletion with a stale bridge read', async () => {
        let resolveRead!: (queue: Track[]) => void;
        let finishRemove!: () => void;
        (TrackPlayer.getQueue as jest.Mock).mockReturnValueOnce(new Promise(done => { resolveRead = done; }));
        const oldRead = refreshQueueSnapshot();
        (TrackPlayer.remove as jest.Mock).mockImplementationOnce(index => new Promise<void>(done => {
            finishRemove = () => { nativeQueue.splice(index, 1); done(); };
        }));
        QueueActionsService.remove(entry('b'), true);
        expect(ids()).toEqual(['a', 'c', 'd']);
        expect(playerState.userQueueSize).toBe(1);
        resolveRead([...nativeQueue]);
        await oldRead;
        expect(ids()).toEqual(['a', 'c', 'd']);
        await settle();
        finishRemove();
        await settle();
        expect(ids()).toEqual(['a', 'c', 'd']);
    });

    it('serializes rapid deletions by identity and restores them instantly in original order', async () => {
        const b = QueueActionsService.remove(entry('b'), true)!;
        const c = QueueActionsService.remove(entry('c'), true)!;
        expect(ids()).toEqual(['a', 'd']);
        const undo = QueueActionsService.undo([b, c]);
        expect(ids()).toEqual(['a', 'b', 'c', 'd']);
        expect(playerState.userQueueSize).toBe(2);
        await undo;
        await settle();
        expect(nativeQueue.map(track => track.id)).toEqual(['a', 'b', 'c', 'd']);
        expect(TrackPlayer.remove).toHaveBeenNthCalledWith(1, 1);
        expect(TrackPlayer.remove).toHaveBeenNthCalledWith(2, 1);
        // One read per native edit plus one reconciliation, instead of rereading each undo entry.
        expect(TrackPlayer.getQueue).toHaveBeenCalledTimes(4);
        expect(playerState.savePlaybackState).toHaveBeenCalledTimes(1);
    });

    it('preserves the playing entry when undo inserts songs before it', async () => {
        const removed = QueueActionsService.remove(entry('b'), true)!;
        await QueueActionsService.play(entry('c'));
        await settle();
        const undo = QueueActionsService.undo([removed]);
        expect(useQueueSnapshotStore.getState().queue[useQueueSnapshotStore.getState().activeIndex].id).toBe('c');
        await undo;
        await settle();
        expect(activeId).toBe('c');
        expect(useQueueSnapshotStore.getState().activeIndex).toBe(2);
    });

    it('reconciles a failed deletion without duplicating it when undo was already pressed', async () => {
        (TrackPlayer.remove as jest.Mock).mockRejectedValueOnce(new Error('Native removal failed'));
        const removed = QueueActionsService.remove(entry('b'), true)!;
        const undo = QueueActionsService.undo([removed]);
        await undo;
        await settle();
        expect(removed.failed).toBe(true);
        expect(TrackPlayer.add).not.toHaveBeenCalled();
        expect(ids()).toEqual(['a', 'b', 'c', 'd']);
        expect(playerState.userQueueSize).toBe(2);
    });

    it('restores the true queue and manual count after undo fails', async () => {
        const removed = QueueActionsService.remove(entry('b'), true)!;
        await settle();
        (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('Native add failed'));
        await QueueActionsService.undo([removed]);
        await settle();
        expect(ids()).toEqual(['a', 'c', 'd']);
        expect(playerState.userQueueSize).toBe(1);
    });

    it('does not duplicate a restored queue entry on a repeated undo', async () => {
        const removed = QueueActionsService.remove(entry('b'), true)!;
        await QueueActionsService.undo([removed]);
        await settle();
        await QueueActionsService.undo([removed]);
        expect(ids()).toEqual(['a', 'b', 'c', 'd']);
        expect(TrackPlayer.add).toHaveBeenCalledTimes(1);
        expect(playerState.userQueueSize).toBe(2);
    });

    it('removes only the requested instance of a duplicated song', async () => {
        nativeQueue[1].id = 'song-instance1';
        nativeQueue[2].id = 'song-instance2';
        setQueueSnapshot([...nativeQueue], 0);
        QueueActionsService.remove(entry('song-instance2'), true);
        await settle();
        expect(ids()).toEqual(['a', 'song-instance1', 'd']);
    });

    it('keeps reorder targets correct after an earlier queued removal', async () => {
        QueueActionsService.remove(entry('b'), true);
        const d = entry('d');
        await QueueActionsService.move(d, entry('c'));
        await settle();
        expect(ids()).toEqual(['a', 'd', 'c']);
        expect(nativeQueue.map(track => track.id)).toEqual(['a', 'd', 'c']);
    });

    it('keeps the playing entry intact when playback advances before a drag finishes', async () => {
        const c = entry('c');
        activeId = 'c';
        setQueueSnapshot([...nativeQueue], 2);
        await QueueActionsService.move(c, entry('d'));
        expect(ids()).toEqual(['a', 'b', 'c', 'd']);
        expect(TrackPlayer.move).not.toHaveBeenCalled();

        const move = QueueActionsService.move(entry('d'), undefined);
        activeId = 'd';
        await move;
        await settle();
        expect(ids()).toEqual(['a', 'b', 'c', 'd']);
        expect(useQueueSnapshotStore.getState().activeIndex).toBe(3);
        expect(TrackPlayer.move).not.toHaveBeenCalled();
    });

    it('clears the manual or context section immediately while keeping the playing entry', async () => {
        const clearManual = QueueActionsService.clear('manual');
        expect(ids()).toEqual(['a', 'd']);
        expect(playerState.userQueueSize).toBe(0);
        await clearManual;
        await settle();
        const clearContext = QueueActionsService.clear('context');
        expect(ids()).toEqual(['a']);
        await clearContext;
        await settle();
        expect(playerState.cancelQueueLoading).toHaveBeenCalledTimes(1);
        expect(nativeQueue.map(track => track.id)).toEqual(['a']);
    });
});
