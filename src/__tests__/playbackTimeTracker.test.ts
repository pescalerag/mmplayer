import { PlaybackTimeTracker, syncWidgetState } from '../services/PlaybackService';
import TrackPlayer, { State } from 'react-native-track-player';
import { updateWidget } from '../../modules/native-audio-scanner';

jest.mock('react-native-track-player', () => ({
  __esModule: true, State: { Playing: 'playing', Paused: 'paused' }, Event: {},
  default: { getActiveTrack: jest.fn(), getPlaybackState: jest.fn() },
}));
jest.mock('../../modules/native-audio-scanner', () => ({ updateWidget: jest.fn().mockResolvedValue(undefined) }));

afterEach(() => {
  for (const id of ['first', 'second']) PlaybackTimeTracker.clearAccumulated(id);
  jest.restoreAllMocks(); jest.useRealTimers();
});

it('counts actual playing intervals once across pauses and track changes', () => {
  jest.useFakeTimers().setSystemTime(100000);
  PlaybackTimeTracker.onStatePlaying('first');
  jest.advanceTimersByTime(3000);
  PlaybackTimeTracker.onStatePlaying('first');
  expect(PlaybackTimeTracker.getAccumulatedSeconds('first')).toBe(3);
  PlaybackTimeTracker.onStateNotPlaying(); PlaybackTimeTracker.onStateNotPlaying();
  jest.advanceTimersByTime(1000);
  expect(PlaybackTimeTracker.getAccumulatedSeconds('first')).toBe(3);
  PlaybackTimeTracker.onStatePlaying('first'); jest.advanceTimersByTime(2000);
  PlaybackTimeTracker.onStatePlaying('second'); jest.advanceTimersByTime(4000);
  expect(PlaybackTimeTracker.getAccumulatedSeconds('first')).toBe(5);
  expect(PlaybackTimeTracker.getAccumulatedSeconds('second')).toBe(4);
  expect(PlaybackTimeTracker.getCurrentTrackId()).toBe('second');
  expect(PlaybackTimeTracker.isTimerRunning()).toBe(true);
  PlaybackTimeTracker.addReportedSeconds('second', 6);
  expect(PlaybackTimeTracker.getAccumulatedSeconds('second')).toBe(10);
  expect(PlaybackTimeTracker.isTimerRunning()).toBe(false);
  PlaybackTimeTracker.clearAccumulated('second');
  expect(PlaybackTimeTracker.getCurrentTrackId()).toBeNull();
});

it('sends native playback metadata to the widget and handles a failed native read', async () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValueOnce({ title: 'Song', artist: 'Artist', artwork: 'cover' });
  (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValueOnce({ state: State.Playing });
  await syncWidgetState();
  expect(updateWidget).toHaveBeenCalledWith('Song', 'Artist', 'cover', true);
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValueOnce(null);
  (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValueOnce({ state: State.Paused });
  await syncWidgetState();
  expect(updateWidget).toHaveBeenLastCalledWith('MMPlayer', expect.any(String), null, false);
  (TrackPlayer.getActiveTrack as jest.Mock).mockRejectedValueOnce(Error('Unavailable'));
  await expect(syncWidgetState()).resolves.toBeUndefined();
  expect(errors).toHaveBeenCalled();
});
