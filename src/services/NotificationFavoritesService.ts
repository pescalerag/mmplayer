import { Platform } from 'react-native';
import TrackPlayer, { Event } from 'react-native-track-player';
import { distinctUntilChanged, map } from 'rxjs/operators';
import type { Subscription } from 'rxjs';
import { database } from '../database';
import type Track from '../database/models/Track';

let stopSync: (() => void) | null = null;

// Lives in the playback service so notification actions work without a mounted screen.
export function startNotificationFavoritesSync(): () => void {
    if (Platform.OS !== 'android') return () => {};
    if (stopSync) return stopSync;

    let disposed = false;
    let revision = 0;
    let activeQueueId: string | null = null;
    let trackSubscription: Subscription | undefined;

    const publish = (queueId: string, isFavorite: boolean, favoriteEnabled = true) => {
        void TrackPlayer.updateNowPlayingMetadata({
            favoriteTrackId: queueId,
            isFavorite,
            favoriteEnabled,
        }).catch(error => console.error('[NotificationFavorites] Could not update the heart:', error));
    };

    const observeActiveTrack = async (queueId: string | null) => {
        const request = ++revision;
        activeQueueId = queueId;
        trackSubscription?.unsubscribe();
        trackSubscription = undefined;
        if (!queueId) return;

        try {
            // Queue entries append an instance suffix to the WatermelonDB ID.
            const track = await database.get<Track>('tracks').find(queueId.split('-')[0]);
            if (disposed || request !== revision) return;
            trackSubscription = track.observe().pipe(
                map(model => model.isFavorite),
                distinctUntilChanged(),
            ).subscribe({
                next: isFavorite => publish(queueId, isFavorite),
                error: () => publish(queueId, false, false),
                complete: () => publish(queueId, false, false),
            });
        } catch {
            // External audio and deleted tracks have no persisted favorite state.
            if (!disposed && request === revision) publish(queueId, false, false);
        }
    };

    const trackListener = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, event => {
        void observeActiveTrack(event.track?.id?.toString() ?? null);
    });
    const favoriteListener = TrackPlayer.addEventListener(Event.RemoteLike, (event?: { trackId?: string }) => {
        // Native captures the queue ID when the button is pressed, before any subsequent skip.
        const queueId = event?.trackId ?? activeQueueId;
        if (!queueId || disposed) return;
        void database.get<Track>('tracks').find(queueId.split('-')[0])
            .then(track => track.toggleLike())
            .catch(error => console.error('[NotificationFavorites] Could not toggle favorite:', error));
    });

    // Seed once if the service starts with an existing queue; newer events take priority.
    const initialRevision = revision;
    void TrackPlayer.getActiveTrack().then(track => {
        if (!disposed && revision === initialRevision) {
            void observeActiveTrack(track?.id?.toString() ?? null);
        }
    }).catch(error => console.error('[NotificationFavorites] Could not read the active track:', error));

    stopSync = () => {
        if (disposed) return;
        disposed = true;
        revision++;
        trackListener.remove();
        favoriteListener.remove();
        trackSubscription?.unsubscribe();
        stopSync = null;
    };
    return stopSync;
}
