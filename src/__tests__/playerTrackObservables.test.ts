import { combineLatest, of, Subject } from 'rxjs';
import type Track from '../database/models/Track';
import { observePlayerTrack } from '../utils/observePlayerTrack';

describe('PlayerScreen metadata publication', () => {
    function createSong() {
        const album = new Subject<any>();
        const artist = new Subject<any>();
        const artists = new Subject<any[]>();
        const tags = new Subject<any[]>();
        const track = {
            id: 'song', observe: () => of(track),
            album: { observe: () => album }, artist: { observe: () => artist },
            queryCollaborators: { observe: () => artists },
            queryTags: { observe: () => tags },
        } as unknown as Track;
        return { track, album, artist, artists, tags };
    }

    it('does not publish empty tags or only the principal artist while queries load', () => {
        const song = createSong();
        const render = jest.fn();
        const subscription = combineLatest(observePlayerTrack(song.track)).subscribe(render);
        song.album.next({ id: 'album' });
        song.artist.next({ name: 'Principal' });
        expect(render).not.toHaveBeenCalled();
        song.artists.next([{ name: 'Principal' }, { name: 'Guest' }]);
        expect(render).not.toHaveBeenCalled();
        song.tags.next([{ name: 'Rock' }]);
        expect(render).toHaveBeenCalledTimes(1);
        expect(render.mock.calls[0][0]).toMatchObject({
            track: song.track,
            artists: [{ name: 'Principal' }, { name: 'Guest' }],
            tags: [{ name: 'Rock' }],
        });
        song.tags.next([]);
        expect(render.mock.calls[1][0].tags).toEqual([]);
        subscription.unsubscribe();
        song.tags.next([{ name: 'Late result' }]);
        expect(render).toHaveBeenCalledTimes(2);
    });

    it('renders genuinely empty metadata and tolerates missing album/artist relations', () => {
        const song = createSong();
        const render = jest.fn();
        const subscription = combineLatest(observePlayerTrack(song.track)).subscribe(render);
        song.album.error(new Error('Missing album'));
        song.artist.error(new Error('Missing artist'));
        song.artists.next([]);
        song.tags.next([]);
        expect(render).toHaveBeenCalledWith({
            track: song.track, album: null, artist: null, artists: [], tags: [],
        });
        subscription.unsubscribe();
    });
});
