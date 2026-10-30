import type { BatchMetadataItem } from '../../modules/native-audio-scanner';

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

export function buildMetadataBatch(tracks: readonly { fileUrl: string }[], metadata: EditableMetadata, isBatchMode: boolean, autoNumberTracks = false): BatchMetadataItem[] {
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
                    
                    // Check for patterns like "1-02", "01.02", "1_02" to ignore disc number in autonumbering
                    const discTrackMatch = nameWithoutExt.match(/\b\d+[-_.](\d{1,3})\b/);
                    if (discTrackMatch) {
                        trackNumberVal = parseInt(discTrackMatch[1], 10);
                    } else {
                        const match = nameWithoutExt.match(/\b(\d{1,3})\b/);
                        if (match) {
                            trackNumberVal = parseInt(match[1], 10);
                        } else {
                            trackNumberVal = i + 1;
                        }
                    }
                } else {
                    trackNumberVal = null;
                }
            } else {
                trackNumberVal = metadata.trackNumber !== undefined ? (metadata.trackNumber === '' ? 0 : (parseInt(metadata.trackNumber, 10) || null)) : null;
            }

            const discNumberVal = metadata.discNumber !== undefined ? (metadata.discNumber === '' ? 0 : (parseInt(metadata.discNumber, 10) || null)) : null;
            
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
        

return batchList;
}
