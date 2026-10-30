import { database } from '../database';
import { createPlaybackTagSnapshotService, type TagSnapshot } from '../../packages/data/src/history';

export type { TagSnapshot };
export const PlaybackTagSnapshotService = createPlaybackTagSnapshotService(database);
