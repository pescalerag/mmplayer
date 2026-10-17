jest.mock('../services/trackPlayerSetup', () => ({ setupPlayer: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/EqualizerService', () => ({ EqualizerService: { subscribeToPlayback: jest.fn() } }));
jest.mock('../services/TimestampService', () => ({ TimestampService: { initialize: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: () => ({ restorePlaybackState: mockRestore }) } }));
const mockRestore = jest.fn().mockResolvedValue(undefined);
let mockHydrated = true;
let mockHydrate: () => void;
const mockUnsubscribe = jest.fn();
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: { persist: {
    hasHydrated: () => mockHydrated,
    onFinishHydration: (callback: () => void) => { mockHydrate = callback; return mockUnsubscribe; },
} } }));

beforeEach(() => { jest.resetModules(); jest.clearAllMocks(); mockHydrated = true; });

it('shares initialization between the UI and a cold-start car request', async () => {
    const { ensurePlaybackReady } = require('../services/playerBootstrap');
    const { setupPlayer } = require('../services/trackPlayerSetup');
    const { EqualizerService } = require('../services/EqualizerService');
    const first = ensurePlaybackReady();
    expect(ensurePlaybackReady()).toBe(first);
    await first;
    await ensurePlaybackReady();
    expect(setupPlayer).toHaveBeenCalledTimes(1);
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(EqualizerService.subscribeToPlayback).toHaveBeenCalledTimes(1);
    expect(require('../services/TimestampService').TimestampService.initialize).toHaveBeenCalledTimes(1);
});

it('waits for saved settings before setting up or restoring audio', async () => {
    mockHydrated = false;
    const { ensurePlaybackReady } = require('../services/playerBootstrap');
    const { setupPlayer } = require('../services/trackPlayerSetup');
    const pending = ensurePlaybackReady();
    expect(setupPlayer).not.toHaveBeenCalled();
    mockHydrated = true;
    mockHydrate();
    await pending;
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockRestore).toHaveBeenCalledTimes(1);
});

it('allows a retry after initialization fails', async () => {
    const { ensurePlaybackReady } = require('../services/playerBootstrap');
    const { setupPlayer } = require('../services/trackPlayerSetup');
    setupPlayer.mockRejectedValueOnce(new Error('not ready'));
    await expect(ensurePlaybackReady()).rejects.toThrow('not ready');
    await ensurePlaybackReady();
    expect(setupPlayer).toHaveBeenCalledTimes(2);
    expect(mockRestore).toHaveBeenCalledTimes(1);
});
