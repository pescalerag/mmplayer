import { calculateArtistRatings, summarizeTrackRatings } from '../utils/trackRatings';
import { sortRatedArtists } from '../utils/artistRanking';

describe('entity rating summaries', () => {
  it('counts unique songs, ignores missing/invalid ratings and excludes hidden files', () => {
    const songs = [
      { id: 'a', rating: 4, fileUrl: 'a.mp3' }, { id: 'b', rating: 4.5 },
      { id: 'a', rating: 4, fileUrl: 'a.mp3' }, { id: 'missing', rating: null },
      { id: 'zero', rating: 0 }, { id: 'invalid', rating: NaN },
      { id: 'too-low', rating: -1 }, { id: 'too-high', rating: 6 }, { id: 'infinite', rating: Infinity },
      { id: 'excluded', rating: 1, fileUrl: 'hidden.mp3' },
    ];
    expect(summarizeTrackRatings(songs, ['hidden.mp3'])).toEqual({ average: 4.25, ratedCount: 2, totalCount: 8 });
    expect(summarizeTrackRatings([])).toEqual({ average: null, ratedCount: 0, totalCount: 0 });
    expect(summarizeTrackRatings([{ id: 'unrated', rating: null }])).toEqual({ average: null, ratedCount: 0, totalCount: 1 });
  });

  it('credits principal and collaborating artists once per song, including missing principal links', () => {
    const ratings = calculateArtistRatings([
      { id: 'a', artistId: 'main', rating: 4 }, { id: 'b', artistId: 'main', rating: 5 },
      { id: 'c', artistId: 'guest', rating: null }, { id: 'd', artistId: null, rating: 3 },
    ], [
      { trackId: 'a', artistId: 'main' }, { trackId: 'a', artistId: 'guest' },
      { trackId: 'a', artistId: 'guest' }, { trackId: 'd', artistId: 'guest' },
      { trackId: 'deleted', artistId: 'orphan' },
    ]);
    expect(ratings.get('main')).toEqual({ average: 4.5, ratedCount: 2, totalCount: 2 });
    expect(ratings.get('guest')).toEqual({ average: 3.5, ratedCount: 2, totalCount: 3 });
    expect(ratings.has('orphan')).toBe(false);
  });

  it('uses song weighting rather than averaging album scores and sorts like albums', () => {
    const artists = [
      { id: 'empty', name: 'Empty', isPinned: false }, { id: 'low', name: 'Low', isPinned: false },
      { id: 'a', name: 'Z', isPinned: false }, { id: 'b', name: 'A', isPinned: false },
      { id: 'pin', name: 'Pinned', isPinned: true },
    ];
    const ratings = calculateArtistRatings([
      { id: '1', artistId: 'a', rating: 5 }, { id: '2', artistId: 'a', rating: 5 },
      { id: '3', artistId: 'a', rating: 2 }, { id: '4', artistId: 'b', rating: 4 },
      { id: '5', artistId: 'low', rating: 1 },
    ], []);
    expect(ratings.get('a')?.average).toBe(4);
    expect(sortRatedArtists(artists, ratings, 'rating_desc').map(x => x.id)).toEqual(['pin', 'a', 'b', 'low', 'empty']);
    expect(sortRatedArtists(artists, ratings, 'rating_asc').map(x => x.id)).toEqual(['pin', 'low', 'a', 'b', 'empty']);
    expect(artists[0].id).toBe('empty');
  });
});
