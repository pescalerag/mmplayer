import { create } from 'zustand';

interface SyncState {
    isScanning: boolean;
    setIsScanning: (isScanning: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isScanning: false,
    setIsScanning: (isScanning) => set({ isScanning }),
}));
