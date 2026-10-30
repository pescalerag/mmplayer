import { database } from '../database';
import { MediaAssetService } from './MediaAssetService';
import { readInitialPlaylistCover } from './PlaylistCoverService';
import { createPlaylistService } from '../../packages/data/src/playlists';

export const PlaylistService = createPlaylistService(database, {
    readInitialCover: readInitialPlaylistCover,
    removeCover: playlistId => MediaAssetService.removePlaylistCover(playlistId),
});
