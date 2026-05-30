import { create } from 'zustand';

interface FolderMenuState {
    isVisible: boolean;
    selectedFolderPath: string | null;
    selectedFolderName: string | null;
    openMenu: (folderPath: string, folderName: string) => void;
    closeMenu: () => void;
}

export const useFolderMenuStore = create<FolderMenuState>((set) => ({
    isVisible: false,
    selectedFolderPath: null,
    selectedFolderName: null,
    openMenu: (folderPath, folderName) => set({
        isVisible: true,
        selectedFolderPath: folderPath,
        selectedFolderName: folderName,
    }),
    closeMenu: () => set({
        isVisible: false,
        selectedFolderPath: null,
        selectedFolderName: null,
    }),
}));
