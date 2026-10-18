import TrackPlayer, { State } from 'react-native-track-player';
import { Platform } from 'react-native';
import { setNativeTransportPlaying } from '../../modules/native-equalizer';
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
let mockFadeEnabled = true;
const mockCast = { isServerRunning: false, isLocalCastActive: false, isChromecastConnected: false,
  setCastPlaying: jest.fn() };
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: { getState: () => ({ isFadeEnabled: mockFadeEnabled }) } }));
jest.mock('../../modules/native-equalizer', () => ({ setNativeTransportPlaying: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../store/useCastStore', () => ({ useCastStore: { getState: () => mockCast } }));
jest.mock('../services/LocalCastService', () => ({ LocalCastService: { emitPlay: jest.fn(), emitPause: jest.fn() } }));
jest.mock('../services/ChromecastService', () => ({ ChromecastService: { play: jest.fn(), pause: jest.fn() } }));
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

describe('JavaScript playback transport fallback', () => {
  beforeEach(async () => {
    Platform.OS = 'ios';
    jest.useFakeTimers();
    jest.clearAllMocks();
    nativeVolume.mockResolvedValue(undefined);
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

  it('acknowledges pause while the native state query is still pending', async () => {
    let resolveState!: (state: { state: string }) => void;
    nativeState.mockReturnValueOnce(new Promise(resolve => { resolveState = resolve; }));
    const pause = TrackPlayer.pause();
    expect(getIsFadingOut()).toBe(true);
    resolveState({ state: State.Playing });
    await pause;
    await jest.advanceTimersByTimeAsync(400);
    expect(nativePause).toHaveBeenCalledTimes(1);
  });

  it('keeps a pause fade bounded when each native volume update takes 100ms', async () => {
    nativeVolume.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    await TrackPlayer.pause();
    await jest.advanceTimersByTimeAsync(500);
    expect(nativePause).toHaveBeenCalledTimes(1);
    expect(nativeVolume).toHaveBeenLastCalledWith(0);
    expect(nativeVolume.mock.calls.length).toBeLessThan(16);
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

describe('Android native playback transport', () => {
  const command = setNativeTransportPlaying as jest.Mock;
  beforeEach(async () => {
    Platform.OS = 'android';
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFadeEnabled = true;
    Object.assign(mockCast, { isServerRunning: false, isLocalCastActive: false, isChromecastConnected: false });
    command.mockResolvedValue(undefined);
    nativeVolume.mockResolvedValue(undefined);
    await TrackPlayer.reset();
    await TrackPlayer.setVolume(1);
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await TrackPlayer.reset();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts play immediately without waiting for a native state query or JS volume steps', async () => {
    nativeState.mockImplementation(() => new Promise(() => {}));
    await TrackPlayer.play();
    expect(command).toHaveBeenCalledWith(true, 1, 400);
    expect(nativeState).not.toHaveBeenCalled();
    expect(nativeVolume).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2000);
    expect(command).toHaveBeenCalledTimes(1);
    expect(nativePlay).not.toHaveBeenCalled();
  });

  it('acknowledges pause immediately and delegates the complete fade to Android', async () => {
    let resolve!: () => void;
    command.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const pending = TrackPlayer.pause();
    expect(getIsFadingOut()).toBe(true);
    expect(command).toHaveBeenCalledWith(false, 1, 400);
    expect(nativeState).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1600);
    expect(getIsFadingOut()).toBe(true);
    resolve();
    await pending;
    expect(nativePause).not.toHaveBeenCalled();
  });

  it('sends the latest play request even while the previous pause acknowledgement is pending', async () => {
    let resolve!: () => void;
    command.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const pending = TrackPlayer.pause();
    await TrackPlayer.play();
    expect(command.mock.calls).toEqual([[false, 1, 400], [true, 1, 400]]);
    expect(getIsFadingOut()).toBe(false);
    resolve();
    await pending;
  });

  it('does not let an old failure clear the state of a newer pause', async () => {
    let reject!: (error: Error) => void;
    command.mockImplementationOnce(() => new Promise<void>((_, fail) => { reject = fail; }));
    const first = TrackPlayer.pause().catch(() => {});
    await TrackPlayer.play();
    await TrackPlayer.pause();
    reject(new Error('stale request'));
    await first;
    expect(getIsFadingOut()).toBe(true);
  });

  it('clears the optimistic pause if Android rejects the current command', async () => {
    command.mockRejectedValueOnce(new Error('service unavailable'));
    await expect(TrackPlayer.pause()).rejects.toThrow('service unavailable');
    expect(getIsFadingOut()).toBe(false);
  });

  it('supports immediate transport both with fade disabled and with an explicit bypass', async () => {
    mockFadeEnabled = false;
    await TrackPlayer.play();
    await TrackPlayer.pause();
    mockFadeEnabled = true;
    await (TrackPlayer.play as (bypass?: boolean) => Promise<void>)(true);
    await (TrackPlayer.pause as (bypass?: boolean) => Promise<void>)(true);
    expect(command.mock.calls).toEqual([[true, 1, 0], [false, 1, 0], [true, 1, 0], [false, 1, 0]]);
  });

  it('passes volume changes to Android during a pause without losing the logical volume', async () => {
    await TrackPlayer.pause();
    await TrackPlayer.setVolume(0.6);
    expect(nativeVolume).toHaveBeenLastCalledWith(0.6);
    expect(await TrackPlayer.getVolume()).toBe(0.6);
    await TrackPlayer.play();
    expect(command).toHaveBeenLastCalledWith(true, 0.6, 400);
  });

  it('keeps LocalCast muted and uses the receiver transport instead of a native fade', async () => {
    Object.assign(mockCast, { isServerRunning: true, isLocalCastActive: true });
    await TrackPlayer.play();
    await TrackPlayer.pause();
    expect(command).not.toHaveBeenCalled();
    expect(nativeVolume).toHaveBeenLastCalledWith(0);
    expect(mockCast.setCastPlaying.mock.calls).toEqual([[true], [false]]);
  });

  it('keeps Chromecast on the existing transport path without a local fade', async () => {
    Object.assign(mockCast, { isServerRunning: true, isChromecastConnected: true });
    await TrackPlayer.play();
    await TrackPlayer.pause();
    expect(command).not.toHaveBeenCalled();
    expect(nativeVolume).toHaveBeenLastCalledWith(0);
    expect(nativePlay).toHaveBeenCalledTimes(1);
    expect(nativePause).toHaveBeenCalledTimes(1);
  });
});
