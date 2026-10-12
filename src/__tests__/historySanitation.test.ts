import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { HistoryService } from '../services/HistoryService';

describe('corrupted-history sanitation with tag snapshots', () => {
  const query = jest.fn();
  const snapshotQuery = jest.fn();
  const find = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (database.get as jest.Mock).mockReturnValue({ find });
    (database.collections.get as jest.Mock).mockImplementation(table => table === 'playback_history' ? { query } : { query: snapshotQuery });
    (database.write as jest.Mock).mockImplementation(callback => callback());
    (database.batch as jest.Mock).mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('repairs existing tracks and deletes missing-track history with its snapshots in one flat batch', async () => {
    const original = { durationPlayed: 9000, tagsCaptured: true, playedAt: new Date(2026, 9, 12) };
    let repaired: typeof original | undefined;
    const updateOp = { id: 'repair-history' };
    const historyDeleteOp = { id: 'delete-history' };
    const snapshotDeleteOp = { id: 'delete-snapshot' };
    query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([
      { id: 'valid-listen', itemId: 'existing-track', prepareUpdate: (update: (row: typeof original) => void) => { repaired = { ...original }; update(repaired); return updateOp; } },
      { id: 'missing-listen', itemId: 'missing-track', prepareDestroyPermanently: () => historyDeleteOp },
    ]) });
    find.mockImplementation(id => id === 'existing-track' ? Promise.resolve({ duration: 180.9 }) : Promise.reject(new Error('track removed')));
    snapshotQuery.mockReturnValue({ fetch: jest.fn().mockResolvedValue([{ prepareDestroyPermanently: () => snapshotDeleteOp }]) });

    await HistoryService.sanitizeCorruptedHistory();

    expect(query).toHaveBeenCalledWith(Q.where('duration_played', Q.gt(7200)));
    expect(repaired).toEqual({ ...original, durationPlayed: 180 });
    expect(snapshotQuery).toHaveBeenCalledWith(Q.where('history_id', Q.oneOf(['missing-listen'])));
    expect(database.batch).toHaveBeenCalledTimes(1);
    expect(database.batch).toHaveBeenCalledWith(updateOp, snapshotDeleteOp, historyDeleteOp);
  });

  it('repairs an unknown duration with the existing fallback and retains snapshot attribution', async () => {
    const row = { durationPlayed: 9000, tagsCaptured: true };
    const updateOp = { id: 'update-history' };
    query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([
      { itemId: 'track', prepareUpdate: (update: (value: typeof row) => void) => { update(row); return updateOp; } },
    ]) });
    find.mockResolvedValue({ duration: 0 });
    await HistoryService.sanitizeCorruptedHistory();
    expect(row).toEqual({ durationPlayed: 300, tagsCaptured: true });
    expect(snapshotQuery).not.toHaveBeenCalled();
    expect(database.batch).toHaveBeenCalledWith(updateOp);
  });

  it('does not issue writes or snapshot queries when no history needs sanitation', async () => {
    query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });
    await HistoryService.sanitizeCorruptedHistory();
    expect(database.write).not.toHaveBeenCalled();
    expect(snapshotQuery).not.toHaveBeenCalled();
    expect(database.batch).not.toHaveBeenCalled();
  });

  it('keeps history untouched if snapshot cleanup cannot be prepared', async () => {
    query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([{ id: 'listen', itemId: 'removed-track' }]) });
    find.mockRejectedValue(new Error('track removed'));
    snapshotQuery.mockReturnValue({ fetch: jest.fn().mockRejectedValue(new Error('snapshots unavailable')) });
    await HistoryService.sanitizeCorruptedHistory();
    expect(database.batch).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });
});
