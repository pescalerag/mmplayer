import { useLibraryStore } from '../store/useLibraryStore';

it('persists both album rating orders without changing the other library preferences', () => {
  const store = useLibraryStore.getState();
  store.setArtistSort('name_desc');
  store.setTrackSort('duration_desc');
  store.setPlaylistSort('recent_asc');
  store.setArtistFilter('all');
  store.setPlaylistFilter('smart');
  store.setAlbumSort('rating_desc');
  expect(useLibraryStore.getState()).toMatchObject({ albumSort: 'rating_desc', artistSort: 'name_desc', trackSort: 'duration_desc', playlistSort: 'recent_asc', artistFilter: 'all', playlistFilter: 'smart' });
  store.setAlbumSort('rating_asc');
  expect(useLibraryStore.getState().albumSort).toBe('rating_asc');
  expect(useLibraryStore.persist.getOptions().name).toBe('library-storage');
});
