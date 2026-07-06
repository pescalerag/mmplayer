import { create } from 'zustand';
import { useUIStore } from './useUIStore';

interface SwipeActionSheetState {
    isVisible: boolean;
    currentSwipeTarget: 'left' | 'right' | null;
    openSheet: (target: 'left' | 'right') => void;
    closeSheet: () => void;
}

export const useSwipeActionSheetStore = create<SwipeActionSheetState>((set) => ({
    isVisible: false,
    currentSwipeTarget: null,
    openSheet: (target) => {
        useUIStore.getState().openSheet('swipe-action', { target });
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'swipe-action';
    const props = isVisible ? state.sheetProps : {};
    useSwipeActionSheetStore.setState({
        isVisible,
        currentSwipeTarget: props.target || null,
    });
});
