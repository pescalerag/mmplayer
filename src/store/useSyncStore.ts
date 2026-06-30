import { create } from 'zustand';

interface SyncState {
    isScanning: boolean;
    isSilentScan: boolean;
    isDownloadingArtistImages: boolean;
    setIsScanning: (isScanning: boolean, isSilentScan?: boolean) => void;
    setIsDownloadingArtistImages: (value: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isScanning: false,
    isSilentScan: false,
    isDownloadingArtistImages: false,
    setIsScanning: (isScanning, isSilentScan = false) => set({ isScanning, isSilentScan }),
    setIsDownloadingArtistImages: (value) => set({ isDownloadingArtistImages: value }),
}));
