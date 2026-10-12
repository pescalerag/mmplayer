import { database } from '../database';
import { ScannerService } from '../services/ScannerService';
import { usePlayerStore } from '../store/usePlayerStore';

jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: jest.fn() } }));

describe('scanner tag-history cleanup batching', () => {
  it('keeps sequential batches of 100 and deletes snapshots in the same write without extra queries', async () => {
    const albumIds = Array.from({ length: 201 }, (_, index) => `album-${index}`);
    const writes: any[][] = [];
    let activeWrites = 0;
    let maxActiveWrites = 0;
    const prepare = (kind: string, id: string) => ({ id, prepareDestroyPermanently: () => ({ kind, id }) });
    const albumsQuery = jest.fn((clause?: any) => ({
      unsafeFetchRaw: async () => albumIds.map(id => ({ id })),
      fetch: async () => (clause?.comparison?.right?.values ?? []).map((id: string) => prepare('album', id)),
    }));
    const historyQuery = jest.fn((_type: any, clause: any) => ({
      fetch: async () => clause.comparison.right.values.map((id: string) => prepare('history', `history-${id}`)),
    }));
    const snapshotsQuery = jest.fn((clause: any) => ({
      fetch: async () => {
        expect(activeWrites).toBe(1);
        return clause.comparison.right.values.map((id: string) => prepare('snapshot', `snapshot-${id}`));
      },
    }));
    const empty = { query: () => ({ fetch: async () => [], unsafeFetchRaw: async () => [] }) };
    (database.collections.get as jest.Mock).mockImplementation(table => {
      const collections: Record<string, any> = {
        albums: { query: albumsQuery }, playback_history: { query: historyQuery },
        playback_history_tags: { query: snapshotsQuery },
      };
      return collections[table] ?? empty;
    });
    (database.write as jest.Mock).mockImplementation(async callback => {
      activeWrites++;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      try { return await callback(); } finally { activeWrites--; }
    });
    (database.batch as jest.Mock).mockImplementation(async (...ops) => { writes.push(ops.flat()); });
    (usePlayerStore.getState as jest.Mock).mockReturnValue({ handleDeletedEntities: jest.fn().mockResolvedValue(undefined) });

    await ScannerService.cleanDeletedFiles({ skipFileCheck: true, targetArtistIds: [] });

    expect(maxActiveWrites).toBe(1);
    expect(historyQuery).toHaveBeenCalledTimes(3);
    expect(snapshotsQuery).toHaveBeenCalledTimes(3);
    expect(writes.map(ops => ops.filter(op => op.kind === 'album').length)).toEqual([100, 100, 1]);
    expect(writes.map(ops => ops.filter(op => op.kind === 'history').length)).toEqual([100, 100, 1]);
    expect(writes.map(ops => ops.filter(op => op.kind === 'snapshot').length)).toEqual([100, 100, 1]);
    expect(usePlayerStore.getState().handleDeletedEntities).toHaveBeenCalledWith([], albumIds, []);
  });
});
