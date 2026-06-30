import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { database } from '../database';
import { ScannerService } from './ScannerService';
import { useBackupStore } from '../store/useBackupStore';
import { usePlayerStore } from '../store/usePlayerStore';

const COLLECTIONS_TO_BACKUP = [
    'tracks',
    'albums',
    'artists',
    'playlists',
    'playlist_tracks',
    'tags',
    'track_tags',
    'album_tags',
    'track_collaborators',
    'search_history',
    'playback_history'
];

export const BackupService = {
    exportDatabase: async () => {
        const store = useBackupStore.getState();
        store.startExport('Preparando datos para la copia de seguridad...');
        try {
            const backupData: Record<string, any[]> = {};
            
            for (const collectionName of COLLECTIONS_TO_BACKUP) {
                store.startExport(`Exportando tabla ${collectionName}...`);
                const collection = database.collections.get(collectionName);
                const records = await collection.query().fetch();
                // Extraemos solo la data cruda (_raw)
                backupData[collectionName] = records.map(r => r._raw);
            }

            store.startExport('Escribiendo archivo de copia de seguridad...');
            const jsonString = JSON.stringify(backupData, null, 2);
            const fileUri = FileSystem.cacheDirectory + 'backup_music_app.json';
            await FileSystem.writeAsStringAsync(fileUri, jsonString, { encoding: FileSystem.EncodingType.UTF8 });

            // Verificar si el compartir está disponible en la plataforma
            const isSharingAvailable = await Sharing.isAvailableAsync();
            if (!isSharingAvailable) {
                throw new Error('El servicio de compartir no está disponible en este dispositivo.');
            }

            store.startExport('Abriendo selector para guardar copia...');
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/json',
                dialogTitle: 'Exportar Copia de Seguridad',
                UTI: 'public.json'
            });

            store.setSuccess('Copia de seguridad exportada correctamente.');
        } catch (error: any) {
            console.error('Error al exportar base de datos:', error);
            store.setError(error?.message || String(error) || 'Error desconocido al exportar.');
        }
    },

    importDatabase: async () => {
        const store = useBackupStore.getState();
        try {
            const pickerResult = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
                // El usuario canceló la selección del documento
                return;
            }

            store.startImport('Deteniendo reproductor de música...');
            // Detener el reproductor para evitar inconsistencias con canciones viejas
            await usePlayerStore.getState().clearPlayer().catch(err => {
                console.warn('No se pudo detener el reproductor durante la importación:', err);
            });

            store.startImport('Leyendo archivo de copia de seguridad...');
            const fileAsset = pickerResult.assets[0];
            const fileContent = await FileSystem.readAsStringAsync(fileAsset.uri, { encoding: FileSystem.EncodingType.UTF8 });

            store.startImport('Procesando datos del archivo...');
            const backupData = JSON.parse(fileContent);

            // Validar formato del objeto
            if (!backupData || typeof backupData !== 'object') {
                throw new Error('El archivo no tiene un formato JSON válido.');
            }

            // Validar presencia de colecciones
            const hasRequiredCollections = COLLECTIONS_TO_BACKUP.some(col => Array.isArray(backupData[col]));
            if (!hasRequiredCollections) {
                throw new Error('El archivo seleccionado no contiene datos compatibles de copia de seguridad.');
            }

            store.startImport('Limpiando base de datos actual...');
            await database.write(async () => {
                await database.unsafeResetDatabase();
            });

            store.startImport('Restaurando datos desde la copia de seguridad...');
            const batchOperations: any[] = [];

            await database.write(async () => {
                for (const collectionName of COLLECTIONS_TO_BACKUP) {
                    const items = backupData[collectionName];
                    if (!Array.isArray(items)) continue;

                    const collection = database.collections.get(collectionName);
                    for (const item of items) {
                        const op = collection.prepareCreate((record: any) => {
                            Object.assign(record._raw, item);
                        });
                        batchOperations.push(op);
                    }
                }

                if (batchOperations.length > 0) {
                    store.startImport(`Guardando ${batchOperations.length} registros en la base de datos...`);
                    await database.batch(batchOperations);
                }
            });

            store.setReconciling('Reconciliando biblioteca local (buscando archivos físicos y eliminando huérfanos)...');
            
            // Sincronizar archivos locales
            await ScannerService.syncLibrary((current, total, phase) => {
                store.setReconciling(`Reconciliando: ${phase} ${current > 0 ? `(${current}/${total})` : ''}`);
            }, true);

            store.setSuccess('Copia de seguridad restaurada y biblioteca reconciliada con éxito.');
        } catch (error: any) {
            console.error('Error al importar base de datos:', error);
            store.setError(error?.message || String(error) || 'Error desconocido al importar.');
        }
    }
};
