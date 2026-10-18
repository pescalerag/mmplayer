import { Subject } from 'rxjs';
import { database } from '../database';
import { AlbumRankingService } from '../services/AlbumRankingService';

describe('shared album ranking queries', () => {
  it('observes rating and membership changes with two shared queries and releases both subscriptions', () => {
    const albums = new Subject<any[]>();
    const tracks = new Subject<any[]>();
    const albumObserve = jest.fn(() => albums);
    const trackObserve = jest.fn(() => tracks);
    const query = jest.fn();
    (database.get as jest.Mock).mockImplementation(table => ({ query: () => { query(table); return { observeWithColumns: table === 'albums' ? albumObserve : trackObserve }; } }));
    const first = jest.fn(); const second = jest.fn();
    const a = AlbumRankingService.observe().subscribe(first);
    const b = AlbumRankingService.observe().subscribe(second);
    expect(query).toHaveBeenCalledTimes(2);
    expect(albumObserve).toHaveBeenCalledWith(expect.arrayContaining(['title', 'year', 'is_pinned', 'cover_url']));
    expect(trackObserve).toHaveBeenCalledWith(expect.arrayContaining(['rating', 'album_id', 'file_url']));
    const album = { id: 'a', title: 'A', isPinned: false };
    albums.next([album, { ...album, id: 'b' }]);
    const song = { rating: 4, album: { id: 'a' } };
    tracks.next([song]);
    expect(first.mock.lastCall[0][0].average).toBe(4);
    song.rating = 5; tracks.next([song]);
    expect(second.mock.lastCall[0][0].average).toBe(5);
    song.album.id = 'b'; tracks.next([song]);
    expect(first.mock.lastCall[0].map((item: any) => item.average)).toEqual([null, 5]);
    tracks.next([]);
    expect(first.mock.lastCall[0][1].ratedCount).toBe(0);
    albums.next([]);
    expect(first.mock.lastCall[0]).toEqual([]);
    a.unsubscribe();
    expect(tracks.observed).toBe(true);
    b.unsubscribe();
    expect(tracks.observed).toBe(false);
    expect(albums.observed).toBe(false);
  });

  it('propagates database errors and starts fresh queries on retry', () => {
    const source = new Subject<any[]>();
    (database.get as jest.Mock).mockReturnValue({ query: () => ({ observeWithColumns: () => source }) });
    const error = jest.fn();
    AlbumRankingService.observe().subscribe({ error });
    source.error(new Error('read failed'));
    expect(error).toHaveBeenCalledWith(expect.any(Error));
    const albums = new Subject<any[]>(); const tracks = new Subject<any[]>();
    (database.get as jest.Mock).mockImplementation(table => ({ query: () => ({ observeWithColumns: () => table === 'albums' ? albums : tracks }) }));
    const next = jest.fn(); const subscription = AlbumRankingService.observe().subscribe(next);
    albums.next([]); tracks.next([]);
    expect(next).toHaveBeenCalledWith([]);
    subscription.unsubscribe();
  });
});
