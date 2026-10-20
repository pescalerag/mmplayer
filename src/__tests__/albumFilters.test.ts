import { albumYear, createAlbumFilterDraft, summarizeAlbumTracks, hasAlbumFilters, needsAlbumTrackStats, EMPTY_ALBUM_FILTERS, matchesAlbumFilters, parseAlbumFilterDraft, sortLibraryAlbums } from '../utils/albumFilters';
import { useLibraryStore } from '../store/useLibraryStore';

const albums = [
  { id: 'a', title: 'Zeta', year: 2000, isPinned: false },
  { id: 'b', title: 'Alpha', year: 2020, isPinned: false },
  { id: 'c', title: 'Missing', year: null, isPinned: false },
  { id: 'd', title: 'Zero', year: 0, isPinned: false },
];
const counts = new Map([['a', { count: 4, duration: 0, ratingSum: 0, ratedCount: 0 }], ['b', { count: 12, duration: 0, ratingSum: 0, ratedCount: 0 }]]);

it('counts the songs of each album without querying individual albums', () => {
  const stats = summarizeAlbumTracks([{ album: { id: 'a' }, duration: 60, rating: null }, { album: { id: 'b' }, duration: 120, rating: null }, { album: { id: 'a' }, duration: 60, rating: null }]);
  expect(stats.get('a')?.count).toBe(2);
  expect(stats.get('b')?.count).toBe(1);
});

it('combines inclusive song and year bounds; pinned albums do not bypass filters', () => {
  const filters = { ...EMPTY_ALBUM_FILTERS, minTracks: 4, maxTracks: 12, minYear: 2000, maxYear: 2020 };
  expect(albums.filter(album => matchesAlbumFilters(album, counts, filters)).map(a => a.id)).toEqual(['a', 'b']);
  expect(matchesAlbumFilters({ ...albums[0], isPinned: true } as typeof albums[0], counts, { ...filters, minTracks: 5 })).toBe(false);
  expect(matchesAlbumFilters(albums[1], counts, { ...filters, maxYear: 2019 })).toBe(false);
});

it('handles empty albums, one-sided bounds and unknown years', () => {
  expect(matchesAlbumFilters(albums[2], counts, { ...EMPTY_ALBUM_FILTERS, maxTracks: 0 })).toBe(true);
  expect(matchesAlbumFilters(albums[2], counts, { ...EMPTY_ALBUM_FILTERS, minTracks: 1 })).toBe(false);
  expect(matchesAlbumFilters(albums[2], counts, EMPTY_ALBUM_FILTERS)).toBe(true);
  expect(matchesAlbumFilters(albums[3], counts, { ...EMPTY_ALBUM_FILTERS, maxYear: 2020 })).toBe(false);
  expect(albumYear(NaN)).toBeNull();
});

it('sorts numerically by year in both directions with missing years last', () => {
  expect(sortLibraryAlbums(albums, 'year_asc').map(a => a.id)).toEqual(['a', 'b', 'c', 'd']);
  expect(sortLibraryAlbums(albums, 'year_desc').map(a => a.id)).toEqual(['b', 'a', 'c', 'd']);
  expect(sortLibraryAlbums([{ ...albums[0], isPinned: true }, albums[1]], 'year_desc').map(a => a.id)).toEqual(['a', 'b']);
  const updated = albums.map(album => album.id === 'a' ? { ...album, year: 2025 } : album);
  expect(sortLibraryAlbums(updated, 'year_desc').map(a => a.id)).toEqual(['a', 'b', 'c', 'd']);
});

it('rejects invalid and inverted ranges without treating blanks as zero', () => {
  const empty = createAlbumFilterDraft(EMPTY_ALBUM_FILTERS);
  expect(parseAlbumFilterDraft(empty)).toEqual(EMPTY_ALBUM_FILTERS);
  expect(parseAlbumFilterDraft({ ...empty, minTracks: '0', maxYear: '2000' })).toEqual({ ...EMPTY_ALBUM_FILTERS, minTracks: 0, maxYear: 2000 });
  for (const value of ['-1', '1.5', 'NaN', 'abc']) expect(parseAlbumFilterDraft({ ...empty, minTracks: value })).toBeNull();
  expect(parseAlbumFilterDraft({ ...empty, minTracks: '10', maxTracks: '9' })).toBeNull();
  expect(parseAlbumFilterDraft({ ...empty, minYear: '2020', maxYear: '2010' })).toBeNull();
  expect(parseAlbumFilterDraft({ ...empty, minYear: '0' })).toBeNull();
});

it('persists filters independently of the chosen order and clears them', () => {
  const store = useLibraryStore.getState();
  store.setAlbumSort('rating_desc');
  const filters = { ...EMPTY_ALBUM_FILTERS, minTracks: 5, maxTracks: 20, minYear: 1990, maxYear: null };
  store.setAlbumFilters(filters);
  expect(useLibraryStore.getState()).toMatchObject({ albumSort: 'rating_desc', albumFilters: filters });
  store.setAlbumFilters(EMPTY_ALBUM_FILTERS);
  expect(useLibraryStore.getState().albumFilters).toEqual(EMPTY_ALBUM_FILTERS);
});

it('combines duration in minutes and the average of rated songs, updating after edits', () => {
  const songs = [
    { album: { id: 'a' }, duration: 60, rating: 5 },
    { album: { id: 'a' }, duration: 120, rating: 3 },
    { album: { id: 'a' }, duration: 0, rating: null },
    { album: { id: 'b' }, duration: 600, rating: null },
  ];
  const filters = { ...EMPTY_ALBUM_FILTERS, minDuration: 3, maxDuration: 3, minRating: 4 };
  const stats = summarizeAlbumTracks(songs);
  expect(stats.get('a')).toEqual({ count: 3, duration: 180, ratingSum: 8, ratedCount: 2 });
  expect(matchesAlbumFilters(albums[0], stats, filters)).toBe(true);
  expect(matchesAlbumFilters(albums[1], stats, { ...EMPTY_ALBUM_FILTERS, minRating: 0 })).toBe(false);
  songs[1].rating = 1;
  expect(matchesAlbumFilters(albums[0], summarizeAlbumTracks(songs), filters)).toBe(false);
  songs[1].rating = 3; songs[1].duration = 121;
  expect(matchesAlbumFilters(albums[0], summarizeAlbumTracks(songs), filters)).toBe(false);
});

it('finds missing covers including the default placeholder, without fetching song data', () => {
  const filters = { ...EMPTY_ALBUM_FILTERS, withoutCover: true };
  for (const coverUrl of [null, '', 'null', 'file:///assets/nullcover.png', 'asset:/src_assets_images_nullcover.hash.png']) {
    expect(matchesAlbumFilters({ ...albums[0], coverUrl }, counts, filters)).toBe(true);
  }
  expect(matchesAlbumFilters({ ...albums[0], coverUrl: 'file:///my-cover.jpg' }, counts, filters)).toBe(false);
  expect(needsAlbumTrackStats(filters)).toBe(false);
  expect(needsAlbumTrackStats({ ...filters, minRating: 4 })).toBe(true);
  expect(hasAlbumFilters(EMPTY_ALBUM_FILTERS)).toBe(false);
  expect(hasAlbumFilters(filters)).toBe(true);
});

it('accepts fractional minutes and ratings with local decimal separators and validates their limits', () => {
  const empty = createAlbumFilterDraft(EMPTY_ALBUM_FILTERS);
  expect(parseAlbumFilterDraft({ ...empty, minDuration: '1,5', maxDuration: '3.5', minRating: '4,5', withoutCover: true })).toEqual({ ...EMPTY_ALBUM_FILTERS, minDuration: 1.5, maxDuration: 3.5, minRating: 4.5, withoutCover: true });
  expect(parseAlbumFilterDraft({ ...empty, minRating: '5.1' })).toBeNull();
  expect(parseAlbumFilterDraft({ ...empty, minDuration: '3', maxDuration: '2' })).toBeNull();
});

it('adds defaults to older persisted preferences without losing existing ranges', () => {
  const state = useLibraryStore.getState();
  const merge = useLibraryStore.persist.getOptions().merge!;
  const restored = merge({ albumFilters: { minTracks: 4, maxTracks: null, minYear: 1990, maxYear: null } }, state);
  expect(restored.albumFilters).toEqual({ ...EMPTY_ALBUM_FILTERS, minTracks: 4, minYear: 1990 });
});
