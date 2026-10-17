import { buildLibraryFilterIndex, createSectionDraft, dateBoundary, EMPTY_SECTION_FILTERS, fileFormat, FilterTrack, filteredTrackContext, hasSectionFilters, matchesArtistFilters, matchesFolderFilters, matchesPlaylistFilters, matchesTrackFilters, parseSectionDraft } from '../utils/libraryFilters';
import { useLibraryStore } from '../store/useLibraryStore';

const song = (id: string, overrides: Partial<FilterTrack> = {}): FilterTrack => ({
  id, album: { id: 'album' }, artist: { id: 'artist' }, fileUrl: `file:///music/${id}.flac`, duration: 120,
  rating: 4, genre: 'Rock', isFavorite: true, lyricsLRC: '[00:01]Line', lastModified: 1, ...overrides,
});
const songs = [song('a'), song('b', { duration: 180, rating: null, isFavorite: false, lyricsLRC: null, fileUrl: 'file:///music/b.MP3?cache=2', genre: 'Electrónica' })];
const history = [
  { itemType: 'track', itemId: 'a', playedAt: new Date(2026, 9, 1, 0) },
  { itemType: 'track', itemId: 'a', playedAt: new Date(2026, 9, 1, 23, 59, 59) },
  { itemType: 'track', itemId: 'b', playedAt: new Date(2026, 8, 30) },
  { itemType: 'album', itemId: 'b', playedAt: new Date(2026, 9, 1) },
];
const index = () => buildLibraryFilterIndex(songs, [{ id: 'album', artist: { id: 'artist' } }], [
  { playlist: { id: 'playlist' }, track: { id: 'a' } },
  { playlist: { id: 'playlist' }, track: { id: 'a' } },
  { playlist: { id: 'playlist' }, track: { id: 'b' } },
  { playlist: { id: 'playlist' }, track: { id: 'deleted' } },
], [{ artist: { id: 'guest' }, track: { id: 'a' } }, { artist: { id: 'guest' }, track: { id: 'a' } }], history, { ...EMPTY_SECTION_FILTERS, playedFrom: '2026-10-01', playedTo: '2026-10-01' });

it('combines favorite, rating, duration, lyrics, genre and file format filters', () => {
  const filters = { ...EMPTY_SECTION_FILTERS, favorite: 'yes' as const, minRating: 4, maxRating: 4, minDuration: 2, maxDuration: 2, lyrics: 'yes' as const, genre: 'rock', formats: '.FLAC, mp3' };
  expect(matchesTrackFilters(songs[0], filters, index())).toBe(true);
  expect(matchesTrackFilters(songs[1], filters, index())).toBe(false);
  expect(matchesTrackFilters(songs[1], { ...EMPTY_SECTION_FILTERS, genre: 'electronica', formats: 'mp3', lyrics: 'no' }, index())).toBe(true);
  expect(matchesTrackFilters(songs[1], { ...EMPTY_SECTION_FILTERS, minRating: 0 }, index())).toBe(false);
  expect(fileFormat('file:///music/hello%20world.FLAC')).toBe('flac');
});

it('uses all recorded track history for never-played, irrespective of the artist date range', () => {
  const data = index();
  expect(data.played.has('b')).toBe(true);
  expect(matchesTrackFilters(songs[1], { ...EMPTY_SECTION_FILTERS, neverPlayed: true }, data)).toBe(false);
  expect(matchesTrackFilters(song('new'), { ...EMPTY_SECTION_FILTERS, neverPlayed: true }, data)).toBe(true);
});

it('counts unique artist songs and albums including collaborators and inclusive date boundaries', () => {
  const data = index();
  expect(data.artists.get('artist')?.tracks.size).toBe(2);
  expect(data.artists.get('artist')?.albums.size).toBe(1);
  expect(data.artists.get('artist')?.plays).toBe(2);
  expect(data.artists.get('guest')?.tracks.size).toBe(1);
  expect(data.artists.get('guest')?.plays).toBe(2);
  const filters = { ...EMPTY_SECTION_FILTERS, minAlbums: 1, maxTracks: 2, minPlays: 2, maxPlays: 2, image: 'no' as const };
  expect(matchesArtistFilters({ id: 'artist', imageUrl: null }, filters, data)).toBe(true);
  expect(matchesArtistFilters({ id: 'artist', imageUrl: 'file:///artist.jpg' }, filters, data)).toBe(false);
  expect(matchesArtistFilters({ id: 'absent', imageUrl: null }, { ...EMPTY_SECTION_FILTERS, playedFrom: '2026-10-01' }, data)).toBe(false);
  expect(matchesArtistFilters({ id: 'absent', imageUrl: null }, { ...EMPTY_SECTION_FILTERS, maxPlays: 0 }, data)).toBe(true);
});

it('counts playlist duplicates, ignores deleted tracks and filters custom artwork and creation dates', () => {
  const data = index();
  expect(data.playlists.get('playlist')).toEqual({ count: 3, duration: 420 });
  const playlist = { id: 'playlist', coverCustomUrl: 'file:///custom.jpg', createdAt: new Date(2026, 9, 1, 23, 59, 59).getTime() };
  expect(matchesPlaylistFilters(playlist, { ...EMPTY_SECTION_FILTERS, minTracks: 3, maxDuration: 7, customCover: 'yes', createdFrom: '2026-10-01', createdTo: '2026-10-01' }, data)).toBe(true);
  expect(matchesPlaylistFilters(playlist, { ...EMPTY_SECTION_FILTERS, minDuration: 8 }, data)).toBe(false);
  expect(matchesPlaylistFilters({ id: 'automatic' }, { ...EMPTY_SECTION_FILTERS, minTracks: 2 }, data, songs)).toBe(true);
  expect(matchesPlaylistFilters({ id: 'automatic' }, { ...EMPTY_SECTION_FILTERS, createdFrom: '2026-10-01' }, data, songs)).toBe(false);
});

it('filters folders by total file size, count and any requested format without treating missing sizes as zero', () => {
  const data = index(); data.sizes.set('a', 1024 * 1024); data.sizes.set('b', 2 * 1024 * 1024);
  const filters = { ...EMPTY_SECTION_FILTERS, minTracks: 2, maxTracks: 2, minSize: 3, maxSize: 3, formats: 'mp3' };
  expect(matchesFolderFilters(songs, filters, data)).toBe(true);
  expect(matchesFolderFilters(songs, { ...filters, formats: 'wav' }, data)).toBe(false);
  data.sizes.set('b', null);
  expect(matchesFolderFilters(songs, { ...EMPTY_SECTION_FILTERS, maxSize: 100 }, data)).toBe(false);
  expect(matchesFolderFilters(songs, { ...EMPTY_SECTION_FILTERS, formats: 'flac' }, data)).toBe(true);
});

it('validates calendar dates, numeric bounds and local decimals for every section', () => {
  const empty = createSectionDraft(EMPTY_SECTION_FILTERS);
  expect(parseSectionDraft('tracks', { ...empty, minRating: '4,5', maxRating: '5', formats: '.FLAC, MP3', neverPlayed: true })).toMatchObject({ minRating: 4.5, maxRating: 5, formats: 'flac, mp3', neverPlayed: true });
  expect(parseSectionDraft('tracks', { ...empty, minRating: '6' })).toBeNull();
  expect(parseSectionDraft('artists', { ...empty, minTracks: '1.5' })).toBeNull();
  expect(parseSectionDraft('playlists', { ...empty, createdFrom: '2026-02-30' })).toBeNull();
  expect(parseSectionDraft('artists', { ...empty, playedFrom: '2026-10-02', playedTo: '2026-10-01' })).toBeNull();
  expect(parseSectionDraft('folders', { ...empty, minSize: '3', maxSize: '2' })).toBeNull();
  expect(parseSectionDraft('folders', { ...empty, formats: ', , ' })).toBeNull();
  expect(dateBoundary('2024-02-29')).not.toBeNull();
  expect(dateBoundary('2025-02-29')).toBeNull();
});

it('persists and clears filters independently for each section and upgrades older storage', () => {
  const store = useLibraryStore.getState();
  store.setSectionFilters('tracks', { ...EMPTY_SECTION_FILTERS, neverPlayed: true });
  store.setSectionFilters('playlists', { ...EMPTY_SECTION_FILTERS, minTracks: 5 });
  store.setSectionFilters('tracks', EMPTY_SECTION_FILTERS);
  expect(hasSectionFilters(useLibraryStore.getState().sectionFilters.tracks)).toBe(false);
  expect(useLibraryStore.getState().sectionFilters.playlists.minTracks).toBe(5);
  const merge = useLibraryStore.persist.getOptions().merge!;
  expect(merge({ albumSort: 'year_desc' }, store).sectionFilters.artists).toEqual(EMPTY_SECTION_FILTERS);
});

it('keeps filtered playback separate from an existing unfiltered queue', () => {
  const context = filteredTrackContext({ ...EMPTY_SECTION_FILTERS, neverPlayed: true });
  expect(filteredTrackContext(EMPTY_SECTION_FILTERS)).toBe('library-all-tracks');
  expect(context).not.toBe('library-all-tracks');
  expect(context).not.toBe(filteredTrackContext({ ...EMPTY_SECTION_FILTERS, favorite: 'yes' }));
  expect(context).toBe(filteredTrackContext({ ...EMPTY_SECTION_FILTERS, neverPlayed: true }));
});
