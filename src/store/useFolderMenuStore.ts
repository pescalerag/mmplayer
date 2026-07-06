import { create } from 'zustand';
import { useUIStore } from './useUIStore';

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
    openMenu: (folderPath, folderName) => {
        useUIStore.getState().openSheet('folder-menu', { folderPath, folderName });
    },
    closeMenu: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'folder-menu';
    const props = isVisible ? state.sheetProps : {};
    useFolderMenuStore.setState({
        isVisible,
        selectedFolderPath: props.folderPath || null,
        selectedFolderName: props.folderName || null,
    });
});
