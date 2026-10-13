import TrackPlayer, { RepeatMode, Track } from 'react-native-track-player';
import { useQueueSnapshotStore, refreshQueueSnapshot } from '../store/useQueueSnapshotStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { database } from '../database';
import TrackModel from '../database/models/Track';

const PREVIEW_LIMIT = 50;
let lastQueue: readonly Track[] | null = null;
let lastKey = '';
let revision = 0;

function queueItem(track: Track, index: number) {
  const id = String(track.id);
  return { id, index, title: track.title ?? '', artist: track.artist ?? '', duration: track.duration ?? 0,
    coverUrl: '/api/queue/cover?index=' + index + '&id=' + encodeURIComponent(id) };
}

interface QueueState {
  readonly queueVersion: string;
  readonly hasNext: boolean;
  readonly shuffleOnQueueEnd: boolean;
  readonly queue?: { readonly version: string; readonly currentIndex: number; readonly remaining: number; readonly items: ReturnType<typeof queueItem>[] };
}

export const LocalCastQueueService = {
  async cover(index: number, id: string, prepare: (id: string, album: { coverUrl: string | null }) => Promise<string | null>): Promise<string | null> {
    if (!Number.isInteger(index) || index < 0) return null;
    const track = useQueueSnapshotStore.getState().queue[index];
    if (!track || String(track.id) !== id) return null;
    const cleanId = id.split('-')[0];
    try {
      let artwork = typeof track.artwork === 'string' ? track.artwork : null;
      if (!artwork) {
        const model = await database.get<TrackModel>('tracks').find(cleanId);
        artwork = (await model.album.fetch())?.coverUrl ?? null;
      }
      const file = await prepare(cleanId, { coverUrl: artwork });
      return file ? '/static/' + encodeURIComponent(file) : null;
    } catch { return null; }
  },
  async read(sessionId: string, previousVersion: string | null, index: number | undefined): Promise<QueueState> {
    if (!useQueueSnapshotStore.getState().ready) await refreshQueueSnapshot();
    const { queue } = useQueueSnapshotStore.getState();
    const repeat = await TrackPlayer.getRepeatMode();
    const shuffle = useSettingsStore.getState().shuffleOnQueueEnd;
    const current = index ?? -1;
    const key = `${sessionId}:${current}:${repeat}:${shuffle}`;
    if (queue !== lastQueue || key !== lastKey) { revision++; lastQueue = queue; lastKey = key; }
    const version = `${sessionId}:${revision}`;
    const hasNext = current >= 0 && queue.length > 0 && (current < queue.length - 1 || repeat !== RepeatMode.Off || shuffle);
    const info = { queueVersion: version, hasNext, shuffleOnQueueEnd: shuffle };
    if (previousVersion === version) return info;
    const start = Math.max(0, current);
    return { ...info, queue: {
      version, currentIndex: current, remaining: Math.max(0, queue.length - current - 1),
      items: queue.slice(start, start + PREVIEW_LIMIT + 1).map((track, offset) => queueItem(track, start + offset)),
    } };
  },
  async validate(sessionId: string, version: string, index: number, id: string): Promise<boolean> {
    if (!Number.isInteger(index) || index < 0) return false;
    const current = await TrackPlayer.getActiveTrackIndex();
    if (current == null) return false;
    const state = await this.read(sessionId, version, current);
    if (state.queueVersion !== version) return false;
    const queue = await TrackPlayer.getQueue();
    const track = queue[index];
    return !!track && String(track.id) === id && index >= current && index <= current + PREVIEW_LIMIT;
  },
  async advance(ended: boolean): Promise<boolean> {
    const index = await TrackPlayer.getActiveTrackIndex();
    if (index == null) return false;
    const repeat = await TrackPlayer.getRepeatMode();
    const before = await TrackPlayer.getTrack(index);
    if (ended && repeat === RepeatMode.Track) { await TrackPlayer.skip(index); return true; }
    const next = await TrackPlayer.getTrack(index + 1);
    if (next) await usePlayerStore.getState().skipToNext();
    else if (repeat !== RepeatMode.Off) { await TrackPlayer.skip(0); return true; }
    else if (useSettingsStore.getState().shuffleOnQueueEnd) await usePlayerStore.getState().playRandomQueueOnEnd();
    else return false;
    const afterIndex = await TrackPlayer.getActiveTrackIndex();
    const after = afterIndex == null ? null : await TrackPlayer.getTrack(afterIndex);
    return !!after && after.id !== before?.id;
  },
};
