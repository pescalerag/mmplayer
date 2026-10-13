import { PlaybackListenService } from '../services/PlaybackListenService';
import { HistoryService } from '../services/HistoryService';
import PlaybackHistory from '../database/models/PlaybackHistory';
import { database } from '../database';

describe('playback listen checkpoints', () => {
  const record = { id: 'listen' } as PlaybackHistory;
  let save: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ duration: 180 }) });
    save = jest.spyOn(HistoryService, 'logToDatabase').mockResolvedValue(record);
  });
  afterEach(() => jest.restoreAllMocks());

  it('creates a checkpoint on disconnect and updates the same listen until the song finishes', async () => {
    await PlaybackListenService.save('continue-instance', 100);
    await PlaybackListenService.save('continue-instance', 130);
    await PlaybackListenService.save('continue-instance', 180, true);
    expect(save.mock.calls).toEqual([
      ['continue-instance', 100, 'queue'],
      ['continue-instance', 130, 'queue', record],
      ['continue-instance', 180, 'queue', record],
    ]);
    await PlaybackListenService.save('continue-instance', 100, true);
    expect(save).toHaveBeenLastCalledWith('continue-instance', 100, 'queue');
  });

  it('keeps a short listen eligible for continuation without creating an early record', async () => {
    await PlaybackListenService.save('short-instance', 30);
    expect(save).not.toHaveBeenCalled();
    await PlaybackListenService.save('short-instance', 100, true);
    expect(save).toHaveBeenCalledWith('short-instance', 100, 'queue');
  });

  it.each([[0, 650, 600], [-1, 30, 30], [180, 300, 180]])('retains duration caps and unknown-track fallback (%s)', async (duration, seconds, capped) => {
    const find = duration < 0 ? jest.fn().mockRejectedValue(new Error('deleted')) : jest.fn().mockResolvedValue({ duration });
    (database.get as jest.Mock).mockReturnValue({ find });
    await PlaybackListenService.save(`fallback${duration}`, seconds, true);
    expect(save).toHaveBeenCalledWith(`fallback${duration}`, capped, 'queue');
  });

  it('does not remember a failed creation and retries it on the next checkpoint', async () => {
    save.mockResolvedValueOnce(undefined);
    await PlaybackListenService.save('retry', 100);
    await PlaybackListenService.save('retry', 120, true);
    expect(save.mock.calls).toEqual([['retry', 100, 'queue'], ['retry', 120, 'queue']]);
  });

  it('serializes simultaneous checkpoints so only one history row is created', async () => {
    let finish!: (record: PlaybackHistory) => void;
    save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = PlaybackListenService.save('concurrent', 100);
    const second = PlaybackListenService.save('concurrent', 110, true);
    for (let step = 0; step < 8; step++) await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    finish(record);
    await Promise.all([first, second]);
    expect(save).toHaveBeenLastCalledWith('concurrent', 110, 'queue', record);
  });

  it('allows another checkpoint after a rejected write', async () => {
    save.mockRejectedValueOnce(new Error('write failed'));
    const first = PlaybackListenService.save('rejected', 100);
    const second = PlaybackListenService.save('rejected', 110, true);
    await expect(first).rejects.toThrow('write failed');
    await second;
    expect(save).toHaveBeenLastCalledWith('rejected', 110, 'queue');
  });
});
