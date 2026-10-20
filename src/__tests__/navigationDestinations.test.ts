import { findDestinationStack, openAlbum, openDestination, openLyricsDocument } from '../navigation/destinations';
import { navigationRef } from '../navigation/navigationRef';

const root = (name: string, state: any) => ({ key: 'root', type: 'stack', index: 0, routeNames: ['Main', 'Player'], routes: [{ name, state }] }) as any;

it('targets the active detail stack and requests pop semantics to reuse an earlier instance', () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    (navigationRef.getRootState as jest.Mock).mockReturnValue(root('Player', {
        key: 'player', type: 'stack', index: 1, routeNames: ['PlayerHome', 'AlbumDetail', 'ArtistDetail'],
        routes: [{ name: 'PlayerHome' }, { name: 'ArtistDetail' }],
    }));
    try {
        openAlbum('album-a');
        expect(navigationRef.dispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', target: 'player', payload: { name: 'AlbumDetail', params: { albumId: 'album-a' }, pop: true } });
    } finally { jest.restoreAllMocks(); }
});

it('resolves nested tab stacks and explicitly routes notifications through Home when not registered locally', () => {
    const state = root('Main', { key: 'tabs', type: 'tab', index: 0, routeNames: ['Biblioteca'], routes: [{ name: 'Biblioteca', state: {
        key: 'library', type: 'stack', index: 0, routeNames: ['Library', 'AlbumDetail'], routes: [{ name: 'Library' }],
    } }] });
    expect(findDestinationStack(state, 'AlbumDetail')).toBe('library');
    expect(findDestinationStack(state, 'Notifications')).toBeUndefined();
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    (navigationRef.getRootState as jest.Mock).mockReturnValue(state);
    try {
        openDestination({ name: 'Notifications' });
        expect(navigationRef.dispatch).toHaveBeenLastCalledWith({ type: 'NAVIGATE', payload: { name: 'Main', pop: true, params: {
            screen: 'Inicio', params: { screen: 'Notifications', params: undefined, initial: false },
        } } });
    } finally { jest.restoreAllMocks(); }
});

it('opens a fixed lyrics document through Player instead of dispatching a child route at the root', () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    (navigationRef.getRootState as jest.Mock).mockReturnValue(root('Main', undefined));
    try {
        openLyricsDocument('LyricsEditor', 'song-a');
        expect(navigationRef.navigate).toHaveBeenCalledWith('Player', { screen: 'LyricsEditor', params: { trackId: 'song-a' }, initial: false });
        (navigationRef.getRootState as jest.Mock).mockReturnValue(root('Player', { key: 'player', type: 'stack', index: 0, routeNames: ['PlayerHome', 'LyricsSync'], routes: [{ name: 'PlayerHome' }] }));
        openLyricsDocument('LyricsSync', 'song-b');
        expect(navigationRef.dispatch).toHaveBeenLastCalledWith({ type: 'NAVIGATE', target: 'player', payload: { name: 'LyricsSync', params: { trackId: 'song-b' }, pop: true } });
    } finally { jest.restoreAllMocks(); }
});
