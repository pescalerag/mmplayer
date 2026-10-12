import { calculateAlbumRatings, getTopRatedAlbums, sortAlbumRatings } from '../utils/albumRanking';

const album = (id: string, title = id, isPinned = false) => ({ id, title, isPinned });
const track = (albumId: string | null, rating: number | null) => ({ albumId, rating });

describe('album rating calculations', () => {
  it('averages only valid ratings, counts all songs and ignores songs without an album', () => {
    const result = calculateAlbumRatings([album('a'), album('empty')], [track('a', 4), track('a', 4.5), track('a', null), track('a', 0), track('a', NaN), track('a', -1), track('a', 6), track(null, 5), track('missing', 5)]);
    expect(result[0]).toEqual({ album: album('a'), average: 4.25, ratedCount: 2, totalCount: 7 });
    expect(result[1]).toEqual({ album: album('empty'), average: null, ratedCount: 0, totalCount: 0 });
  });

  it('keeps unrated albums last in both directions and resolves ties by rated songs, title and id', () => {
    const albums = [album('u'), album('a', 'Z'), album('b', 'B'), album('c', 'A'), album('d', 'A'), album('low')];
    const data = calculateAlbumRatings(albums, [track('a', 5), track('a', 5), track('b', 5), track('c', 5), track('d', 5), track('low', 1)]);
    expect(sortAlbumRatings(data, 'rating_desc').map(x => x.album.id)).toEqual(['a', 'c', 'd', 'b', 'low', 'u']);
    expect(sortAlbumRatings([...data].reverse(), 'rating_desc').map(x => x.album.id)).toEqual(['a', 'c', 'd', 'b', 'low', 'u']);
    expect(sortAlbumRatings(data, 'rating_asc').map(x => x.album.id)).toEqual(['low', 'a', 'c', 'd', 'b', 'u']);
    expect(data.map(x => x.album.id)).toEqual(albums.map(x => x.id));
  });

  it('preserves pinned priority only when requested, including unrated pinned albums', () => {
    const data = calculateAlbumRatings([album('high'), album('pin', 'pin', true), album('pin2', 'pin2', true)], [track('high', 5), track('pin2', 1)]);
    expect(sortAlbumRatings(data, 'rating_desc', true).map(x => x.album.id)).toEqual(['pin2', 'pin', 'high']);
    expect(sortAlbumRatings([...data].reverse(), 'rating_desc', true).map(x => x.album.id)).toEqual(['pin2', 'pin', 'high']);
    expect(getTopRatedAlbums(data).map(x => x.album.id)).toEqual(['high', 'pin2']);
  });

  it('limits Home to ten rated albums and leaves empty libraries empty', () => {
    const albums = Array.from({ length: 12 }, (_, i) => album(String(i)));
    expect(getTopRatedAlbums(calculateAlbumRatings(albums, albums.map(x => track(x.id, 5))))).toHaveLength(10);
    expect(getTopRatedAlbums(calculateAlbumRatings(albums, []))).toEqual([]);
    expect(sortAlbumRatings(calculateAlbumRatings([album('a'), album('b')], []), 'rating_desc').map(x => x.album.id)).toEqual(['a', 'b']);
    expect(sortAlbumRatings(calculateAlbumRatings([album('a'), album('b')], []), 'rating_asc').map(x => x.album.id)).toEqual(['a', 'b']);
    expect(calculateAlbumRatings([], [])).toEqual([]);
  });
});
