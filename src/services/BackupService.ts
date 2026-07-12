import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import RNRestart from 'react-native-restart';
import { database } from '../database';
import { useBackupStore } from '../store/useBackupStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { ScannerService } from './ScannerService';
import i18n from '../constants/i18n';

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

// ─────────────────────────────────────────────────────────────
// Helpers de encoding: writeAsStringAsync con EncodingType.UTF8
// en Android no codifica correctamente multi-byte (caracteres
// acentuados, CJK, emoji…). La solución es codificar el JSON
// como Base64 puro (ASCII seguro) antes de escribirlo, y luego
// decodificarlo simétricamente al leer.
// ─────────────────────────────────────────────────────────────

/** Convierte una cadena JS (UTF-16) a una cadena Base64 que preserve UTF-8. */
function utf8StringToBase64(str: string): string {
    // encodeURIComponent convierte a %XX escapes (UTF-8 bytes)
    // luego los reconstruimos como chars de 8 bits para pasarlos a btoa()
    const utf8Bytes = encodeURIComponent(str).replace(
        /%([0-9A-F]{2})/gi,
        (_match, hex) => String.fromCharCode(parseInt(hex, 16))
    );
    return btoa(utf8Bytes);
}

/** Decodifica un string Base64 (generado por utf8StringToBase64) de vuelta a UTF-8. */
function base64ToUtf8String(base64: string): string {
    const binary = atob(base64);
    const pct = binary
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('');
    return decodeURIComponent(pct);
}

/** 
 * Lee el contenido de un archivo de backup y devuelve el string JSON.
 * Detecta automáticamente si el archivo es Base64 (nuevo formato) o plain-JSON (legado).
 */
async function readBackupFile(uri: string): Promise<string> {
    // Leemos los bytes como Base64 (el encoding más seguro en Android)
    const rawBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    // Intentar decodificar como Base64→UTF-8 (nuevo formato)
    let decoded: string;
    try {
        decoded = base64ToUtf8String(rawBase64);
        // Si el resultado empieza con '{' es JSON válido → nuevo formato
        const trimmed = decoded.trimStart();
        if (trimmed.startsWith('{')) {
            return trimmed;
        }
    } catch {
        // La decodificación base64 falló; caemos al legado
    }

    // Legado: el archivo ya era plain-UTF-8 (o Windows guardó con BOM)
    // Lo leemos directamente como UTF-8
    let plain = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
    });
    if (plain.charCodeAt(0) === 0xFEFF) {
        plain = plain.slice(1); // eliminar BOM
    }
    return plain.trim();
}

// ─────────────────────────────────────────────────────────────

export const BackupService = {
    exportDatabase: async () => {
        const store = useBackupStore.getState();
        store.startExport(i18n.t('backup.preparing'));
        try {
            const backupData: Record<string, any[]> = {};

            for (const collectionName of COLLECTIONS_TO_BACKUP) {
                store.startExport(i18n.t('backup.exporting_table', { table: collectionName }));
                const collection = database.collections.get(collectionName);
                const records = await collection.query().fetch();
                // Extraemos solo la data cruda (_raw)
                backupData[collectionName] = records.map(r => r._raw);
            }

            store.startExport(i18n.t('backup.writing_file'));
            const jsonString = JSON.stringify(backupData, null, 2);

            // ✅ Usamos Base64 para garantizar que todos los caracteres
            //    (acentos, CJK, emoji…) se preserven en Android.
            const base64Content = utf8StringToBase64(jsonString);
            const fileUri = FileSystem.cacheDirectory + 'backup_music_app.json';
            await FileSystem.writeAsStringAsync(fileUri, base64Content, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // Verificar si el compartir está disponible en la plataforma
            const isSharingAvailable = await Sharing.isAvailableAsync();
            if (!isSharingAvailable) {
                throw new Error(i18n.t('backup.sharing_unavailable'));
            }

            store.startExport(i18n.t('backup.opening_share'));
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/json',
                dialogTitle: i18n.t('backup.export_title'),
                UTI: 'public.json',
            });

            store.setSuccess(i18n.t('backup.export_success'));
        } catch (error: any) {
            console.error('Error al exportar base de datos:', error);
            store.setError(error?.message || String(error) || i18n.t('backup.export_error'));
        }
    },

    importDatabase: async () => {
        const store = useBackupStore.getState();
        const cachedUri = FileSystem.cacheDirectory + 'import_backup_tmp.json';
        try {
            const pickerResult = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
            });

            if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
                return;
            }

            store.startImport(i18n.t('backup.stopping_player'));
            await usePlayerStore.getState().clearPlayer().catch(err => {
                console.warn('No se pudo detener el reproductor durante la importación:', err);
            });

            store.startImport(i18n.t('backup.reading_file'));
            const fileAsset = pickerResult.assets[0];

            // Copiamos primero a cache para obtener un file:// URI limpio.
            // Las URIs content:// de Android no siempre son legibles directamente.
            await FileSystem.copyAsync({ from: fileAsset.uri, to: cachedUri });

            // ✅ Usamos nuestro helper que detecta Base64 (nuevo) o plain-UTF-8 (legado)
            const fileContent = await readBackupFile(cachedUri);

            store.startImport(i18n.t('backup.processing_data'));
            const backupData = JSON.parse(fileContent);

            if (!backupData || typeof backupData !== 'object') {
                throw new Error(i18n.t('backup.invalid_format'));
            }

            const hasRequiredCollections = COLLECTIONS_TO_BACKUP.some(col => Array.isArray(backupData[col]));
            if (!hasRequiredCollections) {
                throw new Error(i18n.t('backup.incompatible_data'));
            }

            store.startImport(i18n.t('backup.clearing_db'));
            await database.write(async () => {
                await database.unsafeResetDatabase();
            });

            // Clear player recents to match the new database state
            usePlayerStore.setState({ recentMedia: [], recentPlaylists: [] });
            await usePlayerStore.getState().saveRecentsState().catch(err => {
                console.warn('No se pudieron limpiar las escuchas recientes:', err);
            });

            store.startImport(i18n.t('backup.restoring_data'));
            const batchOperations: any[] = [];

            await database.write(async () => {
                for (const collectionName of COLLECTIONS_TO_BACKUP) {
                    const items = backupData[collectionName];
                    if (!Array.isArray(items)) continue;

                    const collection = database.collections.get(collectionName);
                    for (const item of items) {
                        const op = collection.prepareCreate((record: any) => {
                            Object.assign(record._raw, item);
                            if (collectionName === 'artists') {
                                record._raw.image_url = null;
                            }
                            if (collectionName === 'tracks') {
                                if (record._raw.rating === undefined) {
                                    record._raw.rating = null;
                                }
                            }
                        });
                        batchOperations.push(op);
                    }
                }

                if (batchOperations.length > 0) {
                    store.startImport(i18n.t('backup.saving_records', { count: batchOperations.length }));
                    await database.batch(batchOperations);
                }
            });

            store.setReconciling(i18n.t('backup.reconciling'));

            // NOTA: usamos skipFileCheck=true para no borrar los tracks del backup
            // (sus file_url no existen en este dispositivo pero los datos son válidos).
            await ScannerService.cleanDeletedFiles(
                { skipFileCheck: true },
                (phase) => store.setReconciling(i18n.t('backup.reconciling_phase', { phase }))
            );

            store.setSuccess(i18n.t('backup.import_success'));

            // Limpiar archivo temporal
            await FileSystem.deleteAsync(cachedUri, { idempotent: true }).catch(() => {});

            // Reiniciar la aplicación para recargar las conexiones y limpiar la memoria
            setTimeout(() => {
                RNRestart.restart();
            }, 1000);
        } catch (error: any) {
            console.error('Error al importar base de datos:', error);
            FileSystem.deleteAsync(cachedUri, { idempotent: true }).catch(() => {});
            store.setError(error?.message || String(error) || i18n.t('backup.import_error'));
        }
    },
};
