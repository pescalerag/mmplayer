import { create } from 'zustand';

interface SyncState {
    isScanning: boolean;
    isSilentScan: boolean;
    setIsScanning: (isScanning: boolean, isSilentScan?: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isScanning: false,
    isSilentScan: false,
    setIsScanning: (isScanning, isSilentScan = false) => set({ isScanning, isSilentScan }),
}));
