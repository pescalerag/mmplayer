import { Q } from '@nozbe/watermelondb';
import { extractColorFromImage } from '../../modules/native-equalizer';
import { database } from '../database';
import type Album from '../database/models/Album';

const isColor = (value: string | null | undefined): value is string =>
    typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);

// Keep the complete URI as the identity: ?t= changes when artwork is replaced.
export function getStoredCoverColor(source: string | null | undefined, album?: Album | null): string | null {
    if (!source || album?.coverUrl !== source || album.coverColorSource !== source) return null;
    return isColor(album.coverColor) ? album.coverColor : null;
}

// Only an accelerator for shared/temporary artwork. Album records remain the
// source of truth across sessions; requests always check the database first.
const recentColors = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let extractionQueue: Promise<unknown> = Promise.resolve();

function extractOnce(source: string): Promise<string | null> {
    const existing = pending.get(source);
    if (existing) return existing;
    const cached = recentColors.get(source);
    if (cached) return Promise.resolve(cached);

    // Decode one image at a time, including adjacent-track preloading.
    const request = extractionQueue.then(async () => {
        let imageUri = source;
        if (source.startsWith('file://')) imageUri = source.split('?')[0];
        if (source.startsWith('content://')) {
            // t belongs to our image cache, not the Android content provider.
            imageUri = source.replace(/([?&])t=[^&]*(&|$)/, (_match, separator, trailing) => trailing ? separator : '');
        }
        const color = await extractColorFromImage(imageUri);
        if (!isColor(color)) return null;
        recentColors.set(source, color);
        if (recentColors.size > 64) recentColors.delete(recentColors.keys().next().value!);
        return color;
    });
    pending.set(source, request);
    extractionQueue = request.catch(() => null);
    void request.finally(() => pending.delete(source)).catch(() => {});
    return request;
}

async function persistColor(album: Album, source: string, color: string): Promise<void> {
    if (album.coverUrl !== source || getStoredCoverColor(source, album) === color) return;
    await database.write(async () => {
        // A replacement or deletion may have happened while decoding the image.
        if (album._raw?._status === 'deleted' || album.coverUrl !== source || getStoredCoverColor(source, album) === color) return;
        await album.update(record => {
            record.coverColor = color;
            record.coverColorSource = source;
        });
    });
}

export const AlbumCoverColorService = {
    async getColor(source: string | null | undefined, album?: Album | null): Promise<string | null> {
        if (!source) return null;
        const stored = getStoredCoverColor(source, album);
        if (stored) return stored;

        try {
            const albums = album?.coverUrl === source && album.collection
                ? [album]
                : await database.collections.get<Album>('albums').query(Q.where('cover_url', source)).fetch();
            const color = albums.map(item => getStoredCoverColor(source, item)).find(isColor)
                ?? await extractOnce(source);
            if (!color) return null;
            await Promise.all(albums.map(item => persistColor(item, source, color)));
            return color;
        } catch (error) {
            // Do not persist a fallback when the image is unavailable; retry later.
            console.warn('[AlbumCoverColorService] Unable to load artwork color:', error);
            return null;
        }
    },
};
