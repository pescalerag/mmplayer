jest.mock('../services/CrossfadeService', () => ({ initializeCrossfade: jest.fn().mockResolvedValue(undefined) }));
import { Platform } from 'react-native';
import TrackPlayer, { Capability, RepeatMode } from 'react-native-track-player';
import { initializeReplayGain } from '../services/ReplayGainService';
import { setupPlayer } from '../services/trackPlayerSetup';

jest.mock('../services/ReplayGainService', () => ({ initializeReplayGain: jest.fn().mockResolvedValue(undefined) }));
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  Capability: { Play: 'play', Pause: 'pause', SkipToNext: 'next', SkipToPrevious: 'previous', SeekTo: 'seek', PlayFromSearch: 'search', Like: 'like' },
  RepeatMode: { Off: 'off' },
  AppKilledPlaybackBehavior: { StopPlaybackAndRemoveNotification: 'stop' },
  default: { getActiveTrack: jest.fn(), setupPlayer: jest.fn().mockResolvedValue(undefined), updateOptions: jest.fn().mockResolvedValue(undefined), setRepeatMode: jest.fn().mockResolvedValue(undefined) },
}));

beforeEach(() => { jest.clearAllMocks(); });

it.each(['android', 'ios'] as const)('configures an existing player on %s without recreating it', async os => {
  const previous = Platform.OS; Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  try {
    (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'song' });
    expect(await setupPlayer()).toBe(true);
    expect(initializeReplayGain).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.setupPlayer).not.toHaveBeenCalled();
    const options = (TrackPlayer.updateOptions as jest.Mock).mock.calls[0][0];
    expect(options.capabilities.includes(Capability.Like)).toBe(os === 'android');
    expect(options.notificationCapabilities.includes(Capability.Like)).toBe(os === 'android');
    expect(TrackPlayer.setRepeatMode).toHaveBeenCalledWith(RepeatMode.Off);
  } finally { Object.defineProperty(Platform, 'OS', { value: previous, configurable: true }); }
});

it('initializes a missing player after normalization and configures interruptions', async () => {
  (TrackPlayer.getActiveTrack as jest.Mock).mockRejectedValueOnce(new Error('Not initialized'));
  expect(await setupPlayer()).toBe(true);
  expect(TrackPlayer.setupPlayer).toHaveBeenCalledWith({ autoHandleInterruptions: true });
  expect((initializeReplayGain as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((TrackPlayer.setupPlayer as jest.Mock).mock.invocationCallOrder[0]);
});
