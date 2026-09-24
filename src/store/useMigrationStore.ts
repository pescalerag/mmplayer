import { create } from 'zustand';

export type MigrationPhase =
    | 'searching'
    | 'indexing'
    | 'reconciling'
    | 'confirm_delete'
    | 'cleaning'
    | 'done';

export type MigrationAction = 'retry' | 'delete' | 'keep';

interface MigrationState {
    isVisible: boolean;
    orphanCount: number;
    phase: MigrationPhase;
    phaseMessage: string;
    unresolvedCount: number;
    resolveConfirm: ((action: MigrationAction) => void) | null;
    startMigration: (count: number, initialMessage?: string) => void;
    setPhase: (phase: MigrationPhase, message?: string) => void;
    promptConfirmDelete: (unresolvedCount: number) => Promise<MigrationAction>;
    handleConfirmResponse: (action: MigrationAction) => void;
    finishMigration: () => void;
    close: () => void;
}

export const useMigrationStore = create<MigrationState>((set, get) => ({
    isVisible: false,
    orphanCount: 0,
    phase: 'searching',
    phaseMessage: '',
    unresolvedCount: 0,
    resolveConfirm: null,

    startMigration: (count: number, initialMessage: string = '') => set({
        isVisible: true,
        orphanCount: count,
        phase: 'searching',
        phaseMessage: initialMessage,
        unresolvedCount: 0,
        resolveConfirm: null,
    }),

    setPhase: (phase: MigrationPhase, message?: string) => set((state) => ({
        phase,
        ...(message !== undefined ? { phaseMessage: message } : {}),
    })),

    promptConfirmDelete: (unresolvedCount: number) => {
        return new Promise<MigrationAction>((resolve) => {
            set({
                phase: 'confirm_delete',
                unresolvedCount,
                resolveConfirm: resolve,
            });
        });
    },

    handleConfirmResponse: (action: MigrationAction) => {
        const { resolveConfirm } = get();
        if (resolveConfirm) {
            resolveConfirm(action);
        }
        set({
            resolveConfirm: null,
            phase: action === 'retry' ? 'searching' : 'cleaning',
        });
    },

    finishMigration: () => {
        set({
            phase: 'done',
        });
        setTimeout(() => {
            get().close();
        }, 600);
    },

    close: () => set({
        isVisible: false,
        orphanCount: 0,
        phase: 'searching',
        phaseMessage: '',
        unresolvedCount: 0,
        resolveConfirm: null,
    }),
}));
