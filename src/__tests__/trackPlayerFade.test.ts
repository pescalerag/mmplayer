import TrackPlayer, { State } from 'react-native-track-player';
import { getIsFadingOut, setIsFadingOut } from '../hooks/usePlaybackState';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  State: { Playing: 'playing', Paused: 'paused', Buffering: 'buffering' },
  default: {
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    setVolume: jest.fn().mockResolvedValue(undefined),
    getPlaybackState: jest.fn(),
    seekTo: jest.fn(),
    getProgress: jest.fn(),
    skipToNext: jest.fn().mockResolvedValue(undefined),
    skipToPrevious: jest.fn().mockResolvedValue(undefined),
    updateNowPlayingMetadata: jest.fn(),
  },
}));
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: { getState: () => ({ isFadeEnabled: true }) } }));
jest.mock('react-native-background-timer', () => ({
  __esModule: true,
  default: {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
    clearInterval: (timer: ReturnType<typeof setInterval>) => clearInterval(timer),
  },
}));

const nativePlay = TrackPlayer.play as jest.Mock;
const nativePause = TrackPlayer.pause as jest.Mock;
const nativeVolume = TrackPlayer.setVolume as jest.Mock;
const nativeState = TrackPlayer.getPlaybackState as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../services/TrackPlayerFade');

describe('v2.3.2 playback transport', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await TrackPlayer.reset();
    nativeState.mockResolvedValue({ state: State.Playing });
  });
  afterEach(async () => {
    await TrackPlayer.reset();
    setIsFadingOut(false);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('fades out before native pause and keeps the logical paused state during the fade', async () => {
    await TrackPlayer.pause();
    expect(getIsFadingOut()).toBe(true);
    expect(await TrackPlayer.getPlaybackState()).toEqual({ state: State.Paused });
    await jest.advanceTimersByTimeAsync(375);
    expect(nativePause).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(25);
    expect(nativePause).toHaveBeenCalledTimes(1);
    expect(nativeVolume).toHaveBeenLastCalledWith(0);
    nativeState.mockResolvedValue({ state: State.Paused });
    await TrackPlayer.getPlaybackState();
    expect(getIsFadingOut()).toBe(false);
    expect(TrackPlayer.updateNowPlayingMetadata).not.toHaveBeenCalled();
  });

  it('starts native playback before fading volume back in', async () => {
    nativeState.mockResolvedValue({ state: State.Paused });
    await TrackPlayer.play();
    expect(nativePlay).toHaveBeenCalledTimes(1);
    expect(nativeVolume).toHaveBeenLastCalledWith(0);
    await jest.advanceTimersByTimeAsync(400);
    expect(nativeVolume).toHaveBeenLastCalledWith(1);
  });

  it('cancels the pause fade when play is pressed before it finishes', async () => {
    await TrackPlayer.pause();
    await jest.advanceTimersByTimeAsync(200);
    await TrackPlayer.play();
    await jest.advanceTimersByTimeAsync(500);
    expect(nativePlay).toHaveBeenCalledTimes(1);
    expect(nativePause).not.toHaveBeenCalled();
    expect(getIsFadingOut()).toBe(false);
    expect(nativeVolume).toHaveBeenLastCalledWith(1);
  });

  it('bypasses timers for an explicit immediate pause', async () => {
    await (TrackPlayer.pause as (bypassFade?: boolean) => Promise<void>)(true);
    expect(nativePause).toHaveBeenCalledTimes(1);
    expect(getIsFadingOut()).toBe(false);
  });

  it.each(['next', 'previous'])('passes %s directly to native without a skip wrapper', async direction => {
    const skip = direction === 'next' ? TrackPlayer.skipToNext : TrackPlayer.skipToPrevious;
    await skip();
    expect(skip).toHaveBeenCalledTimes(1);
    expect(nativeState).not.toHaveBeenCalled();
    expect(nativePlay).not.toHaveBeenCalled();
  });
});
