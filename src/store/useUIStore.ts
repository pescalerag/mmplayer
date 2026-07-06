import { create } from 'zustand';

export type SheetType =
  | 'track-menu'
  | 'album-menu'
  | 'artist-menu'
  | 'folder-menu'
  | 'playlist-menu'
  | 'sleep-timer'
  | 'speed-pitch'
  | 'queue'
  | 'tag-menu'
  | 'lyrics-menu'
  | 'artists-list'
  | 'local-cast'
  | 'library-tabs-order'
  | 'app-tabs-order'
  | 'home-sections'
  | 'swipe-action'
  | 'sort-modal'
  | 'metadata-editor'
  | 'playlist-selector'
  | 'tag-manager'
  | 'tag-form';

interface UIState {
  activeSheet: SheetType | null;
  sheetProps: any;
  openSheet: (type: SheetType, props?: any) => void;
  closeSheet: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeSheet: null,
  sheetProps: null,
  openSheet: (type, props = {}) => set({ activeSheet: type, sheetProps: props }),
  closeSheet: () => set({ activeSheet: null, sheetProps: null }),
}));
