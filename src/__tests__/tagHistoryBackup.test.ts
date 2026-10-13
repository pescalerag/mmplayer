import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { database } from '../database';
import { mySchema } from '../database/schema';
import { BackupService } from '../services/BackupService';
import { useBackupStore } from '../store/useBackupStore';
import { usePlayerStore } from '../store/usePlayerStore';

jest.mock('react-native-restart', () => ({ restart: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn(), copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/ScannerService', () => ({ ScannerService: { cleanDeletedFiles: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../store/useBackupStore', () => ({ useBackupStore: { getState: jest.fn() } }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: jest.fn(), setState: jest.fn() } }));

describe('tag snapshot backups', () => {
  let rows: Record<string, any[]>;
  let restored: { table: string; _raw: any }[];
  const history = { id: 'listen', item_id: 'song', item_type: 'track', duration_played: 120, played_at: 1791800000000, tags_captured: true };
  const snapshot = { id: 'snapshot', history_id: 'listen', tag_id: 'rock', scope: 'track' };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    rows = { playback_history: [history], playback_history_tags: [snapshot] };
    restored = [];
    (useBackupStore.getState as jest.Mock).mockReturnValue({ startExport: jest.fn(), startImport: jest.fn(), setReconciling: jest.fn(), setSuccess: jest.fn(), setError: jest.fn() });
    (usePlayerStore.getState as jest.Mock).mockReturnValue({ clearPlayer: jest.fn().mockResolvedValue(undefined), saveRecentsState: jest.fn().mockResolvedValue(undefined) });
    (database.collections.get as jest.Mock).mockImplementation(table => ({
      query: () => ({ fetch: async () => (rows[table] ?? []).map(_raw => ({ _raw })) }),
      prepareCreate: (callback: (record: any) => void) => {
        const record = { table, _raw: table === 'playback_history' ? { tags_captured: null } : {} };
        callback(record);
        return record;
      },
    }));
    (database.write as jest.Mock).mockImplementation(callback => callback());
    (database as any).unsafeResetDatabase = jest.fn().mockResolvedValue(undefined);
    (database.batch as jest.Mock).mockImplementation(async (...ops) => { restored.push(...ops.flat()); });
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///backup.json' }] });
  });
  afterEach(() => jest.useRealTimers());

  it('exports and restores the exact snapshot independently of current track tags', async () => {
    await BackupService.exportDatabase();
    const exported = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1];
    const parsed = JSON.parse(exported);
    expect(parsed.playback_history_tags).toEqual([snapshot]);
    expect(parsed.playback_history[0].tags_captured).toBe(true);
    rows.track_tags = [{ track_id: 'song', tag_id: 'different-tag' }];
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(exported);
    await BackupService.importDatabase();
    expect(restored.find(row => row.table === 'playback_history_tags')?._raw).toMatchObject(snapshot);
    expect(restored.find(row => row.table === 'playback_history')?._raw).toMatchObject(history);
    expect(useBackupStore.getState().setError).not.toHaveBeenCalled();
  });

  it('restores old backups without inventing historical tags', async () => {
    const { tags_captured: _captured, ...legacy } = history;
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify({ playback_history: [legacy], track_tags: [{ track_id: 'song', tag_id: 'rock' }] }));
    await BackupService.importDatabase();
    expect(restored.find(row => row.table === 'playback_history')?._raw.tags_captured).toBeNull();
    expect(restored.filter(row => row.table === 'playback_history_tags')).toEqual([]);
    expect(useBackupStore.getState().setError).not.toHaveBeenCalled();
  });

  it('exports every schema table and restores notifications with read state, dates and actions intact', async () => {
    const unread = {
      id: 'notification-unread', _status: 'created', _changed: '', type: 'summary_weekly',
      title: 'Tu resumen semanal', description: 'Resumen de escuchas',
      created_at: 1791800000000, is_read: false, action_type: 'navigate',
      action_payload: JSON.stringify({ screen: 'Activity', period: 'week' }),
    };
    const read = {
      id: 'notification-read', _status: 'created', _changed: '', type: 'songs_added',
      title: 'Canciones añadidas', description: null, created_at: 1791800001000,
      is_read: true, action_type: null, action_payload: null,
    };
    rows = Object.fromEntries(Object.keys(mySchema.tables).map(table => [table, []]));
    rows.playback_history = [history];
    rows.playback_history_tags = [snapshot];
    rows.notifications = [unread, read];
    await BackupService.exportDatabase();
    const exported = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1];
    const parsed = JSON.parse(exported);
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(mySchema.tables).sort());
    expect(parsed).toEqual(rows);
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(exported);
    await BackupService.importDatabase();
    expect(restored.filter(row => row.table === 'notifications').map(row => row._raw)).toEqual([unread, read]);
    expect(useBackupStore.getState().setError).not.toHaveBeenCalled();
  });

  it('accepts older backups that have no notifications table', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify({ tracks: [], playback_history: [history] }));
    await BackupService.importDatabase();
    expect(restored.filter(row => row.table === 'notifications')).toEqual([]);
    expect(useBackupStore.getState().setError).not.toHaveBeenCalled();
    expect(useBackupStore.getState().setSuccess).toHaveBeenCalled();
  });

  it('opens the picker before touching playback or the database and copies a provider URI once', async () => {
    let select!: (result: any) => void;
    (DocumentPicker.getDocumentAsync as jest.Mock).mockReturnValueOnce(new Promise(resolve => { select = resolve; }));
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(rows));
    const importing = BackupService.importDatabase();
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({ type: 'application/json', copyToCacheDirectory: false });
    expect(usePlayerStore.getState().clearPlayer).not.toHaveBeenCalled();
    expect(database.write).not.toHaveBeenCalled();
    select({ canceled: false, assets: [{ uri: 'content://provider/backup', name: 'backup.json' }] });
    await importing;
    expect(FileSystem.copyAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({ from: 'content://provider/backup', to: 'file:///cache/import_backup_tmp.json' });
    expect(useBackupStore.getState().setError).not.toHaveBeenCalled();
  });

  it('does not stop playback or modify the database when the picker is canceled', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: null });
    await BackupService.importDatabase();
    expect(usePlayerStore.getState().clearPlayer).not.toHaveBeenCalled();
    expect(database.write).not.toHaveBeenCalled();
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  });
});
