import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { Track } from 'react-native-track-player';

export interface QueueSession {
    queue: Track[];
    index: number;
    position: number;
    accumulatedTime: number;
    userQueueSize: number;
    playbackContext: string | null;
    isShuffleEnabled: boolean;
    shuffleOriginalQueue: Track[];
    repeatMode: number;
    playbackSpeed: number;
    playbackPitch: number;
    isVinylModeEnabled: boolean;
}
export interface QueueSlot { id: number; name: string; session: QueueSession | null; shuffleOnQueueEnd?: boolean; }
const storage = createMMKV();
const KEY = '@multiple_queues_v1';
const sessionKey = (id: number) => `@queue_session_${id}`;
const defaultSlots = (): QueueSlot[] => Array.from({ length: 5 }, (_, id) => ({ id, name: '', session: null }));
function readSession(id: number): QueueSession | null {
    try {
        const session = JSON.parse(storage.getString(sessionKey(id)) || 'null');
        return Array.isArray(session?.queue) ? session : null;
    } catch { return null; }
}
function readSaved() {
    try {
        const saved = JSON.parse(storage.getString(KEY) || 'null');
        if (!saved || !Array.isArray(saved.slots)) return { activeId: 0, slots: defaultSlots() };
        const slots = defaultSlots().map(slot => {
            const old = saved.slots.find((item: QueueSlot) => item.id === slot.id);
            const session = saved.storageVersion === 2 ? readSession(slot.id) : (Array.isArray(old?.session?.queue) ? old.session : null);
            if (saved.storageVersion !== 2) storage.set(sessionKey(slot.id), JSON.stringify(session));
            return { ...slot, name: typeof old?.name === 'string' ? old.name : '', session,
                shuffleOnQueueEnd: typeof old?.shuffleOnQueueEnd === 'boolean' ? old.shuffleOnQueueEnd : undefined };
        });
        const activeId = Number.isInteger(saved.activeId) && saved.activeId >= 0 && saved.activeId < 5 ? saved.activeId : 0;
        if (saved.storageVersion !== 2) persistMetadata(activeId, slots);
        return { activeId, slots };
    } catch { return { activeId: 0, slots: defaultSlots() }; }
}
function persistMetadata(activeId: number, slots: QueueSlot[]) {
    storage.set(KEY, JSON.stringify({ storageVersion: 2, activeId, slots: slots.map(({ id, name, shuffleOnQueueEnd }) => ({ id, name, shuffleOnQueueEnd })) }));
}
function persist() {
    const { activeId, slots } = useMultipleQueuesStore.getState();
    persistMetadata(activeId, slots);
}
export const useMultipleQueuesStore = create<{
    activeId: number; slots: QueueSlot[]; isSwitching: boolean; pendingEdits: number;
    select: (id: number) => void;
    saveSession: (id: number, session: QueueSession | null) => void;
    rename: (id: number, name: string) => void;
    setShuffleOnQueueEnd: (value: boolean) => void;
}>((set, get) => ({
    ...readSaved(), isSwitching: false, pendingEdits: 0,
    select: activeId => {
        if (get().activeId === activeId) return;
        set({ activeId }); persist();
    },
    saveSession: (id, session) => {
        // Serialize only the edited queue; inactive queues can each contain thousands of tracks.
        const serialized = JSON.stringify(session);
        const changed = storage.getString(sessionKey(id)) !== serialized;
        if (changed) {
            storage.set(sessionKey(id), serialized);
        }
        if (changed || Boolean(get().slots[id]?.session) !== Boolean(session)) {
            set(state => ({ slots: state.slots.map(slot => slot.id === id ? { ...slot, session } : slot) }));
        }
        if (session) {
            writeTime(id, session.position, session.accumulatedTime);
        } else {
            storage.remove(`@queue_position_${id}`); storage.remove(`@queue_accumulated_${id}`);
        }
        if (!storage.getString(KEY)) persist();
    },
    rename: (id, name) => {
        const trimmed = name.trim().slice(0, 60);
        if (get().slots[id]?.name === trimmed) return;
        set(state => ({ slots: state.slots.map(slot => slot.id === id ? { ...slot, name: trimmed } : slot) })); persist();
    },
    setShuffleOnQueueEnd: value => {
        const { activeId, slots, isSwitching } = get();
        if (isSwitching || slots[activeId].shuffleOnQueueEnd === value) return;
        set({ slots: slots.map(slot => slot.id === activeId ? { ...slot, shuffleOnQueueEnd: value } : slot) });
        persist();
        void import('./usePlayerStore').then(({ usePlayerStore }) => usePlayerStore.getState().updateQueueStatus()).catch(() => {});
    },
}));

export const selectShuffleOnQueueEnd = (state: { activeId: number; slots: QueueSlot[] }) => state.slots[state.activeId]?.shuffleOnQueueEnd ?? false;

export function migrateQueueShuffleOnEnd(legacyValue: boolean) {
    const { slots } = useMultipleQueuesStore.getState();
    if (slots.every(slot => slot.shuffleOnQueueEnd !== undefined)) return;
    useMultipleQueuesStore.setState({ slots: slots.map(slot => ({ ...slot,
        shuffleOnQueueEnd: slot.shuffleOnQueueEnd ?? (slot.id === 0 && legacyValue),
    })) });
    persist();
}

export function getQueueSession(id: number): QueueSession | null {
    const session = useMultipleQueuesStore.getState().slots[id]?.session;
    return session ? { ...session, position: storage.getNumber(`@queue_position_${id}`) ?? session.position,
        accumulatedTime: storage.getNumber(`@queue_accumulated_${id}`) ?? session.accumulatedTime } : null;
}
export function persistQueueTime(position: number, accumulated: number) {
    const { activeId, isSwitching } = useMultipleQueuesStore.getState();
    if (isSwitching) return;
    writeTime(activeId, position, accumulated);
}
function writeTime(id: number, position: number, accumulated: number) {
    if (storage.getNumber(`@queue_position_${id}`) !== position) storage.set(`@queue_position_${id}`, position);
    if (storage.getNumber(`@queue_accumulated_${id}`) !== accumulated) storage.set(`@queue_accumulated_${id}`, accumulated);
}
export function isSuspendedQueueListen(trackId: string): boolean {
    const { activeId, slots, isSwitching } = useMultipleQueuesStore.getState();
    return isSwitching || slots.some(slot => slot.id !== activeId && slot.session?.queue[slot.session.index]?.id?.toString() === trackId);
}

export function beginActiveQueueEdit(): () => void {
    if (useMultipleQueuesStore.getState().isSwitching) throw new Error('Queue is switching');
    useMultipleQueuesStore.setState(state => ({ pendingEdits: state.pendingEdits + 1 }));
    return () => useMultipleQueuesStore.setState(state => ({ pendingEdits: Math.max(0, state.pendingEdits - 1) }));
}

export function clearAllQueueSessions() {
    const state = useMultipleQueuesStore.getState();
    state.slots.forEach(slot => {
        state.saveSession(slot.id, null);
        storage.remove(`@queue_position_${slot.id}`); storage.remove(`@queue_accumulated_${slot.id}`);
    });
    state.select(0);
}

export function resetAllQueueSlots() {
    const slots = defaultSlots().map(slot => ({ ...slot, shuffleOnQueueEnd: false }));
    for (const slot of slots) {
        storage.remove(sessionKey(slot.id));
        storage.remove(`@queue_position_${slot.id}`);
        storage.remove(`@queue_accumulated_${slot.id}`);
    }
    persistMetadata(0, slots);
    useMultipleQueuesStore.setState({ activeId: 0, slots });
}

export function removeDeletedTracksFromInactiveQueues(trackIds: string[]) {
    if (!trackIds.length) return;
    const deleted = new Set(trackIds);
    const state = useMultipleQueuesStore.getState();
    for (const slot of state.slots) {
        if (slot.id === state.activeId) continue;
        const session = getQueueSession(slot.id);
        if (!session) continue;
        const queue = session.queue.filter(track => !deleted.has(track.id.toString().split('-')[0]));
        if (queue.length === session.queue.length) continue;
        const currentId = session.queue[session.index]?.id;
        const retainedIndex = queue.findIndex(track => track.id === currentId);
        const index = retainedIndex >= 0 ? retainedIndex : Math.min(session.index, queue.length - 1);
        const manualEntries = new Set(session.queue.slice(session.index + 1, session.index + 1 + session.userQueueSize).map(track => track.id));
        state.saveSession(slot.id, queue.length ? { ...session, queue,
            index,
            position: retainedIndex >= 0 ? session.position : 0, accumulatedTime: retainedIndex >= 0 ? session.accumulatedTime : 0,
            userQueueSize: queue.slice(index + 1).filter(track => manualEntries.has(track.id)).length,
            shuffleOriginalQueue: session.shuffleOriginalQueue.filter(track => !deleted.has(track.id.toString().split('-')[0])) } : null);
    }
}
