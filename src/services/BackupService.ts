import { Alert } from 'react-native';
import { pickDocumentForCopy } from './DocumentPickerService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import RNRestart from 'react-native-restart';
import randomId from '@nozbe/watermelondb/utils/common/randomId';
import { database } from '../database';
import { useBackupStore } from '../store/useBackupStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useCastStore } from '../store/useCastStore';
import { clearAllQueueSessions } from '../store/useMultipleQueuesStore';
import i18n from '../constants/i18n';
import { BACKUP_TABLES, BackupData, BackupImportOptions, mergeBackupData, validateBackupData } from '../utils/backupData';
import { BackupArchive, createBackupArchive, listOwnedBackupAssets, openBackupArchive, stageArchiveAssets } from './BackupArchiveService';

type BackupFormat = 'json' | 'zip';
let busy = false;

async function readBackupFile(uri: string): Promise<string> {
    const plain = (await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 })).replace(/^\uFEFF/, '').trim();
    if (plain.startsWith('{') || plain.startsWith('[')) return plain;
    try {
        const binary = atob(plain), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes).trim();
    } catch { return plain; }
}

export function chooseBackupImportOptions(): Promise<BackupImportOptions | null> {
    return new Promise(resolve => {
        Alert.alert(i18n.t('backup.import_mode_title'), i18n.t('backup.import_mode_description'), [
            { text: i18n.t('actions.cancel'), style: 'cancel', onPress: () => resolve(null) },
            { text: i18n.t('backup.merge'), onPress: () => {
                Alert.alert(i18n.t('backup.conflicts_title'), i18n.t('backup.conflicts_description'), [
                    { text: i18n.t('actions.cancel'), style: 'cancel', onPress: () => resolve(null) },
                    { text: i18n.t('backup.keep_current'), onPress: () => resolve({ mode: 'merge', conflicts: 'current' }) },
                    { text: i18n.t('backup.use_imported'), onPress: () => resolve({ mode: 'merge', conflicts: 'imported' }) },
                ], { cancelable: true, onDismiss: () => resolve(null) });
            } },
            { text: i18n.t('backup.replace'), style: 'destructive', onPress: () => resolve({ mode: 'replace', conflicts: 'imported' }) },
        ], { cancelable: true, onDismiss: () => resolve(null) });
    });
}

async function snapshot() {
    return database.read(async () => {
        const entries = await Promise.all(BACKUP_TABLES.map(async table => {
            const records = await database.collections.get(table).query().fetch();
            return [table, records] as const;
        }));
        return Object.fromEntries(entries);
    });
}

function rawData(records: Awaited<ReturnType<typeof snapshot>>): BackupData {
    return Object.fromEntries(Object.entries(records).map(([table, rows]) => [table, rows.map(record => ({ ...record._raw }))])) as BackupData;
}

async function applyBackupData(incoming: BackupData, options: BackupImportOptions) {
    await database.write(async () => {
        const tables = await Promise.all(BACKUP_TABLES.map(async table => [table, await database.collections.get(table).query().fetch()] as const));
        const current = Object.fromEntries(tables);
        const data = options.mode === 'merge' ? mergeBackupData(validateBackupData(rawData(current)), incoming, options.conflicts) : incoming;
        const previous = new Map(Object.values(current).flat().map(record => [record, { ...record._raw }]));
        const operations = [];
        try {
            for (const table of BACKUP_TABLES) {
                const collection = database.collections.get(table);
                const existing = new Map(current[table].map(record => [record.id, record]));
                if (options.mode === 'replace') operations.push(...current[table].map(record => record.prepareDestroyPermanently()));
                for (const row of data[table]) {
                    const record = options.mode === 'merge' ? existing.get(row.id) : undefined;
                    if (record) {
                        const changed = Object.keys(row).some(key => record._raw[key as keyof typeof record._raw] !== row[key]);
                        if (changed) operations.push(record.prepareUpdate(item => { Object.assign(item._raw, row); }));
                    } else {
                        operations.push(collection.prepareCreate(item => { Object.assign(item._raw, row); }));
                    }
                }
            }
            // One native SQLite transaction. An invalid/corrupt backup cannot leave
            // the app with a half-erased database after several separate batches.
            if (operations.length) await database.batch(operations);
        } catch (error) {
            // SQLite rolled back; also restore the model snapshots that
            // prepareUpdate changes in memory before the native batch runs.
            for (const [record, raw] of previous) {
                for (const key of Object.keys(record._raw)) {
                    if (!(key in raw)) delete (record._raw as unknown as Record<string, unknown>)[key];
                }
                Object.assign(record._raw, raw);
                record._preparedState = null;
            }
            throw error;
        }
    });
}

async function exportDatabase(format: BackupFormat = 'json') {
    if (busy) return;
    busy = true;
    const store = useBackupStore.getState();
    const root = FileSystem.cacheDirectory + 'backup-export-' + randomId() + '/';
    store.startExport(i18n.t('backup.preparing'));
    try {
        const data = rawData(await snapshot());
        const fileUri = FileSystem.cacheDirectory + (format === 'zip' ? 'backup_music_app.zip' : 'backup_music_app.json');
        let missing = 0;
        if (format === 'zip') {
            const { userAlias, userAvatarUri } = useSettingsStore.getState();
            const archive = await createBackupArchive(data, root, { userAlias, userAvatarUri }, count => store.startExport(i18n.t('backup.copying_assets', { count })));
            missing = archive.missing;
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
            await FileSystem.moveAsync({ from: archive.uri, to: fileUri });
        } else {
            await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data), { encoding: FileSystem.EncodingType.UTF8 });
        }
        if (!await Sharing.isAvailableAsync()) throw new Error(i18n.t('backup.sharing_unavailable'));
        store.startExport(i18n.t('backup.opening_share'));
        await Sharing.shareAsync(fileUri, { mimeType: format === 'zip' ? 'application/zip' : 'application/json',
            dialogTitle: i18n.t('backup.export_title'), UTI: format === 'zip' ? 'public.zip-archive' : 'public.json' });
        store.setSuccess(i18n.t(missing ? 'backup.export_missing_assets' : 'backup.export_success', { count: missing }));
    } catch (error) {
        store.setError(errorMessage(error, 'backup.export_error'));
    } finally {
        await FileSystem.deleteAsync(root, { idempotent: true }).catch(() => {});
        busy = false;
    }
}

function errorMessage(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : '';
    return message.startsWith('backup.') ? i18n.t(message) : message || i18n.t(fallback);
}

async function importDatabase(format: BackupFormat = 'json') {
    if (busy) return;
    busy = true;
    const store = useBackupStore.getState();
    const token = randomId(), root = FileSystem.cacheDirectory + 'backup-import-' + token + '/';
    let stagedPaths: string[] = [], retainedAssets: string[] = [], committed = false;
    try {
        const result = await pickDocumentForCopy(format === 'zip' ? ['application/zip', 'application/x-zip-compressed'] : 'application/json');
        if (result.canceled || !result.assets?.length) return;
        store.startImport(i18n.t('backup.reading_file'));
        await FileSystem.makeDirectoryAsync(root, { intermediates: true });
        const cached = root + 'backup.' + format;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: cached });
        let archive: BackupArchive | undefined;
        let data: BackupData;
        if (format === 'zip') {
            archive = await openBackupArchive(cached, root);
            data = archive.data;
        } else data = validateBackupData(JSON.parse(await readBackupFile(cached)));
        const options = await chooseBackupImportOptions();
        if (!options) { store.close(); return; }
        const previousAssets = archive && options.mode === 'replace' ? await listOwnedBackupAssets() : [];
        if (archive) {
            store.startImport(i18n.t('backup.restoring_assets'));
            const staged = await stageArchiveAssets(archive, token);
            data = staged.data; stagedPaths = staged.paths; retainedAssets = staged.retainedPaths;
            archive.manifest.profile.userAvatarUri = staged.avatar;
        }
        store.startImport(i18n.t('backup.stopping_player'));
        const cast = useCastStore.getState();
        if (cast.isLocalCastActive) await cast.stopLocalCast();
        if (cast.isChromecastConnected) await cast.disconnectChromecast();
        await usePlayerStore.getState().clearPlayer();
        store.startImport(i18n.t('backup.restoring_data'));
        await applyBackupData(data, options);
        committed = true;
        if (options.mode === 'replace') {
            clearAllQueueSessions();
            usePlayerStore.setState({ recentMedia: [], recentPlaylists: [] });
            await usePlayerStore.getState().saveRecentsState().catch(() => {});
        }
        if (archive) {
            const current = useSettingsStore.getState();
            const preferImported = options.mode === 'replace' || options.conflicts === 'imported';
            useSettingsStore.setState({
                userAlias: preferImported || !current.userAlias ? archive.manifest.profile.userAlias : current.userAlias,
                userAvatarUri: preferImported || !current.userAvatarUri ? archive.manifest.profile.userAvatarUri : current.userAvatarUri,
            });
            const retained = new Set([...retainedAssets, ...Object.values(data).flatMap(rows => rows.flatMap(row => Object.values(row)
                .filter((value): value is string => typeof value === 'string' && value.startsWith('file://')).map(uri => uri.split('?')[0])))]);
            await Promise.all(previousAssets.filter(path => !retained.has(path)).map(path => FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {})));
        }
        store.setSuccess(i18n.t('backup.import_success'));
        setTimeout(() => RNRestart.restart(), 1000);
    } catch (error) {
        store.setError(errorMessage(error, 'backup.import_error'));
    } finally {
        if (!committed) await Promise.all(stagedPaths.map(path => FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {})));
        await FileSystem.deleteAsync(root, { idempotent: true }).catch(() => {});
        busy = false;
    }
}

export const BackupService = { exportDatabase, importDatabase };
