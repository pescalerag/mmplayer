import TrackPlayer from 'react-native-track-player';
import { useCastStore } from '../store/useCastStore';
import { LocalCastService } from '../services/LocalCastService';
import { LocalCastPlaybackService } from '../services/LocalCastPlaybackService';
import { usePlayerStore } from '../store/usePlayerStore';

jest.unmock('../store/useCastStore');
jest.mock('expo-network', () => ({ getNetworkStateAsync: async () => ({ isConnected: true }), getIpAddressAsync: async () => '192.168.1.2' }));
jest.mock('../../modules/native-audio-scanner', () => ({ acquireCastWakeLock: jest.fn(), releaseCastWakeLock: jest.fn() }));
jest.mock('../services/LocalCastService', () => ({ LocalCastService: { start: jest.fn(), stop: jest.fn(), createSessionId: () => 'session', emitStop: jest.fn() } }));
jest.mock('../services/LocalCastPlaybackService', () => ({ LocalCastPlaybackService: { begin: jest.fn(), requestStop: jest.fn(), saveListen: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: () => ({ activeTrack: { id: 'song' }, setPlaybackSpeed: jest.fn(), setPlaybackPitch: jest.fn() }) } }));
jest.mock('../store/useSleepTimerStore', () => ({ useSleepTimerStore: { getState: () => ({ deactivate: jest.fn() }) } }));

describe('mobile LocalCast handoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCastStore.setState({ isServerRunning: false, isLocalCastActive: false, isChromecastConnected: false, castPosition: 0, castDuration: 0, isCastPlaying: false, previousVolume: 0.8 });
    (TrackPlayer as any).getVolume = jest.fn(async () => 0.8);
    (TrackPlayer as any).setVolume = jest.fn(async () => {});
    (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 34, duration: 180 });
    (TrackPlayer as any).getPlaybackState = jest.fn(async () => ({ state: 'playing' }));
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'song-instance' });
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
  it('uses the stored track identity when no native active index is available', async () => {
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValueOnce(undefined);
    await useCastStore.getState().startLocalCast();
    expect(TrackPlayer.getTrack).not.toHaveBeenCalled();
    expect(LocalCastPlaybackService.begin).toHaveBeenCalledWith('session', 'song', 34, true);
  });
  it('starts a paused empty session when both native progress and track identity are unavailable', async () => {
    (TrackPlayer.getProgress as jest.Mock).mockRejectedValueOnce(new Error('Native unavailable'));
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValueOnce(null);
    await useCastStore.getState().startLocalCast();
    expect(LocalCastPlaybackService.begin).toHaveBeenCalledWith('session', '', 0, false);
    expect(useCastStore.getState()).toMatchObject({ isLocalCastActive: true, castPosition: 0, isCastPlaying: false });
  });
  it('handles a missing stored track and does not resume playback after a failed paused start', async () => {
    const state = usePlayerStore.getState();
    jest.spyOn(usePlayerStore, 'getState').mockReturnValue({ ...state, activeTrack: null });
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValueOnce(null);
    (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValueOnce({ state: 'paused' });
    await useCastStore.getState().startLocalCast();
    expect(LocalCastPlaybackService.begin).toHaveBeenCalledWith('session', '', 34, false);
    useCastStore.setState({ isServerRunning: false });
    (LocalCastService.start as jest.Mock).mockRejectedValueOnce(new Error('Server unavailable'));
    (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValueOnce({ state: 'paused' });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(useCastStore.getState().startLocalCast()).rejects.toThrow('Server unavailable');
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
  });
  it('pauses the phone and transfers the current position and native track identity', async () => {
    await useCastStore.getState().startLocalCast();
    expect(TrackPlayer.pause).toHaveBeenCalledWith(true);
    expect(LocalCastPlaybackService.begin).toHaveBeenCalledWith('session', 'song-instance', 34, true);
    expect(useCastStore.getState()).toMatchObject({ isLocalCastActive: true, castPosition: 34, isCastPlaying: true });
  });
  it('restores the acknowledged second only after the browser has stopped, and preserves paused state', async () => {
    useCastStore.setState({ isServerRunning: true, isLocalCastActive: true, castPosition: 80, isCastPlaying: true });
    (LocalCastPlaybackService.requestStop as jest.Mock).mockResolvedValue({ position: 87, playing: false });
    await useCastStore.getState().stopLocalCast();
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(87);
    expect(TrackPlayer.pause).toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(LocalCastService.stop).toHaveBeenCalled();
    expect(LocalCastPlaybackService.saveListen).toHaveBeenCalledTimes(1);
    expect(useCastStore.getState().isLocalCastActive).toBe(false);
  });
  it('falls back to the last confirmed second when disconnected, including an exact zero', async () => {
    jest.useFakeTimers();
    useCastStore.setState({ isServerRunning: true, isLocalCastActive: true, castPosition: 0, isCastPlaying: true });
    (LocalCastPlaybackService.requestStop as jest.Mock).mockResolvedValue(null);
    const stop = useCastStore.getState().stopLocalCast();
    await jest.advanceTimersByTimeAsync(2500); await stop;
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(LocalCastPlaybackService.saveListen).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.play).toHaveBeenCalled();
    expect(LocalCastService.stop).toHaveBeenCalled();
  });
  it('restores native playback if starting the server fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (LocalCastService.start as jest.Mock).mockRejectedValueOnce(new Error('server failed'));
    await expect(useCastStore.getState().startLocalCast()).rejects.toThrow('server failed');
    expect(TrackPlayer.play).toHaveBeenCalled();
    expect(useCastStore.getState().isLocalCastActive).toBe(false);
    jest.restoreAllMocks();
  });
  it('still transfers playback when persisting the listen fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    useCastStore.setState({ isServerRunning: true, isLocalCastActive: true, castPosition: 100, isCastPlaying: true });
    (LocalCastPlaybackService.requestStop as jest.Mock).mockResolvedValue({ position: 110, playing: true });
    (LocalCastPlaybackService.saveListen as jest.Mock).mockRejectedValueOnce(new Error('write failed'));
    await useCastStore.getState().stopLocalCast();
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(110);
    expect(TrackPlayer.play).toHaveBeenCalled();
    expect(useCastStore.getState().isLocalCastActive).toBe(false);
    jest.restoreAllMocks();
  });
});
