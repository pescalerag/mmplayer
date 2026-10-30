import { Image } from 'react-native';
import placeholderCover from '../assets/images/nullcover.png';
import * as FileSystem from 'expo-file-system/legacy';
import { database } from '../database';
import Album from '../database/models/Album';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSyncStore } from '../store/useSyncStore';
import { MediaAssetService } from './MediaAssetService';

interface CoverResult { title: string; artist?: { name: string }; cover_xl?: string; cover_big?: string; }
export interface AlbumCoverSummary { downloaded: number; notFound: number; failed: number; skipped: number; }
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const baseTitle = (value: string) => normalize(value.replace(/\s*[([][^)\]]*(?:deluxe|remaster|anniversary|expanded|edition)[^)\]]*[)\]]\s*$/i, ''));

export function isMissingAlbumCover(uri?: string | null): boolean {
    if (!uri?.trim()) return true;
    const placeholder = typeof Image.resolveAssetSource === 'function'
        ? Image.resolveAssetSource(typeof placeholderCover === 'string' ? { uri: placeholderCover } : placeholderCover)?.uri
        : typeof placeholderCover === 'string' ? placeholderCover : (placeholderCover as { uri?: string })?.uri;
    return uri === placeholder;
}

export function selectAlbumCover(results: CoverResult[], title: string, artist: string): string | null {
    const matching = results.filter(result => result.artist && normalize(result.artist.name) === normalize(artist)
        && baseTitle(result.title) === baseTitle(title));
    const exact = matching.find(result => normalize(result.title) === normalize(title));
    const result = exact ?? matching[0];
    const url = result?.cover_xl || result?.cover_big;
    return url?.startsWith('https://') ? url : null;
}

let sequence = 0;
async function downloadCover(title: string, artist: string): Promise<string | null> {
    if (!title.trim() || !artist.trim()) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let localUri: string | null = null;
    try {
        const response = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(`${artist} ${title}`)}&limit=25`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Album search HTTP ${response.status}`);
        const json = await response.json();
        if (json.error || !Array.isArray(json.data)) throw new Error('Invalid album search response');
        const url = selectAlbumCover(json.data, title, artist);
        if (!url) return null;
        if (!FileSystem.cacheDirectory) throw new Error('Image cache unavailable');
        localUri = `${FileSystem.cacheDirectory}album_cover_${Date.now()}_${++sequence}.jpg`;
        const result = await FileSystem.downloadAsync(url, localUri);
        const contentType = result.headers?.['Content-Type'] || result.headers?.['content-type'];
        if (result.status !== 200 || (contentType && !contentType.toLowerCase().startsWith('image/'))) throw new Error('Invalid cover download');
        return result.uri;
    } catch (error) {
        if (localUri) await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function processAlbum(album: Album, summary: AlbumCoverSummary): Promise<void> {
    const previousCover = album.coverUrl;
    const title = album.title;
    let temporaryUri: string | null = null;
    try {
        const artist = await album.artist.fetch();
        temporaryUri = await downloadCover(title, artist?.name || '');
        if (!temporaryUri) { summary.notFound++; return; }
        await database.write(async () => {
            // Preserve a cover supplied by the user while this request was running.
            if (album.coverUrl !== previousCover || album.title !== title) { summary.skipped++; return; }
            const cover = await MediaAssetService.saveAlbumCover(album.id, temporaryUri!);
            await album.update(record => { record.coverUrl = cover; });
            summary.downloaded++;
        });
    } catch (error) {
        console.warn('[AlbumCoverService] Cover download failed', album.id, error);
        summary.failed++;
    } finally {
        if (temporaryUri) await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => {});
    }
}

let processing: Promise<AlbumCoverSummary> | null = null;
export const AlbumCoverService = {
    downloadCover,
    processMissingAlbumCovers(options?: { isBackground?: boolean }): Promise<AlbumCoverSummary> {
        if (options?.isBackground && !useSettingsStore.getState().albumCoverBackgroundDownload) {
            return Promise.resolve({ downloaded: 0, notFound: 0, failed: 0, skipped: 0 });
        }
        if (processing) return processing;
        useSyncStore.getState().setIsDownloadingAlbumCovers(true);
        processing = (async () => {
            const summary: AlbumCoverSummary = { downloaded: 0, notFound: 0, failed: 0, skipped: 0 };
            try {
                const albums = (await database.collections.get<Album>('albums').query().fetch()).filter(album => isMissingAlbumCover(album.coverUrl));
                const processNext = async (index: number): Promise<void> => {
                    if (index >= albums.length) return;
                    await processAlbum(albums[index], summary);
                    useSyncStore.getState().setAlbumCoverProgress(index + 1, albums.length);
                    if (index + 1 < albums.length) await new Promise(resolve => setTimeout(resolve, 750));
                    return processNext(index + 1);
                };
                useSyncStore.getState().setAlbumCoverProgress(0, albums.length);
                await processNext(0);
                if (summary.downloaded > 0) {
                    await import('../store/usePlayerStore').then(async ({ usePlayerStore }) => {
                        const player = usePlayerStore.getState();
                        await player.refreshRecentsFromDatabase();
                        if (player.activeTrack) await player.updateTrackMetadata(player.activeTrack.id);
                    }).catch(error => console.warn('[AlbumCoverService] Playback artwork refresh failed', error));
                }
                return summary;
            } finally {
                processing = null;
                useSyncStore.getState().setIsDownloadingAlbumCovers(false);
            }
        })();
        return processing;
    },
};
