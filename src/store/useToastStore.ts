import { create } from 'zustand';

interface ToastState {
    visible: boolean;
    message: string;
    icon: string;
    color: string;
    showToast: (message: string, icon?: string, color?: string) => void;
    hideToast: () => void;
}

let timeoutId: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
    visible: false,
    message: '',
    icon: 'checkmark-circle',
    color: '#22C55E', // Default to green
    showToast: (message, icon = 'checkmark-circle', color = '#22C55E') => {
        if (timeoutId) clearTimeout(timeoutId);
        
        set({ visible: true, message, icon, color });
        
        timeoutId = setTimeout(() => {
            set({ visible: false });
        }, 2500);
    },
    hideToast: () => {
        if (timeoutId) clearTimeout(timeoutId);
        set({ visible: false });
    },
}));
