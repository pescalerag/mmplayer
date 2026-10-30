import { create } from "zustand";
import { player } from "../player";
import { useSettingsStore } from "../../../../../src/store/useSettingsStore";

function mapSlots() {
  const snap = player.getSnapshot();
  return snap.queues.map((q, id) => ({
    id,
    name: q.name,
    session: null,
    shuffleOnQueueEnd: q.shuffleOnEnd,
  }));
}

export const useMultipleQueuesStore = create<any>((set) => ({
  activeId: player.getSnapshot().activeQueue,
  isSwitching: false,
  pendingEdits: 0,
  queues: player.getSnapshot().queues,
  slots: mapSlots(),
  select: (id: number) => player.switchQueue(id),
  rename: (id: number, name: string) => {
    player.renameQueueAt(id, name);
    set({ slots: mapSlots(), queues: player.getSnapshot().queues });
  },
  setShuffleOnQueueEnd: (value: boolean) => {
    player.setShuffleOnEnd(value);
    set({ slots: mapSlots(), queues: player.getSnapshot().queues });
  },
}));

export const selectShuffleOnQueueEnd = (state?: any) => {
  const snap = player.getSnapshot();
  const activeQueue = snap.queues[snap.activeQueue];
  if (state?.slots && Array.isArray(state.slots)) {
    const slot = state.slots.find((s: any) => s.id === state.activeId);
    if (typeof slot?.shuffleOnQueueEnd === "boolean")
      return slot.shuffleOnQueueEnd;
  }
  return activeQueue?.shuffleOnEnd ?? false;
};

export function migrateQueueShuffleOnEnd(_legacyValue?: boolean) {}

export const MultipleQueuesService = {
  async resetAllQueues() {
    await player.resetAllQueues();
  },
  async switchQueue(targetId: number) {
    player.switchQueue(targetId);
  },
  async addToQueue(targetId: number, tracks: any[]) {
    const snapshot = await window.mmplayer.invoke("library", undefined);
    player.setTracks(snapshot.tracks);
    const indexed = new Map(snapshot.tracks.map((track) => [track.id, track]));
    const resolved = tracks.flatMap((track) =>
      indexed.has(track.id) ? [indexed.get(track.id)!] : [],
    );
    const { queueAddBehavior } = useSettingsStore.getState();
    player.add(
      resolved,
      queueAddBehavior === "user_queue" ? "after-manual" : "context",
      targetId,
    );
  },
};

player.subscribe(() => {
  const snap = player.getSnapshot();
  useMultipleQueuesStore.setState({
    activeId: snap.activeQueue,
    queues: snap.queues,
    slots: mapSlots(),
  });
});

export async function clearAllQueueSessions() { await player.resetAllQueues(); }
