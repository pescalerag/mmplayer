import { create } from 'zustand';

interface LyricsSyncState {
    isSyncing: boolean;
    totalToFetch: number;
    currentProgress: number;
    startSync: (total: number) => void;
    updateProgress: (progress: number) => void;
    stopSync: () => void;
}

export const useLyricsSyncStore = create<LyricsSyncState>((set) => ({
    isSyncing: false,
    totalToFetch: 0,
    currentProgress: 0,
    startSync: (total) => set({ isSyncing: true, totalToFetch: total, currentProgress: 0 }),
    updateProgress: (progress) => set({ currentProgress: progress }),
    stopSync: () => set({ isSyncing: false, totalToFetch: 0, currentProgress: 0 }),
}));
