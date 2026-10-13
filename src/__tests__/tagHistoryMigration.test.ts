import { mySchema } from '../database/schema';
import { myMigrations } from '../database/migrations';
import PlaybackHistory from '../database/models/PlaybackHistory';
import PlaybackHistoryTag from '../database/models/PlaybackHistoryTag';

jest.unmock('../database');
jest.mock('@nozbe/watermelondb', () => ({
  ...jest.requireActual('@nozbe/watermelondb'), Database: jest.fn(options => options),
}));
jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@nozbe/watermelondb/adapters/lokijs', () => ({ __esModule: true, default: jest.fn() }));

describe('tag history schema upgrade', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['android', 'web'])('configures migrations and snapshot models on %s', platform => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.isolateModules(() => {
      const { Platform } = jest.requireMock('react-native');
      Platform.OS = platform;
      const configured = jest.requireActual('../database').database;
      const adapterPath = platform === 'web' ? '@nozbe/watermelondb/adapters/lokijs' : '@nozbe/watermelondb/adapters/sqlite';
      const Adapter = jest.requireMock(adapterPath).default;
      const options = Adapter.mock.calls.at(-1)[0];
      expect(options.schema.version).toBe(mySchema.version);
      expect(options.migrations.maxVersion).toBe(mySchema.version);
      expect(configured.modelClasses.map((model: { table: string }) => model.table)).toContain('playback_history_tags');
      options.onSetUpError(new Error('failed to initialize'));
      expect(console.error).toHaveBeenCalled();
    });
  });
  it('upgrades v19 additively without replacing legacy playback history', () => {
    expect(mySchema.version).toBeGreaterThanOrEqual(20);
    const migration = myMigrations.sortedMigrations.find(item => item.toVersion === 20)!;
    expect(migration.steps).toHaveLength(2);
    expect(migration.steps[0]).toMatchObject({ type: 'add_columns', table: 'playback_history', columns: [{ name: 'tags_captured', type: 'boolean', isOptional: true }] });
    expect(migration.steps[1]).toMatchObject({ type: 'create_table', schema: { name: 'playback_history_tags' } });
    const history = mySchema.tables.playback_history;
    expect(history.columns.tags_captured.isOptional).toBe(true);
    expect(history.columns.played_at.isIndexed).toBe(true);
  });

  it('indexes snapshots for scope queries and binds them to the history model', () => {
    const snapshot = mySchema.tables.playback_history_tags;
    expect(snapshot.columns.history_id.isIndexed).toBe(true);
    expect(snapshot.columns.tag_id.isIndexed).toBe(true);
    expect(snapshot.columns.scope.isIndexed).toBe(true);
    expect(PlaybackHistory.associations.playback_history_tags).toEqual({ type: 'has_many', foreignKey: 'history_id' });
    expect(PlaybackHistoryTag.table).toBe('playback_history_tags');
  });
});
