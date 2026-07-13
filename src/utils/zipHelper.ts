import * as FileSystem from 'expo-file-system/legacy';
import { zip } from 'react-native-zip-archive';
import * as Sharing from 'expo-sharing';
import { useZipStore } from '../store/useZipStore';
import i18n from '../constants/i18n';

export const zipAndShareTracks = async (tracks: any[]) => {
    if (!tracks || tracks.length === 0) return;

    const store = useZipStore.getState();
    store.showProgress(i18n.t('toasts.preparing_zip') || 'Preparando archivos...');

    // Create unique temporary folder in cache
    const tempDirName = `share_tracks_${Date.now()}`;
    const tempDirPath = `${FileSystem.cacheDirectory}${tempDirName}/`;
    const zipPath = `${FileSystem.cacheDirectory}${tempDirName}.zip`;

    try {
        // Ensure folder exists
        await FileSystem.makeDirectoryAsync(tempDirPath, { intermediates: true });

        // Copy files to temp folder with cleaned titles
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (!track.fileUrl) continue;

            const progressMsg = (i18n.t('toasts.copying_zip') || 'Copiando canción {{index}} de {{total}}...')
                .replace('{{index}}', String(i + 1))
                .replace('{{total}}', String(tracks.length));

            store.showProgress(progressMsg);

            // Get extension (e.g. .mp3, .flac)
            const extension = track.fileUrl.substring(track.fileUrl.lastIndexOf('.'));
            
            // Clean title to contain only alphanumeric characters and underscores
            const cleanedTitle = track.title.replace(/[^a-zA-Z0-9]/g, '_');
            const targetFileName = `${cleanedTitle}${extension}`;
            const targetFilePath = `${tempDirPath}${targetFileName}`;

            // Copy file to cache
            await FileSystem.copyAsync({
                from: track.fileUrl,
                to: targetFilePath
            });
        }

        // Compress
        store.showProgress(i18n.t('toasts.compressing_zip') || 'Comprimiendo selección...');
        
        // react-native-zip-archive expects raw local file paths without file:// prefix
        const cleanPath = (p: string) => decodeURIComponent(p.startsWith('file://') ? p.substring(7) : p);
        
        await zip(cleanPath(tempDirPath), cleanPath(zipPath));

        // Share
        store.showProgress(i18n.t('toasts.sharing_zip') || 'Abriendo selector para compartir...');
        
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (!isSharingAvailable) {
            throw new Error(i18n.t('toasts.sharing_unavailable') || 'El servicio de compartir no está disponible.');
        }

        await Sharing.shareAsync(zipPath, {
            mimeType: 'application/zip',
            dialogTitle: i18n.t('toasts.share_zip_title') || 'Compartir canciones',
            UTI: 'public.zip-archive',
        });

    } catch (error) {
        console.error('[zipAndShareTracks] Error sharing zip:', error);
        throw error;
    } finally {
        store.showProgress(i18n.t('toasts.cleaning_zip') || 'Limpiando archivos temporales...');
        
        // Clean up temp dir and zip file
        await FileSystem.deleteAsync(tempDirPath, { idempotent: true }).catch(err => {
            console.warn('[zipAndShareTracks] Failed to delete temp directory:', err);
        });
        await FileSystem.deleteAsync(zipPath, { idempotent: true }).catch(err => {
            console.warn('[zipAndShareTracks] Failed to delete zip file:', err);
        });

        store.hideProgress();
    }
};
