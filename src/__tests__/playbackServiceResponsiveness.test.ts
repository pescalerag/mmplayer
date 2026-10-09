import TrackPlayer, { Event, State } from 'react-native-track-player';
import { PlaybackService, PlaybackTimeTracker } from '../services/PlaybackService';
import { HistoryService } from '../services/HistoryService';
import { usePlayerStore } from '../store/usePlayerStore';
import { database } from '../database';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  Event: { PlaybackActiveTrackChanged: 'track-changed' },
  State: { Playing: 'playing', Paused: 'paused' },
  default: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    getActiveTrack: jest.fn().mockResolvedValue({ id: 'new' }),
    getPlaybackState: jest.fn().mockResolvedValue({ state: 'playing' }),
    getActiveTrackIndex: jest.fn().mockResolvedValue(1),
  },
}));
jest.mock('../services/NotificationFavoritesService', () => ({ startNotificationFavoritesSync: jest.fn() }));
jest.mock('../../modules/native-audio-scanner', () => ({ updateWidget: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../store/usePlayerStore', () => {
  const state = {
    isSyncingLyrics: false, userQueueSize: 0,
    setActiveTrackById: jest.fn().mockResolvedValue(undefined),
    updateQueueStatus: jest.fn().mockResolvedValue(undefined),
  };
  return { consumeUserQueueTransition: jest.fn(), usePlayerStore: { getState: () => state, setState: jest.fn() } };
});

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

it('updates the displayed song while history persistence is still pending', async () => {
  jest.useFakeTimers();
  let finishHistory!: () => void;
  const history = jest.spyOn(HistoryService, 'logToDatabase').mockImplementation(() => new Promise<void>(resolve => { finishHistory = resolve; }));
  const logging = jest.spyOn(console, 'log').mockImplementation(() => {});
  (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ duration: 180 }) });
  await PlaybackService();
  const listener = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackActiveTrackChanged)![1];
  PlaybackTimeTracker.setAccumulatedSeconds('old', 120);
  const changing = listener({ track: { id: 'new' }, lastTrack: { id: 'old' }, index: 1, lastIndex: 0 });
  await settle();
  expect(history).toHaveBeenCalled();
  expect(usePlayerStore.getState().setActiveTrackById).toHaveBeenCalledWith('new', undefined);
  expect(usePlayerStore.getState().updateQueueStatus).toHaveBeenCalledWith(1);
  expect((await TrackPlayer.getPlaybackState()).state).toBe(State.Playing);
  finishHistory();
  await changing;
  history.mockRestore();
  logging.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});
