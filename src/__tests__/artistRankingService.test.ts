import { Subject } from 'rxjs';
import { database } from '../database';
import { ArtistRankingService } from '../services/ArtistRankingService';
import { AlbumRankingService } from '../services/AlbumRankingService';
import { LibraryFilterService } from '../services/LibraryFilterService';
import { EMPTY_SECTION_FILTERS } from '../utils/libraryFilters';
import { useSettingsStore } from '../store/useSettingsStore';

it('shares three queries across both rankings and artist filters, reacts to exclusions without fetching and releases observers', () => {
  const sources: Record<string, Subject<any[]>> = { tracks: new Subject(), albums: new Subject(), track_collaborators: new Subject() };
  const query = jest.fn();
  (database.get as jest.Mock).mockImplementation(table => ({ query: () => {
    query(table);
    return { observeWithColumns: () => sources[table] };
  } }));
  const excluded = useSettingsStore.getState().excludedSongs;
  useSettingsStore.setState({ excludedSongs: [] });
  const artist = jest.fn(); const album = jest.fn();
  const a = ArtistRankingService.observe().subscribe(artist);
  const b = AlbumRankingService.observe().subscribe(album);
  const c = LibraryFilterService.observe('artists', { ...EMPTY_SECTION_FILTERS, minTracks: 1 }).subscribe();
  try {
    expect(query.mock.calls.map(call => call[0]).sort()).toEqual(['albums', 'track_collaborators', 'tracks']);
    const song = { id: 'song', rating: 4, duration: 100, fileUrl: 'song.mp3', album: { id: 'album' }, artist: { id: 'artist' }, albumId: 'album', artistId: 'artist' };
    sources.albums.next([{ id: 'album', title: 'Album', isPinned: false, artist: { id: 'artist' }, artistId: 'artist' }]);
    sources.track_collaborators.next([{ artist: { id: 'guest' }, track: { id: 'song' }, artistId: 'guest', trackId: 'song' }]);
    sources.tracks.next([song]);
    expect(artist.mock.lastCall[0].get('guest').average).toBe(4);
    expect(artist.mock.lastCall[0].get('artist').average).toBe(4);
    expect(album.mock.lastCall[0][0].average).toBe(4);
    song.rating = 5; sources.tracks.next([song]);
    expect(artist.mock.lastCall[0].get('guest').average).toBe(5);
    useSettingsStore.setState({ excludedSongs: ['song.mp3'] });
    expect(artist.mock.lastCall[0].size).toBe(0);
    expect(album.mock.lastCall[0][0].average).toBeNull();
    useSettingsStore.setState({ excludedSongs: [] });
    expect(artist.mock.lastCall[0].get('artist').average).toBe(5);
    expect(query).toHaveBeenCalledTimes(3);
    a.unsubscribe(); b.unsubscribe();
    expect(sources.tracks.observed).toBe(true);
  } finally {
    a.unsubscribe(); b.unsubscribe(); c.unsubscribe();
    useSettingsStore.setState({ excludedSongs: excluded });
  }
  expect(sources.tracks.observed).toBe(false);
  expect(sources.albums.observed).toBe(false);
  expect(sources.track_collaborators.observed).toBe(false);
});
