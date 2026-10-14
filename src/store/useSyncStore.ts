import { create } from 'zustand';

interface SyncState {
    isScanning: boolean;
    isSilentScan: boolean;
    isDownloadingArtistImages: boolean;
    isDownloadingAlbumCovers: boolean;
    albumCoverProgress: { current: number; total: number };
    setIsDownloadingAlbumCovers: (value: boolean) => void;
    setAlbumCoverProgress: (current: number, total: number) => void;
    setIsScanning: (isScanning: boolean, isSilentScan?: boolean) => void;
    setIsDownloadingArtistImages: (value: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isScanning: false,
    isSilentScan: false,
    isDownloadingArtistImages: false,
    isDownloadingAlbumCovers: false,
    albumCoverProgress: { current: 0, total: 0 },
    setIsDownloadingAlbumCovers: (value) => set({ isDownloadingAlbumCovers: value }),
    setAlbumCoverProgress: (current, total) => set({ albumCoverProgress: { current, total } }),
    setIsScanning: (isScanning, isSilentScan = false) => set({ isScanning, isSilentScan }),
    setIsDownloadingArtistImages: (value) => set({ isDownloadingArtistImages: value }),
}));
