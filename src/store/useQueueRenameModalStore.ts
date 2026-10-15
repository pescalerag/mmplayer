import { create } from 'zustand';

interface QueueRenameModalState {
    queueId: number | null;
    open: (queueId: number) => void;
    close: () => void;
}

export const useQueueRenameModalStore = create<QueueRenameModalState>(set => ({
    queueId: null,
    open: queueId => set({ queueId }),
    close: () => set({ queueId: null }),
}));
