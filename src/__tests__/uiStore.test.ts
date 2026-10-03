import {
  useUIStore,
  openCanvasManager,
  openTrackDetails,
  openNotificationSettings,
  openTrackMenu,
  openLyricsMenu,
  openAlbumMenu,
  openArtistMenu,
  openSortModal,
  openQueueSheet,
  openClearQueueSheet,
  openTagManager,
  openTagMenu,
  openPlaylistSelector,
  openPlaylistSelectorEdit,
  openPlaylistSelectorCreate,
  openPlaylistMenu,
  openFolderMenu,
  openArtistsList,
  openSleepTimer,
  openLocalCast,
  openSpeedPitch,
  openLibraryTabsOrder,
  openAppTabsOrder,
  openHomeSections,
  openSwipeAction,
  openMetadataEditor,
  openTagManagerForTrack,
  openTagManagerForAlbum,
  openPlayerMenu,
  openBatchMenu,
  openTagManagerForBatch,
  openEditAlias,
} from '../store/useUIStore';

describe('useUIStore & sheet helpers', () => {
  beforeEach(() => {
    useUIStore.getState().closeSheet();
  });

  it('handles sheet opening and closing', () => {
    const { openSheet, closeSheet } = useUIStore.getState();
    expect(useUIStore.getState().activeSheet).toBeNull();

    openSheet('player-menu');
    expect(useUIStore.getState().activeSheet).toBe('player-menu');

    closeSheet();
    expect(useUIStore.getState().activeSheet).toBeNull();
    expect(useUIStore.getState().sheetProps).toBeNull();
  });

  it('openCanvasManager opens canvas-manager with tracks array', () => {
    openCanvasManager({ id: 't1' });
    expect(useUIStore.getState().activeSheet).toBe('canvas-manager');
    expect(useUIStore.getState().sheetProps).toEqual({ tracks: [{ id: 't1' }] });

    openCanvasManager([{ id: 't1' }, { id: 't2' }]);
    expect(useUIStore.getState().sheetProps).toEqual({ tracks: [{ id: 't1' }, { id: 't2' }] });
  });

  it('openTrackDetails opens track-details sheet with track prop', () => {
    const track = { id: 'track-42', title: 'Song' };
    openTrackDetails(track);
    expect(useUIStore.getState().activeSheet).toBe('track-details');
    expect(useUIStore.getState().sheetProps).toEqual({ track });
  });

  it('openNotificationSettings opens notification-settings sheet', () => {
    openNotificationSettings();
    expect(useUIStore.getState().activeSheet).toBe('notification-settings');
  });

  it('tests various other sheet openers for full coverage', () => {
    openTrackMenu({ id: '1' }, {}, 'p1');
    expect(useUIStore.getState().activeSheet).toBe('track-menu');

    openLyricsMenu({ id: '1' });
    expect(useUIStore.getState().activeSheet).toBe('lyrics-menu');

    openAlbumMenu({ id: '1' });
    expect(useUIStore.getState().activeSheet).toBe('album-menu');

    openArtistMenu({ id: '1' });
    expect(useUIStore.getState().activeSheet).toBe('artist-menu');

    openSortModal();
    expect(useUIStore.getState().activeSheet).toBe('sort-modal');

    openQueueSheet();
    expect(useUIStore.getState().activeSheet).toBe('queue');

    openClearQueueSheet();
    expect(useUIStore.getState().activeSheet).toBe('clear-queue');

    openTagManager('track', '1', 'Title');
    expect(useUIStore.getState().activeSheet).toBe('tag-manager');

    openTagMenu({ id: '1' });
    expect(useUIStore.getState().activeSheet).toBe('tag-menu');

    openPlaylistSelector({ id: '1' });
    expect(useUIStore.getState().activeSheet).toBe('playlist-selector');

    openPlaylistSelectorEdit({ id: 'pl-1' });
    expect(useUIStore.getState().activeSheet).toBe('playlist-selector');

    openPlaylistSelectorCreate();
    expect(useUIStore.getState().activeSheet).toBe('playlist-selector');

    openPlaylistMenu({ id: 'pl-1' });
    expect(useUIStore.getState().activeSheet).toBe('playlist-menu');

    openFolderMenu('/path/to/folder');
    expect(useUIStore.getState().activeSheet).toBe('folder-menu');

    openArtistsList([]);
    expect(useUIStore.getState().activeSheet).toBe('artists-list');

    openSleepTimer();
    expect(useUIStore.getState().activeSheet).toBe('sleep-timer');

    openLocalCast();
    expect(useUIStore.getState().activeSheet).toBe('local-cast');

    openSpeedPitch();
    expect(useUIStore.getState().activeSheet).toBe('speed-pitch');

    openLibraryTabsOrder();
    expect(useUIStore.getState().activeSheet).toBe('library-tabs-order');

    openAppTabsOrder();
    expect(useUIStore.getState().activeSheet).toBe('app-tabs-order');

    openHomeSections();
    expect(useUIStore.getState().activeSheet).toBe('home-sections');

    openSwipeAction('left');
    expect(useUIStore.getState().activeSheet).toBe('swipe-action');

    openMetadataEditor([]);
    expect(useUIStore.getState().activeSheet).toBe('metadata-editor');

    openTagManagerForTrack({ id: '1', title: 't' });
    expect(useUIStore.getState().activeSheet).toBe('tag-manager');

    openTagManagerForAlbum({ id: '1', title: 'a' });
    expect(useUIStore.getState().activeSheet).toBe('tag-manager');

    openPlayerMenu();
    expect(useUIStore.getState().activeSheet).toBe('player-menu');

    openBatchMenu([]);
    expect(useUIStore.getState().activeSheet).toBe('batch-menu');

    openTagManagerForBatch([]);
    expect(useUIStore.getState().activeSheet).toBe('tag-manager');

    openEditAlias();
    expect(useUIStore.getState().activeSheet).toBe('edit-alias');
  });
});
