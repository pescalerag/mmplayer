import { create } from 'zustand';

export interface ToastAction {
    text: string;
    onPress: () => void;
    color?: string;
}

interface ToastState {
    visible: boolean;
    message: string;
    icon: string;
    color: string;
    action?: ToastAction | null;
    showToast: (
        message: string,
        icon?: string,
        color?: string,
        action?: ToastAction | null,
        duration?: number
    ) => void;
    hideToast: () => void;
}

let timeoutId: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
    visible: false,
    message: '',
    icon: 'checkmark-circle',
    color: '#22C55E', // Default to green
    action: null,
    showToast: (
        message,
        icon = 'checkmark-circle',
        color = '#22C55E',
        action = null,
        duration = 2500
    ) => {
        if (timeoutId) clearTimeout(timeoutId);

        set({ visible: true, message, icon, color, action });

        timeoutId = setTimeout(() => {
            set({ visible: false, action: null });
        }, duration);
    },
    hideToast: () => {
        if (timeoutId) clearTimeout(timeoutId);
        set({ visible: false, action: null });
    },
}));
