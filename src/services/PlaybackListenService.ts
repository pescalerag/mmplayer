import { database } from '../database';
import Track from '../database/models/Track';
import PlaybackHistory from '../database/models/PlaybackHistory';
import { HistoryService } from './HistoryService';

const records = new Map<string, PlaybackHistory>();
const pending = new Map<string, Promise<void>>();

async function resolveListenDuration(trackId: string, seconds: number) {
  try {
    const track = await database.get<Track>('tracks').find(trackId.split('-')[0]);
    if (track.duration > 0) return { seconds: Math.min(seconds, track.duration), minimum: track.duration * 0.5 };
  } catch { /* Keep the existing threshold for unknown or deleted tracks. */ }
  return { seconds: Math.min(seconds, 600), minimum: 20 };
}

async function persistListen(trackId: string, seconds: number, complete: boolean) {
  const duration = await resolveListenDuration(trackId, seconds);
  const existing = records.get(trackId);
  if (existing || duration.seconds >= duration.minimum) {
    const record = existing
      ? await HistoryService.logToDatabase(trackId, duration.seconds, 'queue', existing)
      : await HistoryService.logToDatabase(trackId, duration.seconds, 'queue');
    if (record) records.set(trackId, record);
  }
  if (complete) records.delete(trackId);
}

export const PlaybackListenService = {
  async save(trackId: string, seconds: number, complete = false): Promise<void> {
    const previous = pending.get(trackId) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(() => persistListen(trackId, seconds, complete));
    pending.set(trackId, operation);
    try { await operation; }
    finally { if (pending.get(trackId) === operation) pending.delete(trackId); }
  },
};
