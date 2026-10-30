import { updateMetadataBatch, cancelUpdateMetadataBatch, scanMultipleFiles, requestWritePermission } from '../../modules/native-audio-scanner';
import Track from '../database/models/Track';
import { ScannerService } from './ScannerService';

import { buildMetadataBatch, type EditableMetadata } from '../utils/metadataBatch';
export type { EditableMetadata } from '../utils/metadataBatch';

let isCancelled = false;

export const MetadataEditorService = {
    /**
     * Loops through a list of tracks, aggregates updates, and writes them in chunks.
     * Triggers library synchronization on completion.
     */
    saveMetadata: async (
        tracks: Track[],
        metadata: EditableMetadata,
        isBatchMode: boolean,
        autoNumberTracks: boolean = false,
        onProgress?: (current: number, total: number) => void
    ): Promise<void> => {
        const batchList = buildMetadataBatch(tracks, metadata, isBatchMode, autoNumberTracks);

        if (batchList.length > 0) {
            isCancelled = false;

            // Request permissions for all files upfront on Android 11+
            const filePaths = batchList.map(item => item.filePath);
            try {
                await requestWritePermission(filePaths);
            } catch (err) {
                console.warn("Upfront permission request failed/denied, falling back to sequential:", err);
            }

            // Process chunks to update progress UI and prevent ANR thread starvation
            const chunkSize = 10;
            for (let i = 0; i < batchList.length; i += chunkSize) {
                if (isCancelled) {
                    throw new Error("ERR_CANCELLED");
                }
                const chunk = batchList.slice(i, i + chunkSize);
                await updateMetadataBatch(chunk);
                
                if (onProgress) {
                    onProgress(Math.min(i + chunkSize, batchList.length), batchList.length);
                }
                
                // Yield thread to prevent UI freezing
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Scan all written files natively at once (fastest option)
            await scanMultipleFiles(filePaths);
        }
        
        // After finishing all writes, run scanner service to update local WatermelonDB database
        const editedFileMetadataMap = new Map<string, EditableMetadata>();
        for (const item of batchList) {
            editedFileMetadataMap.set(item.filePath, item.metadata as any);
            if (item.filePath.includes('#')) {
                editedFileMetadataMap.set(item.filePath.replace(/#/g, '%23'), item.metadata as any);
            }
            if (item.filePath.includes('%23')) {
                editedFileMetadataMap.set(item.filePath.replace(/%23/g, '#'), item.metadata as any);
            }
        }
        for (const track of tracks) {
            if (!editedFileMetadataMap.has(track.fileUrl)) {
                editedFileMetadataMap.set(track.fileUrl, metadata);
            }
        }
        await ScannerService.syncLibrary(undefined, true, editedFileMetadataMap);

        // Update playback queue and recents for edited tracks
        try {
            const { usePlayerStore } = require('../store/usePlayerStore');
            const playerStore = usePlayerStore.getState();
            for (const track of tracks) {
                await playerStore.updateTrackMetadata(track.id);
            }
            await playerStore.refreshRecentsFromDatabase();
        } catch (playerErr) {
            console.error("Error updating player store metadata after save:", playerErr);
        }
    },

    cancelSave: async (): Promise<void> => {
        isCancelled = true;
        await cancelUpdateMetadataBatch();
    }
};
