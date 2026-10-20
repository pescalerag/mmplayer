import type { NavigationState, PartialState } from '@react-navigation/native';
import { navigationRef } from './navigationRef';

export type DetailDestination =
    | { name: 'AlbumDetail'; params: { albumId: string } }
    | { name: 'ArtistDetail'; params: { artistId: string } }
    | { name: 'PlaylistDetail'; params: { playlistId: string } }
    | { name: 'FolderDetail'; params: { folderPath: string; folderName?: string } }
    | { name: 'TagDetail'; params: { tagId: string; tagName: string; tagColor: string } }
    | { name: 'SmartListDetail'; params: { smartListId: string } }
    | { name: 'FavoritesDetail'; params?: undefined }
    | { name: 'Notifications'; params?: undefined };

type State = NavigationState | PartialState<NavigationState>;

/** Choose the deepest active stack that actually registers the destination. */
export function findDestinationStack(state: State, name: string): string | undefined {
    const child = state.routes[state.index ?? 0]?.state;
    const nested = child && findDestinationStack(child, name);
    if (nested) return nested;
    return state.type === 'stack' && state.routeNames?.includes(name) ? state.key : undefined;
}

export function openDestination(destination: DetailDestination) {
    if (!navigationRef.isReady()) return;
    const target = findDestinationStack(navigationRef.getRootState(), destination.name);
    if (target) {
        navigationRef.dispatch({ type: 'NAVIGATE', payload: { ...destination, pop: true }, target });
        return;
    }
    // Explicit fallback for sheets opened outside a stack supporting this detail.
    navigationRef.dispatch({ type: 'NAVIGATE', payload: { name: 'Main', pop: true, params: {
        screen: destination.name === 'Notifications' ? 'Inicio' : 'Biblioteca',
        params: { screen: destination.name, params: destination.params, initial: false },
    } } });
}

export function openAlbum(albumId: string) { openDestination({ name: 'AlbumDetail', params: { albumId } }); }
export function openArtist(artistId: string) { openDestination({ name: 'ArtistDetail', params: { artistId } }); }

export function openLyricsDocument(name: 'LyricsEditor' | 'LyricsSync', trackId: string) {
    if (!navigationRef.isReady()) return;
    const target = findDestinationStack(navigationRef.getRootState(), name);
    if (target) navigationRef.dispatch({ type: 'NAVIGATE', target, payload: { name, params: { trackId }, pop: true } });
    else navigationRef.navigate('Player', { screen: name, params: { trackId }, initial: false });
}
