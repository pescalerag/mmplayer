import { updateMetadataBatch, cancelUpdateMetadataBatch, scanMultipleFiles, requestWritePermission, BatchMetadataItem } from '../../modules/native-audio-scanner';
import Track from '../database/models/Track';
import { ScannerService } from './ScannerService';

export interface EditableMetadata {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    trackNumber?: string;
    genre?: string;
    coverArtPath?: string;
    albumArtist?: string;
    discNumber?: string;
}

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
        const batchList: BatchMetadataItem[] = [];

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const filePath = track.fileUrl;
            
            // Single track gets all fields; batch mode locks title, trackNumber and discNumber
            const titleVal = isBatchMode ? null : (metadata.title !== undefined ? metadata.title : null);
            
            let trackNumberVal: number | null = null;
            if (isBatchMode) {
                if (autoNumberTracks) {
                    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
                    const nameWithoutExt = fileName.includes('.') 
                        ? fileName.substring(0, fileName.lastIndexOf('.')) 
                        : fileName;
                    const match = nameWithoutExt.match(/\b(\d{1,3})\b/);
                    if (match) {
                        trackNumberVal = parseInt(match[1], 10);
                    } else {
                        trackNumberVal = i + 1;
                    }
                } else {
                    trackNumberVal = null;
                }
            } else {
                trackNumberVal = metadata.trackNumber !== undefined ? (metadata.trackNumber === '' ? 0 : (parseInt(metadata.trackNumber, 10) || null)) : null;
            }

            const discNumberVal = isBatchMode ? null : (metadata.discNumber !== undefined ? (metadata.discNumber === '' ? 0 : (parseInt(metadata.discNumber, 10) || null)) : null);
            
            const artistVal = metadata.artist !== undefined ? metadata.artist : null;
            const albumVal = metadata.album !== undefined ? metadata.album : null;
            const yearVal = metadata.year !== undefined ? (metadata.year === '' ? 0 : (parseInt(metadata.year, 10) || null)) : null;
            const genreVal = metadata.genre !== undefined ? metadata.genre : null;
            const coverArtPathVal = metadata.coverArtPath !== undefined ? metadata.coverArtPath : null;
            const albumArtistVal = metadata.albumArtist !== undefined ? metadata.albumArtist : null;

            // Only call updateMetadata if at least one field has changed
            const hasChanges = 
                titleVal !== null ||
                artistVal !== null ||
                albumVal !== null ||
                yearVal !== null ||
                trackNumberVal !== null ||
                genreVal !== null ||
                coverArtPathVal !== null ||
                albumArtistVal !== null ||
                discNumberVal !== null;

            if (hasChanges) {
                batchList.push({
                    filePath,
                    metadata: {
                        title: titleVal,
                        artist: artistVal,
                        album: albumVal,
                        year: yearVal === 0 ? null : yearVal,
                        trackNumber: trackNumberVal === 0 ? null : trackNumberVal,
                        genre: genreVal,
                        coverArtPath: coverArtPathVal,
                        albumArtist: albumArtistVal,
                        discNumber: discNumberVal === 0 ? null : discNumberVal
                    }
                });
            }
        }
        
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
        
        // After finishing all writes, run scanner service silently to update local WatermelonDB database
        await ScannerService.syncLibrary(undefined, true);
    },

    cancelSave: async (): Promise<void> => {
        isCancelled = true;
        await cancelUpdateMetadataBatch();
    }
};
