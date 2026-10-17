import { initializeCrossfade, CrossfadeService } from '../services/CrossfadeService';
import { setCrossfadeSettings } from '../../modules/native-equalizer';

const mockSettings = { crossfadeSeconds: 0 };
const mockPlayer = { isRestoring: false, isSyncingLyrics: false };
const mockCast = { isServerRunning: false, isLocalCastActive: false, isChromecastConnected: false };
const mockMultiple = { isSwitching: false };
const mockAB: { pointA: number | null; pointB: number | null } = { pointA: null, pointB: null };
jest.mock('../../modules/native-equalizer', () => ({ setCrossfadeSettings: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: {
    getState: () => mockSettings, subscribe: jest.fn(), persist: { onFinishHydration: jest.fn() },
} }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: () => mockPlayer, subscribe: jest.fn() } }));
jest.mock('../store/useCastStore', () => ({ useCastStore: { getState: () => mockCast, subscribe: jest.fn() } }));
jest.mock('../store/useMultipleQueuesStore', () => ({ useMultipleQueuesStore: { getState: () => mockMultiple, subscribe: jest.fn() } }));
jest.mock('../store/useABRepeatStore', () => ({ useABRepeatStore: { getState: () => mockAB, subscribe: jest.fn() } }));

beforeAll(async () => { await initializeCrossfade(); });
beforeEach(async () => {
    mockSettings.crossfadeSeconds = 0;
    mockMultiple.isSwitching = false;
    mockCast.isServerRunning = mockCast.isLocalCastActive = mockCast.isChromecastConnected = false;
    mockPlayer.isRestoring = mockPlayer.isSyncingLyrics = false;
    mockAB.pointA = mockAB.pointB = null;
    await CrossfadeService.flush();
    jest.clearAllMocks();
});

it('applies seconds globally and avoids redundant native commands for metadata updates', async () => {
    mockSettings.crossfadeSeconds = 6;
    await CrossfadeService.flush();
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenCalledTimes(1);
    expect(setCrossfadeSettings).toHaveBeenCalledWith(6, true);
});

it('keeps nested handoff blocks until the final operation is released', async () => {
    mockSettings.crossfadeSeconds = 5;
    const first = await CrossfadeService.block();
    const second = await CrossfadeService.block();
    first(); first();
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenLastCalledWith(5, false);
    second();
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenLastCalledWith(5, true);
});

it('keeps the duration but suspends the effect across Cast, lyrics editing and queue restoration', async () => {
    mockSettings.crossfadeSeconds = 8;
    mockCast.isLocalCastActive = true;
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenLastCalledWith(8, false);
    mockCast.isLocalCastActive = false;
    mockPlayer.isSyncingLyrics = true;
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenLastCalledWith(8, false);
    mockPlayer.isSyncingLyrics = false;
    mockMultiple.isSwitching = true;
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenLastCalledWith(8, false);
    mockMultiple.isSwitching = false;
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenLastCalledWith(8, true);
});

it('turning off the setting leaves allowed true so an existing mix can finish', async () => {
    mockSettings.crossfadeSeconds = 6;
    await CrossfadeService.flush();
    mockSettings.crossfadeSeconds = 0;
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenLastCalledWith(0, true);
});

it('retries configuration after a native failure instead of keeping a stale applied flag', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    (setCrossfadeSettings as jest.Mock).mockRejectedValueOnce(Error('Native unavailable'));
    mockSettings.crossfadeSeconds = 3;
    await expect(CrossfadeService.flush()).rejects.toThrow('Native unavailable');
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenCalledTimes(2);
    error.mockRestore();
});


it('rejects a handoff barrier when the native suspension fails, rather than capturing two active songs', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSettings.crossfadeSeconds = 6;
    await CrossfadeService.flush();
    (setCrossfadeSettings as jest.Mock).mockRejectedValueOnce(Error('Cannot suspend'));
    await expect(CrossfadeService.block()).rejects.toThrow('Cannot suspend');
    await CrossfadeService.flush();
    expect(setCrossfadeSettings).toHaveBeenLastCalledWith(6, true);
    error.mockRestore();
});
