import * as FileSystem from 'expo-file-system/legacy';
import { createBackupArchive, openBackupArchive, stageArchiveAssets } from '../services/BackupArchiveService';
import { validateBackupData } from '../utils/backupData';
import { createHash } from 'node:crypto';

jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', EncodingType: { UTF8: 'utf8' },
    getInfoAsync: jest.fn(), readDirectoryAsync: jest.fn(), readAsStringAsync: jest.fn(), writeAsStringAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(), copyAsync: jest.fn(), deleteAsync: jest.fn(), getFreeDiskStorageAsync: jest.fn(),
}));
jest.mock('react-native-zip-archive', () => ({ zip: jest.fn(), unzip: jest.fn(), getUncompressedSize: jest.fn() }));
import { zip, unzip, getUncompressedSize } from 'react-native-zip-archive';

let files: Map<string, string>, entries: Map<string, string>;
const media = 'file:///documents/media_assets/';
const data = () => validateBackupData({
    tracks: [{ id: 'song', file_url: 'file:///music/song.mp3', bg_video: media + 'canvas_videos/selected.mp4', lyrics_lrc: '[00:01]Lyrics' }],
    albums: [{ id: 'album', cover_url: media + 'album_covers/cover.jpg?t=1', cover_color_source: media + 'album_covers/cover.jpg?t=1', cover_color: '#123456', cd_art_url: media + 'cd_covers/custom.png' }],
    artists: [{ id: 'artist', image_url: media + 'artist_images/custom.jpg' }],
    playlists: [{ id: 'list', cover_custom_url: media + 'playlist_covers/list.jpg', header_custom_url: media + 'playlist_covers/header.jpg' }],
    playback_history: [{ id: 'listen', item_id: 'song', item_type: 'track', played_at: 1000, duration_played: 100 }],
});
beforeEach(() => {
    jest.clearAllMocks();
    files = new Map([
        [media + 'canvas_videos/selected.mp4', 'VIDEO'], [media + 'canvas_videos/unassigned.mp4', 'UNASSIGNED'],
        [media + 'canvas_thumbnails/selected.mp4.jpg', 'THUMB'], [media + 'album_covers/cover.jpg', 'COVER'],
        [media + 'cd_covers/custom.png', 'CUSTOM_CD'], [media + 'artist_images/custom.jpg', 'ARTIST'],
        [media + 'playlist_covers/list.jpg', 'PLAYLIST'], [media + 'playlist_covers/header.jpg', 'HEADER'],
        [media + 'user_avatar/avatar.jpg', 'AVATAR'], ['file:///music/song.mp3', 'DO_NOT_INCLUDE_AUDIO'],
    ]);
    entries = new Map();
    (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async uri => files.has(uri)
        ? { exists: true, isDirectory: false, size: files.get(uri)!.length, md5: createHash('md5').update(files.get(uri)!).digest('hex') }
        : { exists: [...files.keys()].some(path => path.startsWith(uri)), isDirectory: true });
    (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation(async uri => [...new Set([...files.keys()]
        .filter(path => path.startsWith(uri)).map(path => path.slice(uri.length).split('/')[0]))]);
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.getFreeDiskStorageAsync as jest.Mock).mockResolvedValue(1e9);
    (FileSystem.copyAsync as jest.Mock).mockImplementation(async ({ from, to }) => {
        if (!files.has(from)) throw new Error('Missing file');
        files.set(to, files.get(from)!);
    });
    (FileSystem.deleteAsync as jest.Mock).mockImplementation(async uri => { files.delete(uri); });
    (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (uri, value) => { files.set(uri, value); });
    (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async uri => {
        if (!files.has(uri)) throw new Error('Missing file'); return files.get(uri);
    });
    (zip as jest.Mock).mockImplementation(async (from, to) => {
        const prefix = 'file://' + from;
        entries = new Map([...files.entries()].filter(([path]) => path.startsWith(prefix)).map(([path, value]) => [path.slice(prefix.length), value]));
        files.set('file://' + to, 'ZIP'); return to;
    });
    (getUncompressedSize as jest.Mock).mockImplementation(async () => [...entries.values()].reduce((sum, text) => sum + text.length, 0));
    (unzip as jest.Mock).mockImplementation(async (_uri, target) => {
        for (const [path, contents] of entries) files.set('file://' + target + path, contents);
        return target;
    });
});

async function exportArchive() {
    return createBackupArchive(data(), 'file:///cache/export/', { userAlias: 'User', userAvatarUri: media + 'user_avatar/avatar.jpg' }, jest.fn());
}

it('round-trips all DB tables, custom media, unassigned canvas and profile without music files', async () => {
    const exported = await exportArchive();
    expect(exported.missing).toBe(0);
    expect([...entries.values()]).not.toContain('DO_NOT_INCLUDE_AUDIO');
    expect([...entries.values()]).toContain('UNASSIGNED');
    const archive = await openBackupArchive(exported.uri, 'file:///cache/import/');
    expect(archive.data.tracks[0].lyrics_lrc).toBe('[00:01]Lyrics');
    expect(archive.data.playback_history[0].duration_played).toBe(100);
    const restored = await stageArchiveAssets(archive, 'import1');
    expect(restored.data.tracks[0].file_url).toBe('file:///music/song.mp3');
    expect(files.get(String(restored.data.tracks[0].bg_video))).toBe('VIDEO');
    expect(files.get(String(restored.data.albums[0].cd_art_url))).toBe('CUSTOM_CD');
    expect(restored.data.albums[0].cover_color_source).toBe(restored.data.albums[0].cover_url);
    expect(files.get(String(restored.data.artists[0].image_url))).toBe('ARTIST');
    expect(files.get(String(restored.data.playlists[0].header_custom_url))).toBe('HEADER');
    expect(files.get(restored.avatar!)).toBe('AVATAR');
    expect(files.get(media + 'album_covers/cover.jpg')).toBe('COVER');
});

it.each(['unsafe-path', 'future-schema', 'missing-asset', 'wrong-size', 'invalid-profile'] as const)('rejects %s archives before restoring any resources', async issue => {
    const exported = await exportArchive();
    const manifest = JSON.parse(entries.get('manifest.json')!);
    if (issue === 'unsafe-path') manifest.assets[0].path = '../escape.jpg';
    if (issue === 'future-schema') manifest.schemaVersion = 9999;
    if (issue === 'missing-asset') entries.delete(manifest.assets[0].path);
    if (issue === 'wrong-size') manifest.assets[0].size += 1;
    if (issue === 'invalid-profile') manifest.profile.userAlias = { unexpected: true };
    entries.set('manifest.json', JSON.stringify(manifest));
    await expect(openBackupArchive(exported.uri, 'file:///cache/import/')).rejects.toThrow();
});

it('checks disk space before extracting large archives', async () => {
    const exported = await exportArchive();
    (FileSystem.getFreeDiskStorageAsync as jest.Mock).mockResolvedValue(0);
    await expect(openBackupArchive(exported.uri, 'file:///cache/import/')).rejects.toThrow('backup.insufficient_space');
    expect(unzip).not.toHaveBeenCalled();
});

it('reuses identical restored resources when the same ZIP is imported again', async () => {
    const exported = await exportArchive(); const archive = await openBackupArchive(exported.uri, 'file:///cache/import/');
    const first = await stageArchiveAssets(archive, 'first');
    (FileSystem.copyAsync as jest.Mock).mockClear();
    const second = await stageArchiveAssets(archive, 'second');
    expect(second.data).toEqual(first.data);
    expect(second.avatar).toBe(first.avatar);
    expect(second.paths).toHaveLength(0);
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
});

it('reports unavailable referenced resources rather than claiming they were included', async () => {
    const input = data(); input.tracks[0].bg_video = 'file:///missing.mp4';
    const exported = await createBackupArchive(input, 'file:///cache/export/', { userAlias: null, userAvatarUri: null }, jest.fn());
    expect(exported.missing).toBe(1);
});

it('rolls back staged copies when restoring a resource fails', async () => {
    const exported = await exportArchive(); const archive = await openBackupArchive(exported.uri, 'file:///cache/import/');
    (FileSystem.copyAsync as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
    await expect(stageArchiveAssets(archive, 'failed')).rejects.toThrow('Disk full');
    expect([...files.keys()].some(path => path.includes('backup_failed_'))).toBe(false);
    expect(files.get(media + 'canvas_videos/selected.mp4')).toBe('VIDEO');
});
