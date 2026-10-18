import { PermissionsAndroid, Platform } from 'react-native';
import { addMusicZipProgressListener, clearLaunchAudioUri, getOpenedFileInfo, importMusicZip } from '../../modules/native-audio-scanner';
import { useBackupStore } from '../store/useBackupStore';
import { pickDocumentForCopy } from './DocumentPickerService';
import { ScannerService } from './ScannerService';
import i18n from '../constants/i18n';

const ZIP_MIMES = ['application/zip', 'application/x-zip-compressed'];
let busy = false;
let lastUrl = '';
let lastHandled = 0;

function failureMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    for (const key of ['no_audio', 'not_enough_space', 'unsafe_path', 'permission_denied', 'storage_unavailable', 'file_conflict', 'invalid_archive']) {
        if (message.includes('music_zip.' + key)) return i18n.t('music_zip.' + key);
    }
    if (/ENOSPC|No space left/i.test(message)) return i18n.t('music_zip.not_enough_space');
    return i18n.t('music_zip.import_error');
}

async function importZip(uri: string, name = '') {
    const store = useBackupStore.getState();
    if (busy || (store.isVisible && ['exporting', 'importing', 'reconciling'].includes(store.mode))) return;
    busy = true;
    let progress: { remove: () => void } | undefined;
    try {
        store.startImport(i18n.t('music_zip.preparing'));
        if (Platform.OS !== 'android') throw new Error('Unsupported platform');
        if (Number(Platform.Version) <= 28) {
            const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
            if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('music_zip.permission_denied');
        }
        progress = addMusicZipProgressListener(event => store.startImport(i18n.t('music_zip.progress', { count: event.completed, total: event.total })));
        const result = await importMusicZip(uri, name);
        progress.remove(); progress = undefined;
        store.startImport(i18n.t('music_zip.scanning'));
        try { await ScannerService.syncLibrary(undefined, true, undefined, true); }
        catch (error) {
            console.warn('[MusicZipImport] Files copied but library refresh failed:', error);
            store.setError(i18n.t('music_zip.scan_error', { folder: result.folder }));
            return;
        }
        store.setSuccess(i18n.t('music_zip.success', { count: result.imported, skipped: result.skipped, folder: result.folder }));
    } catch (error) {
        console.warn('[MusicZipImport] Import failed:', error);
        store.setError(failureMessage(error));
    } finally { progress?.remove(); busy = false; }
}

export const MusicZipImportService = {
    importZip,
    async pickAndImportZip() {
        if (busy) return;
        try {
            const result = await pickDocumentForCopy(ZIP_MIMES);
            if (!result.canceled && result.assets?.length) await importZip(result.assets[0].uri, result.assets[0].name);
        } catch (error) {
            const store = useBackupStore.getState();
            store.startImport(i18n.t('music_zip.preparing'));
            store.setError(failureMessage(error));
        }
    },
    /** Inspect content-provider MIME/name before the audio handler sees a URI. */
    async handleOpenedZip(url: string): Promise<boolean> {
        if (!/^(content|file):\/\//.test(url) || Platform.OS !== 'android') return false;
        let name = url.split('/').pop()?.split('?')[0] ?? '';
        try { name = decodeURIComponent(name); } catch { /* Keep malformed escape sequences as literal filename characters. */ }
        let isZip = /\.zip$/i.test(name);
        try {
            if (url.startsWith('content://')) {
                const info = await getOpenedFileInfo(url);
                name = info.name || name;
                isZip = /\.zip$/i.test(name) || ZIP_MIMES.includes(info.mimeType.toLowerCase());
            }
        } catch { /* A file URI can still be identified by its extension. */ }
        if (!isZip) return false;
        if (busy || (lastUrl === url && Date.now() - lastHandled < 1500)) return true;
        lastUrl = url; lastHandled = Date.now();
        try { await importZip(url, name); }
        finally { clearLaunchAudioUri(); }
        return true;
    },
};
