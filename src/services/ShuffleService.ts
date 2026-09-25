import { database } from '../database';
import Track from '../database/models/Track';
import Album from '../database/models/Album';
import { useSettingsStore } from '../store/useSettingsStore';
import { Q } from '@nozbe/watermelondb';

export class ShuffleService {
    /**
     * Returns all tracks eligible for global shuffle and queue-end shuffle.
     * Excludes:
     * 1. Tracks where is_excluded_from_shuffle is true.
     * 2. Tracks belonging to albums where is_excluded_from_shuffle is true.
     * 3. Blacklisted tracks in settings (excludedSongs).
     */
    static async getEligibleShuffleTracks(): Promise<Track[]> {
        const [allTracks, excludedAlbums] = await Promise.all([
            database.collections.get<Track>('tracks').query().fetch(),
            database.collections.get<Album>('albums').query(Q.where('is_excluded_from_shuffle', true)).fetch(),
        ]);

        const excludedAlbumIds = new Set(excludedAlbums.map(a => a.id));
        const excludedSongs = useSettingsStore.getState().excludedSongs || [];
        const excludedSongsSet = new Set(excludedSongs);

        return allTracks.filter(track => {
            if (track.isExcludedFromShuffle) return false;
            if (excludedSongsSet.has(track.fileUrl)) return false;
            const albumId = (track as any).albumId || (track._raw as any).album_id || track.album?.id;
            if (albumId && excludedAlbumIds.has(albumId)) return false;
            return true;
        });
    }

    /**
     * Toggles the shuffle exclusion status of a track.
     */
    static async toggleTrackExclusion(track: Track): Promise<boolean> {
        const newValue = !track.isExcludedFromShuffle;
        await track.toggleExcludeFromShuffle();
        return newValue;
    }

    /**
     * Toggles the shuffle exclusion status of an album.
     */
    static async toggleAlbumExclusion(album: Album): Promise<boolean> {
        const newValue = !album.isExcludedFromShuffle;
        await album.toggleExcludeFromShuffle();
        return newValue;
    }

    /**
     * Sets shuffle exclusion for multiple tracks at once.
     */
    static async batchSetTracksExclusion(tracks: Track[], exclude: boolean): Promise<void> {
        await database.write(async () => {
            for (const track of tracks) {
                await track.update((t: any) => {
                    t.isExcludedFromShuffle = exclude;
                });
            }
        });
    }

    /**
     * Reincluye un track en la reproducción aleatoria.
     */
    static async includeTrack(track: Track): Promise<void> {
        await track.setExcludeFromShuffle(false);
    }

    /**
     * Reincluye un álbum en la reproducción aleatoria.
     */
    static async includeAlbum(album: Album): Promise<void> {
        await album.setExcludeFromShuffle(false);
    }
}
