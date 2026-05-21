import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Playlist from '../database/models/Playlist';
import PlaylistTrack from '../database/models/PlaylistTrack';

export const PlaylistService = {
    /**
     * Get all playlists.
     */
    async getAllPlaylists(): Promise<Playlist[]> {
        return database.collections.get<Playlist>('playlists')
            .query(Q.sortBy('created_at', Q.desc))
            .fetch();
    },

    /**
     * Get all track IDs currently in a playlist.
     */
    async getTrackIdsInPlaylist(playlistId: string): Promise<string[]> {
        const playlistTracks = await database.collections.get<PlaylistTrack>('playlist_tracks')
            .query(Q.where('playlist_id', playlistId))
            .fetch();
        return playlistTracks.map(pt => pt.track.id);
    },

    /**
     * Create a new playlist.
     */
    async createPlaylist(name: string, description?: string): Promise<Playlist> {
        const trimmedName = name.trim();
        if (!trimmedName) throw new Error('El nombre de la lista de reproducción no puede estar vacío');

        return database.write(async () => {
            return database.collections.get<Playlist>('playlists').create(playlist => {
                playlist.name = trimmedName;
                playlist.description = description || null;
                playlist.createdAt = Date.now();
            });
        });
    },

    /**
     * Add a single track to a playlist.
     */
    async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
        await database.write(async () => {
            const playlistTracksCollection = database.collections.get<PlaylistTrack>('playlist_tracks');
            const existingTracks = await playlistTracksCollection
                .query(Q.where('playlist_id', playlistId))
                .fetch();

            const maxOrder = existingTracks.reduce((max, pt) => pt.order > max ? pt.order : max, 0);

            await playlistTracksCollection.create(pt => {
                pt.playlist.id = playlistId;
                pt.track.id = trackId;
                pt.order = maxOrder + 1;
            });
        });
    },

    /**
     * Add multiple tracks to a playlist in a single transaction (batch).
     */
    async addMultipleTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
        if (trackIds.length === 0) return;

        await database.write(async () => {
            const playlistTracksCollection = database.collections.get<PlaylistTrack>('playlist_tracks');
            const existingTracks = await playlistTracksCollection
                .query(Q.where('playlist_id', playlistId))
                .fetch();

            let maxOrder = existingTracks.reduce((max, pt) => pt.order > max ? pt.order : max, 0);

            const operations = trackIds.map(trackId => {
                maxOrder += 1;
                return playlistTracksCollection.prepareCreate(pt => {
                    pt.playlist.id = playlistId;
                    pt.track.id = trackId;
                    pt.order = maxOrder;
                });
            });

            await database.batch(...operations);
        });
    },

    /**
     * Remove a track from a playlist.
     */
    async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
        await database.write(async () => {
            const playlistTracks = await database.collections.get<PlaylistTrack>('playlist_tracks')
                .query(
                    Q.where('playlist_id', playlistId),
                    Q.where('track_id', trackId)
                )
                .fetch();

            const operations = playlistTracks.map(pt => pt.prepareDestroyPermanently());
            if (operations.length > 0) {
                await database.batch(...operations);
            }
        });
    },

    /**
     * Update an existing playlist's name and description.
     */
    async updatePlaylist(playlistId: string, name: string, description?: string): Promise<void> {
        const trimmedName = name.trim();
        if (!trimmedName) throw new Error('El nombre de la lista de reproducción no puede estar vacío');

        await database.write(async () => {
            const playlist = await database.collections.get<Playlist>('playlists').find(playlistId);
            await playlist.update(p => {
                p.name = trimmedName;
                p.description = description || null;
            });
        });
    },

    /**
     * Delete an entire playlist.
     */
    async deletePlaylist(playlistId: string): Promise<void> {
        await database.write(async () => {
            const playlist = await database.collections.get<Playlist>('playlists').find(playlistId);
            const playlistTracks = await database.collections.get<PlaylistTrack>('playlist_tracks')
                .query(Q.where('playlist_id', playlistId))
                .fetch();

            const operations = [
                ...playlistTracks.map(pt => pt.prepareDestroyPermanently()),
                playlist.prepareDestroyPermanently()
            ];

            await database.batch(...operations);
        });
    }
};
