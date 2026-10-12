import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Track from '../database/models/Track';
import PlaybackHistory from '../database/models/PlaybackHistory';
import { HistoryService } from '../services/HistoryService';
import { PlaybackTagSnapshotService } from '../services/PlaybackTagSnapshotService';

describe('playback tag snapshots', () => {
  const track = { id: 'song', duration: 180, album: { id: 'album' } } as Track;
  let trackTags: { tag: { id: string } }[];
  let albumTags: { tag: { id: string } }[];
  let committed: any[];
  const trackQuery = jest.fn();
  const albumQuery = jest.fn();
  const tagHistoryQuery = jest.fn();
  const prepareHistory = jest.fn();
  const prepareTag = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    trackTags = [{ tag: { id: 'rock' } }, { tag: { id: 'rock' } }];
    albumTags = [{ tag: { id: 'live' } }, { tag: { id: 'rock' } }];
    committed = [];
    trackQuery.mockImplementation(() => ({ fetch: async () => trackTags }));
    albumQuery.mockImplementation(() => ({ fetch: async () => albumTags }));
    prepareHistory.mockImplementation(callback => { const row = { id: 'listen', table: 'playback_history' }; callback(row); return row; });
    prepareTag.mockImplementation(callback => { const row = { table: 'playback_history_tags' }; callback(row); return row; });
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue(track) });
    (database.collections.get as jest.Mock).mockImplementation(table => {
      const collections: Record<string, any> = {
        playback_history: { prepareCreate: prepareHistory },
        playback_history_tags: { prepareCreate: prepareTag, query: tagHistoryQuery },
        track_tags: { query: trackQuery }, album_tags: { query: albumQuery },
      };
      return collections[table];
    });
    (database.write as jest.Mock).mockImplementation(callback => callback());
    (database.batch as jest.Mock).mockImplementation(async (...ops) => { committed.push(...ops.flat()); });
  });
  afterEach(() => jest.restoreAllMocks());

  it('captures the current tags only on saving, with separate song and album scopes in one batch', async () => {
    trackTags = [{ tag: { id: 'new-tag' } }];
    await HistoryService.logToDatabase('song-instance', 200, 'manual');
    expect(database.batch).toHaveBeenCalledTimes(1);
    expect(committed[0]).toMatchObject({ itemId: 'song', durationPlayed: 180, tagsCaptured: true, playContext: 'manual' });
    expect(committed.slice(1)).toEqual([
      { table: 'playback_history_tags', historyId: 'listen', tagId: 'new-tag', scope: 'track' },
      { table: 'playback_history_tags', historyId: 'listen', tagId: 'live', scope: 'album' },
      { table: 'playback_history_tags', historyId: 'listen', tagId: 'rock', scope: 'album' },
    ]);
    trackTags = [];
    albumTags = [];
    expect(committed[1].tagId).toBe('new-tag');
    expect(trackQuery).toHaveBeenCalledWith(Q.where('track_id', 'song'));
    expect(albumQuery).toHaveBeenCalledWith(Q.where('album_id', 'album'));
  });

  it('updates the saved duration without creating another playback or changing its tag snapshot', async () => {
    const existing = { id: 'saved', durationPlayed: 100, playedAt: new Date(2026, 9, 12), tagsCaptured: true };
    const update = jest.fn(async callback => { callback(existing); });
    const model = { ...existing, update } as unknown as PlaybackHistory;
    const result = await HistoryService.logToDatabase('song-instance', 140, 'queue', model);
    expect(result).toBe(model);
    expect(existing).toMatchObject({ durationPlayed: 140, playedAt: new Date(2026, 9, 12), tagsCaptured: true });
    expect(trackQuery).not.toHaveBeenCalled();
    expect(albumQuery).not.toHaveBeenCalled();
    expect(prepareHistory).not.toHaveBeenCalled();
    expect(database.batch).not.toHaveBeenCalled();
    await HistoryService.logToDatabase('song-instance', 90, 'queue', model);
    expect(existing.durationPlayed).toBe(140);
  });

  it('can update a checkpoint whose saved duration is missing', async () => {
    const row = { durationPlayed: null as number | null };
    const model = { update: jest.fn(async callback => { callback(row); }) } as unknown as PlaybackHistory;
    await HistoryService.logToDatabase('song', 100, 'queue', model);
    expect(row.durationPlayed).toBe(100);
  });

  it('deduplicates each scope while allowing the same tag to credit both independently', async () => {
    await HistoryService.logToDatabase('song', 60);
    expect(committed.filter(row => row.tagId === 'rock')).toHaveLength(2);
    expect(committed[0].playContext).toBe('queue');
  });

  it('does not capture tags or write rows for a discarded listen', async () => {
    await HistoryService.logToDatabase('song', 9);
    expect(database.write).not.toHaveBeenCalled();
    expect(trackQuery).not.toHaveBeenCalled();
    expect(database.batch).not.toHaveBeenCalled();
  });

  it('distinguishes a captured listen with no tags from legacy history', async () => {
    trackTags = [];
    albumTags = [];
    await HistoryService.logToDatabase('song', 60);
    expect(committed).toHaveLength(1);
    expect(committed[0].tagsCaptured).toBe(true);
    expect(prepareTag).not.toHaveBeenCalled();
  });

  it('supports a song without an album', async () => {
    const snapshot = await PlaybackTagSnapshotService.capture({ ...track, album: { id: null } } as Track);
    expect(snapshot).toEqual({ track: ['rock'], album: [] });
    expect(albumQuery).not.toHaveBeenCalled();
  });

  it('preserves the existing history fallback for a missing track, marking the snapshot unknown', async () => {
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockRejectedValue(new Error('deleted')) });
    await HistoryService.logToDatabase('song', 900);
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({ durationPlayed: 600, tagsCaptured: false });
    expect(trackQuery).not.toHaveBeenCalled();
  });

  it('retains the duration fallback for a track without a known duration', async () => {
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ ...track, duration: 0 }) });
    await HistoryService.logToDatabase('song', 900);
    expect(committed[0].durationPlayed).toBe(600);
  });

  it('does not persist a partial snapshot when batch writing fails', async () => {
    (database.batch as jest.Mock).mockRejectedValueOnce(new Error('write failed'));
    await HistoryService.logToDatabase('song', 60);
    expect(committed).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('does not prepare a history row when reading tag assignments fails', async () => {
    trackQuery.mockReturnValueOnce({ fetch: jest.fn().mockRejectedValue(new Error('tag query failed')) });
    await HistoryService.logToDatabase('song', 60);
    expect(prepareHistory).not.toHaveBeenCalled();
    expect(committed).toEqual([]);
  });

  it('removes tag snapshots together with their history, without a query for an empty deletion', async () => {
    expect(await PlaybackTagSnapshotService.prepareHistoryDeletion([])).toEqual([]);
    expect(tagHistoryQuery).not.toHaveBeenCalled();
    const tagOp = { id: 'delete-tag' };
    const historyOp = { id: 'delete-history' };
    tagHistoryQuery.mockReturnValue({ fetch: jest.fn().mockResolvedValue([{ prepareDestroyPermanently: () => tagOp }]) });
    const ops = await PlaybackTagSnapshotService.prepareHistoryDeletion([{ id: 'listen', prepareDestroyPermanently: () => historyOp }] as any);
    expect(tagHistoryQuery).toHaveBeenCalledWith(Q.where('history_id', Q.oneOf(['listen'])));
    expect(ops).toEqual([tagOp, historyOp]);
  });
});
