import { create } from 'zustand';

interface ZipState {
    isVisible: boolean;
    progressMessage: string;
    showProgress: (msg: string) => void;
    hideProgress: () => void;
}

export const useZipStore = create<ZipState>((set) => ({
    isVisible: false,
    progressMessage: '',
    showProgress: (msg) => set({ isVisible: true, progressMessage: msg }),
    hideProgress: () => set({ isVisible: false, progressMessage: '' })
}));
