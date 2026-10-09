import { BehaviorSubject } from 'rxjs';
import TrackPlayer, { Event } from 'react-native-track-player';
import { database } from '../database';
import { startNotificationFavoritesSync } from '../services/NotificationFavoritesService';

jest.mock('react-native-track-player', () => ({
    __esModule: true,
    Event: { PlaybackActiveTrackChanged: 'track-changed', RemoteLike: 'remote-like' },
    default: {
        addEventListener: jest.fn(),
        getActiveTrack: jest.fn(),
        updateNowPlayingMetadata: jest.fn(),
    },
}));

function mockTrack(id: string, isFavorite: boolean) {
    const model = { id, isFavorite, observe: jest.fn(), toggleLike: jest.fn() };
    const changes = new BehaviorSubject(model);
    model.observe.mockReturnValue(changes);
    model.toggleLike.mockImplementation(async () => {
        model.isFavorite = !model.isFavorite;
        changes.next(model);
    });
    return { model, changes };
}

const settle = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('event-driven notification favorites', () => {
    let listeners: Record<string, (event: any) => void>;
    let a: ReturnType<typeof mockTrack>;
    let b: ReturnType<typeof mockTrack>;
    let find: jest.Mock;
    let remove: jest.Mock;
    let stop: (() => void) | undefined;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        listeners = {};
        a = mockTrack('a', true);
        b = mockTrack('b', false);
        find = jest.fn(async id => {
            if (id === 'a') return a.model;
            if (id === 'b') return b.model;
            throw new Error('Track not found');
        });
        (database.get as jest.Mock).mockReturnValue({ find });
        remove = jest.fn();
        (TrackPlayer.addEventListener as jest.Mock).mockImplementation((event, listener) => {
            listeners[event] = listener;
            return { remove };
        });
        (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'a-instance' });
        (TrackPlayer.updateNowPlayingMetadata as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        stop?.();
        stop = undefined;
        jest.useRealTimers();
    });

    it('reads the initial favorite and sends app like/unlike changes without polling', async () => {
        stop = startNotificationFavoritesSync();
        await settle();
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'a-instance', isFavorite: true, favoriteEnabled: true,
        });
        await a.model.toggleLike();
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'a-instance', isFavorite: false, favoriteEnabled: true,
        });
        await a.model.toggleLike();
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'a-instance', isFavorite: true, favoriteEnabled: true,
        });
        a.changes.next(a.model); // An unrelated model edit must not redraw the heart.
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenCalledTimes(3);
        jest.advanceTimersByTime(60_000);
        expect(TrackPlayer.getActiveTrack).toHaveBeenCalledTimes(1);
        expect(find).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('switches to the new track and stops observing the old one', async () => {
        stop = startNotificationFavoritesSync();
        await settle();
        listeners[Event.PlaybackActiveTrackChanged]({ track: { id: 'b-instance' } });
        await settle();
        await a.model.toggleLike();
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'b-instance', isFavorite: false, favoriteEnabled: true,
        });
        expect(a.changes.observed).toBe(false);
        expect(b.changes.observed).toBe(true);
    });

    it('persists notification like/unlike and updates the observed UI state', async () => {
        stop = startNotificationFavoritesSync();
        await settle();
        const uiStates: boolean[] = [];
        const ui = a.changes.subscribe(track => uiStates.push(track.isFavorite));
        listeners[Event.RemoteLike]({ trackId: 'a-instance' });
        await settle();
        listeners[Event.RemoteLike]({ trackId: 'a-instance' });
        await settle();
        expect(a.model.toggleLike).toHaveBeenCalledTimes(2);
        expect(uiStates).toEqual([true, false, true]);
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'a-instance', isFavorite: true, favoriteEnabled: true,
        });
        ui.unsubscribe();
    });

    it('uses the track captured by the notification click even when the next song starts', async () => {
        stop = startNotificationFavoritesSync();
        await settle();
        listeners[Event.PlaybackActiveTrackChanged]({ track: { id: 'b-instance' } });
        listeners[Event.RemoteLike]({ trackId: 'a-instance' });
        await settle();
        expect(a.model.isFavorite).toBe(false);
        expect(b.model.toggleLike).not.toHaveBeenCalled();
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'b-instance', isFavorite: false, favoriteEnabled: true,
        });
    });

    it('keeps two rapid notification presses as two toggles', async () => {
        stop = startNotificationFavoritesSync();
        await settle();
        listeners[Event.RemoteLike]({ trackId: 'a-instance' });
        listeners[Event.RemoteLike]({ trackId: 'a-instance' });
        await settle();
        expect(a.model.toggleLike).toHaveBeenCalledTimes(2);
        expect(a.model.isFavorite).toBe(true);
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'a-instance', isFavorite: true, favoriteEnabled: true,
        });
    });

    it('ignores a late initial native read after receiving a track change', async () => {
        let resolve!: (track: any) => void;
        (TrackPlayer.getActiveTrack as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
        stop = startNotificationFavoritesSync();
        listeners[Event.PlaybackActiveTrackChanged]({ track: { id: 'b-instance' } });
        resolve({ id: 'a-instance' });
        await settle();
        expect(find).toHaveBeenCalledTimes(1);
        expect(find).toHaveBeenCalledWith('b');
    });

    it('ignores a late DB read for a previous queue entry', async () => {
        let resolve!: (track: any) => void;
        find.mockImplementation(id => id === 'a'
            ? new Promise(done => { resolve = done; }) : Promise.resolve(b.model));
        stop = startNotificationFavoritesSync();
        await settle();
        listeners[Event.PlaybackActiveTrackChanged]({ track: { id: 'b-instance' } });
        await settle();
        resolve(a.model);
        await settle();
        expect(a.model.observe).not.toHaveBeenCalled();
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'b-instance', isFavorite: false, favoriteEnabled: true,
        });
    });

    it('disables the heart for audio absent from the DB and for deleted tracks', async () => {
        stop = startNotificationFavoritesSync();
        await settle();
        a.changes.complete();
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'a-instance', isFavorite: false, favoriteEnabled: false,
        });
        listeners[Event.PlaybackActiveTrackChanged]({ track: { id: 'external' } });
        await settle();
        expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenLastCalledWith({
            favoriteTrackId: 'external', isFavorite: false, favoriteEnabled: false,
        });
    });

    it('registers once, cleans up all listeners and ignores pending reads after disposal', async () => {
        stop = startNotificationFavoritesSync();
        expect(startNotificationFavoritesSync()).toBe(stop);
        expect(TrackPlayer.addEventListener).toHaveBeenCalledTimes(2);
        stop();
        stop = undefined;
        await settle();
        expect(remove).toHaveBeenCalledTimes(2);
        expect(TrackPlayer.updateNowPlayingMetadata).not.toHaveBeenCalled();
    });
});
