import { create } from 'zustand';

export type BackupMode = 'idle' | 'exporting' | 'importing' | 'reconciling' | 'success' | 'error';

interface BackupState {
    isVisible: boolean;
    mode: BackupMode;
    progressMessage: string;
    startExport: (msg?: string) => void;
    startImport: (msg?: string) => void;
    setReconciling: (msg?: string) => void;
    setSuccess: (msg?: string) => void;
    setError: (msg: string) => void;
    close: () => void;
}

export const useBackupStore = create<BackupState>((set) => ({
    isVisible: false,
    mode: 'idle',
    progressMessage: '',
    startExport: (msg = 'Exportando base de datos...') => set({
        isVisible: true,
        mode: 'exporting',
        progressMessage: msg
    }),
    startImport: (msg = 'Importando copia de seguridad...') => set({
        isVisible: true,
        mode: 'importing',
        progressMessage: msg
    }),
    setReconciling: (msg = 'Reconciliando biblioteca local...') => set({
        mode: 'reconciling',
        progressMessage: msg
    }),
    setSuccess: (msg = '¡Operación completada con éxito!') => set({
        mode: 'success',
        progressMessage: msg
    }),
    setError: (msg) => set({
        mode: 'error',
        progressMessage: msg
    }),
    close: () => set({
        isVisible: false,
        mode: 'idle',
        progressMessage: ''
    })
}));
