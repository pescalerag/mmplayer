import { create } from 'zustand';
import { normalizeOpaqueColor } from '../utils/customColors';

interface ColorPickerRequest {
    readonly id: number;
    readonly title: string;
    readonly initialColor: string;
    readonly onConfirm: (color: string) => void;
}

interface ColorPickerModalState {
    request: ColorPickerRequest | null;
    open: (options: Omit<ColorPickerRequest, 'id'>) => void;
    close: () => void;
    confirm: (color: string, requestId: number) => void;
}

let nextRequestId = 0;
export const useColorPickerModalStore = create<ColorPickerModalState>((set, get) => ({
    request: null,
    open: options => set({ request: { ...options, initialColor: normalizeOpaqueColor(options.initialColor), id: ++nextRequestId } }),
    close: () => set({ request: null }),
    confirm: (color, requestId) => {
        const request = get().request;
        if (!request || request.id !== requestId) return;
        set({ request: null });
        request.onConfirm(normalizeOpaqueColor(color));
    },
}));

export const openColorPickerModal = (options: Omit<ColorPickerRequest, 'id'>) => useColorPickerModalStore.getState().open(options);
