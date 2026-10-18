import * as FileSystem from 'expo-file-system/legacy';
import { mySchema } from '../database/schema';
import { BackupData, validateBackupData } from '../utils/backupData';

const MEDIA_COLUMNS: Record<string, string[]> = {
    tracks: ['bg_video'], albums: ['cover_url', 'cd_art_url', 'cover_color_source'], artists: ['image_url'],
    playlists: ['cover_custom_url', 'cover_url', 'header_custom_url'],
};
const MEDIA_FOLDERS = new Set(['artist_images', 'playlist_covers', 'cd_covers', 'album_covers', 'canvas_videos', 'canvas_thumbnails', 'user_avatar']);
interface ArchiveAsset { path: string; source: string; folder: string; size: number }
interface ArchiveManifest {
    format: 'mmplayer-backup'; version: 1; schemaVersion: number; createdAt: string;
    assets: ArchiveAsset[]; missing: string[]; profile: { userAlias: string | null; userAvatarUri: string | null };
}
export interface BackupArchive { data: BackupData; manifest: ArchiveManifest; root: string }
const localPath = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''));
const cleanUri = (uri: string) => uri.startsWith('file://') ? uri.split('?')[0] : uri;

async function walkMedia(root: string, visit: (uri: string, folder: string) => Promise<void>) {
    const info = await FileSystem.getInfoAsync(root);
    if (!info.exists) return;
    for (const folder of await FileSystem.readDirectoryAsync(root)) {
        if (!MEDIA_FOLDERS.has(folder)) continue;
        const directory = root + folder + '/';
        for (const file of await FileSystem.readDirectoryAsync(directory)) {
            if (file.includes('.pending-')) continue;
            const uri = directory + file;
            const stat = await FileSystem.getInfoAsync(uri);
            if (stat.exists && !stat.isDirectory) await visit(uri, folder);
        }
    }
}

export async function listOwnedBackupAssets(): Promise<string[]> {
    const paths: string[] = [];
    await walkMedia(FileSystem.documentDirectory + 'media_assets/', async uri => { paths.push(uri); });
    return paths;
}

export async function createBackupArchive(data: BackupData, root: string,
    profile: ArchiveManifest['profile'], progress: (count: number) => void): Promise<{ uri: string; missing: number }> {
    const { zip } = await import('react-native-zip-archive');
    const content = root + 'content/';
    await FileSystem.makeDirectoryAsync(content + 'assets/', { intermediates: true });
    const manifest: ArchiveManifest = { format: 'mmplayer-backup', version: 1, schemaVersion: mySchema.version,
        createdAt: new Date().toISOString(), assets: [], missing: [], profile };
    const included = new Set<string>();
    const add = async (uri: string, folder = 'album_covers') => {
        if (included.has(uri) || !/^(file|content|https?):\/\//.test(uri)) return;
        included.add(uri);
        const source = cleanUri(uri);
        const suffix = source.split(/[?#]/)[0].match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase() ?? (folder === 'canvas_videos' ? 'mp4' : 'jpg');
        const path = 'assets/' + manifest.assets.length + '.' + suffix;
        try {
            if (/^https?:/.test(source)) await FileSystem.downloadAsync(source, content + path);
            else await FileSystem.copyAsync({ from: source, to: content + path });
            const info = await FileSystem.getInfoAsync(content + path);
            if (!info.exists || info.isDirectory) throw new Error('Missing asset');
            manifest.assets.push({ source: uri, path, folder, size: info.size });
            progress(manifest.assets.length);
        } catch {
            await FileSystem.deleteAsync(content + path, { idempotent: true }).catch(() => {});
            manifest.missing.push(uri);
        }
    };
    // Includes unassigned canvas videos and their thumbnails, not just the
    // currently selected videos. Never walk the audio library or app databases.
    await walkMedia(FileSystem.documentDirectory + 'media_assets/', add);
    for (const [table, columns] of Object.entries(MEDIA_COLUMNS)) {
        for (const row of data[table] ?? []) {
            for (const column of columns) {
                const uri = row[column];
                if (typeof uri === 'string') await add(uri, table === 'tracks' ? 'canvas_videos' : 'album_covers');
            }
        }
    }
    if (profile.userAvatarUri) await add(profile.userAvatarUri, 'user_avatar');
    await FileSystem.writeAsStringAsync(content + 'database.json', JSON.stringify(data), { encoding: FileSystem.EncodingType.UTF8 });
    await FileSystem.writeAsStringAsync(content + 'manifest.json', JSON.stringify(manifest), { encoding: FileSystem.EncodingType.UTF8 });
    const uri = root + 'MMPlayer-complete-backup.zip';
    await zip(localPath(content), localPath(uri));
    return { uri, missing: manifest.missing.length };
}

function validateManifest(value: unknown): ArchiveManifest {
    if (!value || typeof value !== 'object') throw new Error('backup.invalid_format');
    const manifest = value as ArchiveManifest;
    if (manifest.format !== 'mmplayer-backup' || manifest.version !== 1 || !Number.isInteger(manifest.schemaVersion)
        || manifest.schemaVersion > mySchema.version || !Array.isArray(manifest.assets)) throw new Error('backup.incompatible_data');
    if (!manifest.profile || typeof manifest.profile !== 'object'
        || (manifest.profile.userAlias !== null && typeof manifest.profile.userAlias !== 'string')
        || (manifest.profile.userAvatarUri !== null && typeof manifest.profile.userAvatarUri !== 'string')) throw new Error('backup.invalid_format');
    const sources = new Set<string>(), paths = new Set<string>();
    for (const asset of manifest.assets) {
        if (!asset || typeof asset.source !== 'string' || typeof asset.path !== 'string' || !/^assets\/\d+\.[a-z0-9]{1,5}$/.test(asset.path)
            || !MEDIA_FOLDERS.has(asset.folder) || typeof asset.size !== 'number' || !Number.isSafeInteger(asset.size) || asset.size < 0
            || sources.has(asset.source) || paths.has(asset.path)) throw new Error('backup.invalid_format');
        sources.add(asset.source); paths.add(asset.path);
    }
    return manifest;
}

export async function openBackupArchive(uri: string, root: string): Promise<BackupArchive> {
    const { unzip, getUncompressedSize } = await import('react-native-zip-archive');
    const size = await getUncompressedSize(localPath(uri));
    const free = await FileSystem.getFreeDiskStorageAsync();
    // Extraction plus final persistent assets need room for two copies.
    if (!Number.isFinite(size) || size <= 0 || size * 2 > free) throw new Error('backup.insufficient_space');
    const content = root + 'extracted/';
    await unzip(localPath(uri), localPath(content));
    const manifest = validateManifest(JSON.parse(await FileSystem.readAsStringAsync(content + 'manifest.json')));
    const data = validateBackupData(JSON.parse(await FileSystem.readAsStringAsync(content + 'database.json')));
    // Verify every entry before the player is stopped or any DB record changes.
    for (const asset of manifest.assets) {
        const info = await FileSystem.getInfoAsync(content + asset.path);
        if (!info.exists || info.isDirectory || info.size !== asset.size) throw new Error('backup.invalid_format');
    }
    return { data, manifest, root: content };
}

/** Stage media under unique paths: failed imports never overwrite current files. */
export async function stageArchiveAssets(archive: BackupArchive, token: string): Promise<{ data: BackupData; avatar: string | null; paths: string[]; retainedPaths: string[] }> {
    const paths: string[] = [], retainedPaths: string[] = [], uriMap = new Map<string, string>();
    try {
        for (const asset of archive.manifest.assets) {
            const directory = FileSystem.documentDirectory + 'media_assets/' + asset.folder + '/';
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            const source = archive.root + asset.path;
            const sourceInfo = await FileSystem.getInfoAsync(source, { md5: true });
            const hash = sourceInfo.exists && typeof sourceInfo.md5 === 'string' && /^[a-f0-9]{32}$/i.test(sourceInfo.md5) ? sourceInfo.md5 : null;
            const extension = asset.path.split('.').pop();
            let destination = directory + 'backup_' + (hash ?? token + '_' + asset.path.slice('assets/'.length).split('.')[0]) + '.' + extension;
            const existing = await FileSystem.getInfoAsync(destination, { md5: true });
            const reusable = hash && existing.exists && !existing.isDirectory && existing.size === asset.size && existing.md5 === hash;
            if (!reusable) {
                if (existing.exists) destination = directory + 'backup_' + token + '_' + asset.path.slice('assets/'.length);
                paths.push(destination);
                await FileSystem.copyAsync({ from: source, to: destination });
            }
            retainedPaths.push(destination);
            uriMap.set(asset.source, destination);
            // Also match file URIs without their image-cache timestamp.
            if (asset.source.startsWith('file://')) uriMap.set(cleanUri(asset.source), destination);
        }
        const data: BackupData = {};
        for (const [table, rows] of Object.entries(archive.data)) {
            data[table] = rows.map(row => {
                const copy = { ...row };
                for (const column of MEDIA_COLUMNS[table] ?? []) {
                    const uri = copy[column];
                    if (typeof uri === 'string') copy[column] = uriMap.get(uri) ?? uriMap.get(cleanUri(uri)) ?? uri;
                }
                return copy;
            });
        }
        const avatar = uriMap.get(archive.manifest.profile?.userAvatarUri ?? '') ?? null;
        return { data, avatar, paths, retainedPaths };
    } catch (error) {
        await Promise.all(paths.map(path => FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {})));
        throw error;
    }
}
