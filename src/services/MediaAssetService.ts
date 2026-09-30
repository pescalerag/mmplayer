import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Model } from '@nozbe/watermelondb';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Playlist from '../database/models/Playlist';
import Track from '../database/models/Track';
import { generateVideoThumbnail } from '../../modules/native-audio-scanner';

const BASE_MEDIA_DIR = `${FileSystem.documentDirectory}media_assets/`;
const ARTIST_DIR = `${BASE_MEDIA_DIR}artist_images/`;
const PLAYLIST_DIR = `${BASE_MEDIA_DIR}playlist_covers/`;
const CD_DIR = `${BASE_MEDIA_DIR}cd_covers/`;
const CANVAS_DIR = `${BASE_MEDIA_DIR}canvas_videos/`;
const CANVAS_THUMBNAILS_DIR = `${BASE_MEDIA_DIR}canvas_thumbnails/`;
const USER_AVATAR_DIR = `${BASE_MEDIA_DIR}user_avatar/`;

const getFileExtension = (uri: string, defaultExt: string = 'jpg'): string => {
    if (!uri) return defaultExt;
    const cleanUri = uri.split('?')[0];
    const parts = cleanUri.split('.');
    if (parts.length > 1) {
        const ext = parts.pop()?.toLowerCase();
        if (ext && ext.length <= 4 && /^[a-z0-9]+$/.test(ext)) {
            return ext;
        }
    }
    return defaultExt;
};

const ensureDirectoryExists = async (dirPath: string) => {
    try {
        const info = await FileSystem.getInfoAsync(dirPath);
        if (!info.exists) {
            await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        }
    } catch (e) {
        console.error(`[MediaAssetService] Error creando directorio ${dirPath}:`, e);
    }
};

const purgeEntityFiles = async (dirPath: string, filePrefix: string) => {
    try {
        await ensureDirectoryExists(dirPath);
        const files = await FileSystem.readDirectoryAsync(dirPath);
        for (const file of files) {
            if (file.startsWith(filePrefix)) {
                const targetUri = `${dirPath}${file}`;
                await FileSystem.deleteAsync(targetUri, { idempotent: true });
            }
        }
    } catch (e) {
        console.warn(`[MediaAssetService] Error purgando archivos con prefijo ${filePrefix} en ${dirPath}:`, e);
    }
};

export interface CanvasVideoItem {
    uri: string;
    fileName: string;
    size: number;
    md5: string;
    thumbnailUri?: string | null;
    modificationTime?: number;
}

export const cleanupTempSource = async (sourceUri: string) => {
    if (!sourceUri?.startsWith('file://')) return;
    if (sourceUri.includes('/cache/') || sourceUri.includes('/Caches/') || sourceUri.includes('DocumentPicker')) {
        try {
            await FileSystem.deleteAsync(sourceUri, { idempotent: true });
        } catch (e) {
            console.warn('[MediaAssetService] Error limpiando archivo temporal:', e);
        }
    }
};

const ensureCanvasThumbnail = async (uri: string, thumbPath: string, fileName: string): Promise<boolean> => {
    try {
        const thumbInfo = await FileSystem.getInfoAsync(thumbPath);
        if (thumbInfo.exists) return true;
    } catch {}

    try {
        const genResult = await generateVideoThumbnail(uri, thumbPath);
        return Boolean(genResult);
    } catch (e) {
        console.warn(`[MediaAssetService] Error generando miniatura de ${fileName}:`, e);
        return false;
    }
};

const parseCanvasVideoItem = async (file: string): Promise<CanvasVideoItem | null> => {
    const uri = `${CANVAS_DIR}${file}`;
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) return null;

        const hashMatch = /^canvas_([a-f0-9]+)\.[a-z0-9]+$/i.exec(file);
        const md5Val = hashMatch ? hashMatch[1] : `${file}_${info.size}`;

        const thumbPath = `${CANVAS_THUMBNAILS_DIR}${file}.jpg`;
        const thumbExists = await ensureCanvasThumbnail(uri, thumbPath, file);

        return {
            uri,
            fileName: file,
            size: info.size ?? 0,
            md5: md5Val,
            thumbnailUri: thumbExists ? thumbPath : null,
            modificationTime: info.modificationTime,
        };
    } catch (e) {
        console.warn(`[MediaAssetService] Error leyendo archivo canvas ${file}:`, e);
        return null;
    }
};

const isExistingCanvasUri = async (sourceUri: string): Promise<boolean> => {
    if (!sourceUri.startsWith(CANVAS_DIR)) return false;
    const exists = await FileSystem.getInfoAsync(sourceUri).catch(() => ({ exists: false }));
    return Boolean(exists.exists);
};

const resolveVideoMd5 = async (sourceUri: string, knownMd5?: string): Promise<string | undefined> => {
    if (knownMd5) return knownMd5;
    try {
        const info = await FileSystem.getInfoAsync(sourceUri, { md5: true });
        if (info.exists && (info as any).md5) {
            return (info as any).md5;
        }
    } catch {}
    return undefined;
};

const findExistingCanvasByMd5 = async (md5?: string): Promise<string | null> => {
    if (!md5) return null;
    const existingVideos = await MediaAssetService.getAllUploadedCanvasVideos();
    const existing = existingVideos.find(v => v.md5 === md5);
    return existing ? existing.uri : null;
};

const persistCanvasFile = async (sourceUri: string, destPath: string): Promise<void> => {
    const destInfo = await FileSystem.getInfoAsync(destPath).catch(() => ({ exists: false }));
    if (!destInfo.exists && sourceUri !== destPath && !sourceUri.startsWith(CANVAS_DIR)) {
        await FileSystem.copyAsync({ from: sourceUri, to: destPath });
    }
};

const isLegacyAssetPath = (uri?: string | null): boolean => {
    if (!uri) return false;
    return uri.includes('/cache/') || uri.includes('/Caches/') || !uri.includes('/media_assets/');
};

const migrateSingleLegacyAsset = async <T extends Model>(
    record: T,
    currentUri: string | null | undefined,
    saveFn: (id: string, uri: string) => Promise<string>,
    updateField: (item: T, newPath: string) => void,
    label: string
): Promise<void> => {
    if (!isLegacyAssetPath(currentUri)) return;

    try {
        const info = await FileSystem.getInfoAsync(currentUri!);
        if (info.exists) {
            const newPath = await saveFn(record.id, currentUri!);
            await database.write(async () => {
                await record.update(item => {
                    updateField(item as T, newPath);
                });
            });
        }
    } catch (e) {
        console.warn(`[MediaAssetService] Error migrando ${label} ${record.id}:`, e);
    }
};

const migrateLegacyCollectionAssets = async <T extends Model>(
    collectionName: string,
    getUri: (item: T) => string | null | undefined,
    saveFn: (id: string, uri: string) => Promise<string>,
    updateField: (item: T, newPath: string) => void,
    label: string
): Promise<void> => {
    const coll = database.collections.get<T>(collectionName);
    const records = await coll.query().fetch();
    for (const record of records) {
        await migrateSingleLegacyAsset(record, getUri(record), saveFn, updateField, label);
    }
};

export const MediaAssetService = {
    cleanupTempSource,

    init: async () => {
        if (Platform.OS === 'web') return;
        await ensureDirectoryExists(BASE_MEDIA_DIR);
        await ensureDirectoryExists(ARTIST_DIR);
        await ensureDirectoryExists(PLAYLIST_DIR);
        await ensureDirectoryExists(CD_DIR);
        await ensureDirectoryExists(CANVAS_DIR);
        await ensureDirectoryExists(CANVAS_THUMBNAILS_DIR);
        await ensureDirectoryExists(USER_AVATAR_DIR);
    },

    saveUserAvatar: async (sourceUri: string): Promise<string> => {
        if (Platform.OS === 'web' || !sourceUri) return sourceUri;
        await MediaAssetService.init();

        const ext = getFileExtension(sourceUri, 'jpg');
        const prefix = `user_avatar.`;
        await purgeEntityFiles(USER_AVATAR_DIR, prefix);

        const destPath = `${USER_AVATAR_DIR}user_avatar.${ext}`;

        if (sourceUri === destPath) return `${destPath}?t=${Date.now()}`;

        await FileSystem.copyAsync({ from: sourceUri, to: destPath });
        await cleanupTempSource(sourceUri);
        return `${destPath}?t=${Date.now()}`;
    },

    removeUserAvatar: async (): Promise<void> => {
        if (Platform.OS === 'web') return;
        await purgeEntityFiles(USER_AVATAR_DIR, `user_avatar.`);
    },

    saveArtistImage: async (artistId: string, sourceUri: string): Promise<string> => {
        if (Platform.OS === 'web' || !sourceUri) return sourceUri;
        await MediaAssetService.init();

        const ext = getFileExtension(sourceUri, 'jpg');
        const prefix = `artist_${artistId}.`;
        await purgeEntityFiles(ARTIST_DIR, prefix);

        const destPath = `${ARTIST_DIR}artist_${artistId}.${ext}`;

        if (sourceUri === destPath) return `${destPath}?t=${Date.now()}`;

        await FileSystem.copyAsync({ from: sourceUri, to: destPath });
        await cleanupTempSource(sourceUri);
        return `${destPath}?t=${Date.now()}`;
    },

    removeArtistImage: async (artistId: string): Promise<void> => {
        if (Platform.OS === 'web') return;
        await purgeEntityFiles(ARTIST_DIR, `artist_${artistId}.`);
    },

    savePlaylistCover: async (playlistId: string, sourceUri: string): Promise<string> => {
        if (Platform.OS === 'web' || !sourceUri) return sourceUri;
        await MediaAssetService.init();

        const ext = getFileExtension(sourceUri, 'jpg');
        const prefix = `playlist_${playlistId}.`;
        await purgeEntityFiles(PLAYLIST_DIR, prefix);

        const destPath = `${PLAYLIST_DIR}playlist_${playlistId}.${ext}`;

        if (sourceUri === destPath) return `${destPath}?t=${Date.now()}`;

        await FileSystem.copyAsync({ from: sourceUri, to: destPath });
        await cleanupTempSource(sourceUri);
        return `${destPath}?t=${Date.now()}`;
    },

    removePlaylistCover: async (playlistId: string): Promise<void> => {
        if (Platform.OS === 'web') return;
        await purgeEntityFiles(PLAYLIST_DIR, `playlist_${playlistId}.`);
    },

    saveAlbumCDCover: async (albumId: string, sourceUri: string): Promise<string> => {
        if (Platform.OS === 'web' || !sourceUri) return sourceUri;
        await MediaAssetService.init();

        const ext = getFileExtension(sourceUri, 'jpg');
        const prefix = `album_cd_${albumId}.`;
        await purgeEntityFiles(CD_DIR, prefix);

        const destPath = `${CD_DIR}album_cd_${albumId}.${ext}`;

        if (sourceUri === destPath) return `${destPath}?t=${Date.now()}`;

        await FileSystem.copyAsync({ from: sourceUri, to: destPath });
        await cleanupTempSource(sourceUri);
        return `${destPath}?t=${Date.now()}`;
    },

    removeAlbumCDCover: async (albumId: string): Promise<void> => {
        if (Platform.OS === 'web') return;
        await purgeEntityFiles(CD_DIR, `album_cd_${albumId}.`);
    },

    /**
     * Obtiene todos los vídeos Canvas subidos a la aplicación de forma rápida.
     */
    getAllUploadedCanvasVideos: async (): Promise<CanvasVideoItem[]> => {
        if (Platform.OS === 'web') return [];
        await MediaAssetService.init();

        try {
            const files = await FileSystem.readDirectoryAsync(CANVAS_DIR);
            const videoFiles = files.filter(f => /\.(mp4|mov|mkv|webm|m4v|3gp)$/i.test(f));

            const itemPromises = videoFiles.map(file => parseCanvasVideoItem(file));
            const results = await Promise.all(itemPromises);
            const items = results.filter((item): item is CanvasVideoItem => item !== null);

            items.sort((a, b) => (b.modificationTime || 0) - (a.modificationTime || 0));
            return items;
        } catch (e) {
            console.error('[MediaAssetService] Error obteniendo vídeos canvas subidos:', e);
            return [];
        }
    },

    /**
     * Comprueba si un vídeo ya ha sido subido comparando su hash MD5 o tamaño.
     */
    checkCanvasDuplicate: async (sourceUri: string): Promise<{ isDuplicate: boolean; existingVideo?: CanvasVideoItem; md5?: string }> => {
        if (Platform.OS === 'web' || !sourceUri) return { isDuplicate: false };
        await MediaAssetService.init();

        try {
            const info = await FileSystem.getInfoAsync(sourceUri, { md5: true });
            if (!info.exists) return { isDuplicate: false };

            const md5 = (info as any).md5;
            const existingVideos = await MediaAssetService.getAllUploadedCanvasVideos();

            if (md5) {
                const match = existingVideos.find(v => v.md5 === md5);
                if (match) {
                    return { isDuplicate: true, existingVideo: match, md5 };
                }
            } else if (info.size > 0) {
                const match = existingVideos.find(v => v.size === info.size);
                if (match) {
                    return { isDuplicate: true, existingVideo: match };
                }
            }

            return { isDuplicate: false, md5 };
        } catch (e) {
            console.error('[MediaAssetService] Error comprobando duplicado canvas:', e);
            return { isDuplicate: false };
        }
    },

    /**
     * Guarda un nuevo vídeo Canvas en el almacenamiento persistente con prevención de duplicados por hash.
     */
    saveNewCanvasVideo: async (sourceUri: string, knownMd5?: string): Promise<string> => {
        if (Platform.OS === 'web' || !sourceUri) return sourceUri;
        await MediaAssetService.init();

        if (await isExistingCanvasUri(sourceUri)) return sourceUri;

        const md5 = await resolveVideoMd5(sourceUri, knownMd5);
        const existingUri = await findExistingCanvasByMd5(md5);
        if (existingUri) {
            await cleanupTempSource(sourceUri);
            return existingUri;
        }

        const ext = getFileExtension(sourceUri, 'mp4');
        const fileName = md5 ? `canvas_${md5}.${ext}` : `canvas_${Date.now()}.${ext}`;
        const destPath = `${CANVAS_DIR}${fileName}`;
        const thumbDest = `${CANVAS_THUMBNAILS_DIR}${fileName}.jpg`;

        await persistCanvasFile(sourceUri, destPath);
        await cleanupTempSource(sourceUri);
        await ensureCanvasThumbnail(destPath, thumbDest, fileName);

        return destPath;
    },

    /**
     * Asigna un vídeo Canvas a una lista de canciones en una única operación atómica por lote.
     */
    assignCanvasToTracks: async (tracks: Track[], videoUri: string): Promise<void> => {
        if (!tracks || tracks.length === 0) return;
        await database.write(async () => {
            const batchUpdates = tracks.map(track =>
                track.prepareUpdate(t => {
                    t.bgVideo = videoUri;
                })
            );
            await database.batch(batchUpdates);
        });
    },

    /**
     * Elimina el vídeo Canvas de una lista de canciones en una única operación atómica.
     */
    removeCanvasFromTracks: async (tracks: Track[]): Promise<void> => {
        if (!tracks || tracks.length === 0) return;
        await database.write(async () => {
            const batchUpdates = tracks.map(track =>
                track.prepareUpdate(t => {
                    t.bgVideo = null;
                })
            );
            await database.batch(batchUpdates);
        });
    },

    /**
     * Elimina un archivo de vídeo del almacenamiento y desasocia las canciones que lo usen.
     */
    deleteCanvasVideo: async (videoUri: string): Promise<void> => {
        if (Platform.OS === 'web' || !videoUri) return;
        try {
            const tracksColl = database.collections.get<Track>('tracks');
            const allTracks = await tracksColl.query().fetch();
            const matchingTracks = allTracks.filter(t => t.bgVideo === videoUri);

            if (matchingTracks.length > 0) {
                await database.write(async () => {
                    const batchUpdates = matchingTracks.map(track =>
                        track.prepareUpdate(t => {
                            t.bgVideo = null;
                        })
                    );
                    await database.batch(batchUpdates);
                });
            }

            await FileSystem.deleteAsync(videoUri, { idempotent: true });

            const fileName = videoUri.split('/').pop();
            if (fileName) {
                const thumbPath = `${CANVAS_THUMBNAILS_DIR}${fileName}.jpg`;
                await FileSystem.deleteAsync(thumbPath, { idempotent: true });
            }
        } catch (e) {
            console.error('[MediaAssetService] Error eliminando vídeo canvas:', e);
        }
    },

    saveTrackCanvasVideo: async (trackId: string, sourceUri: string): Promise<string> => {
        if (Platform.OS === 'web' || !sourceUri) return sourceUri;
        await MediaAssetService.init();

        if (sourceUri.startsWith(CANVAS_DIR)) {
            const exists = await FileSystem.getInfoAsync(sourceUri).catch(() => ({ exists: false }));
            if (exists.exists) return sourceUri;
        }

        const ext = getFileExtension(sourceUri, 'mp4');
        let md5: string | undefined;
        try {
            const info = await FileSystem.getInfoAsync(sourceUri, { md5: true });
            if (info.exists && (info as any).md5) {
                md5 = (info as any).md5;
            }
        } catch {}

        if (md5) {
            const existingVideos = await MediaAssetService.getAllUploadedCanvasVideos();
            const existing = existingVideos.find(v => v.md5 === md5);
            if (existing) {
                await cleanupTempSource(sourceUri);
                return existing.uri;
            }
        }

        const fileName = md5 ? `canvas_${md5}.${ext}` : `canvas_track_${trackId}.${ext}`;
        const destPath = `${CANVAS_DIR}${fileName}`;

        if (sourceUri === destPath) return sourceUri;

        const destInfo = await FileSystem.getInfoAsync(destPath).catch(() => ({ exists: false }));
        if (destInfo.exists) {
            await cleanupTempSource(sourceUri);
            return destPath;
        }

        await FileSystem.copyAsync({ from: sourceUri, to: destPath });
        await cleanupTempSource(sourceUri);
        return destPath;
    },

    removeTrackCanvasVideo: async (trackId: string): Promise<void> => {
        if (Platform.OS === 'web') return;
        await purgeEntityFiles(CANVAS_DIR, `canvas_track_${trackId}.`);
    },


    /**
     * Migración ligera en segundo plano para usuarios existentes con archivos en cacheDirectory o nombres antiguos.
     */
    migrateLegacyCacheAssets: async (): Promise<void> => {
        if (Platform.OS === 'web') return;
        setTimeout(async () => {
            try {
                await MediaAssetService.init();

                // 1. Migrar Fotos de Artistas
                await migrateLegacyCollectionAssets<Artist>(
                    'artists',
                    a => a.imageUrl,
                    MediaAssetService.saveArtistImage,
                    (a, newPath) => { a.imageUrl = newPath; },
                    'imagen de artista'
                );

                // 2. Migrar Portadas de Playlists
                await migrateLegacyCollectionAssets<Playlist>(
                    'playlists',
                    p => p.coverCustomUrl,
                    MediaAssetService.savePlaylistCover,
                    (p, newPath) => { p.coverCustomUrl = newPath; },
                    'portada de playlist'
                );

                // 3. Migrar Diseños CD de Álbumes
                await migrateLegacyCollectionAssets<Album>(
                    'albums',
                    a => a.cdArtUrl,
                    MediaAssetService.saveAlbumCDCover,
                    (a, newPath) => { a.cdArtUrl = newPath; },
                    'CD de álbum'
                );

                // 4. Migrar Vídeos Canvas de Canciones
                await migrateLegacyCollectionAssets<Track>(
                    'tracks',
                    t => t.bgVideo,
                    MediaAssetService.saveTrackCanvasVideo,
                    (t, newPath) => { t.bgVideo = newPath; },
                    'canvas de canción'
                );
            } catch (err) {
                console.error('[MediaAssetService] Error durante la migración de archivos:', err);
            }
        }, 1000);
    },

    /**
     * Garbage Collector para eliminar archivos huérfanos que ya no existen en WatermelonDB.
     */
    runGarbageCollector: async (): Promise<void> => {
        if (Platform.OS === 'web') return;
        setTimeout(async () => {
            try {
                await MediaAssetService.init();

                const cleanOrphanFiles = async (
                    dir: string,
                    pattern: RegExp,
                    validIds: Set<string>
                ) => {
                    const files = await FileSystem.readDirectoryAsync(dir);
                    for (const file of files) {
                        const match = pattern.exec(file);
                        if (match && !validIds.has(match[1])) {
                            await FileSystem.deleteAsync(`${dir}${file}`, { idempotent: true });
                        }
                    }
                };

                // 1. Limpiar fotos de artistas huérfanas
                const artistsColl = database.collections.get<Artist>('artists');
                const allArtists = await artistsColl.query().fetch();
                await cleanOrphanFiles(ARTIST_DIR, /^artist_(.+)\.[a-z0-9]+$/i, new Set(allArtists.map(a => a.id)));

                // 2. Limpiar portadas de playlists huérfanas
                const playlistsColl = database.collections.get<Playlist>('playlists');
                const allPlaylists = await playlistsColl.query().fetch();
                await cleanOrphanFiles(PLAYLIST_DIR, /^playlist_(.+)\.[a-z0-9]+$/i, new Set(allPlaylists.map(p => p.id)));

                // 3. Limpiar CDs de álbumes huérfanos
                const albumsColl = database.collections.get<Album>('albums');
                const allAlbums = await albumsColl.query().fetch();
                await cleanOrphanFiles(CD_DIR, /^album_cd_(.+)\.[a-z0-9]+$/i, new Set(allAlbums.map(a => a.id)));

                // 4. Limpiar vídeos Canvas huérfanos
                const tracksColl = database.collections.get<Track>('tracks');
                const allTracks = await tracksColl.query().fetch();
                await cleanOrphanFiles(CANVAS_DIR, /^canvas_track_(.+)\.[a-z0-9]+$/i, new Set(allTracks.map(t => t.id)));
            } catch (err) {
                console.error('[MediaAssetService] Error en Garbage Collector:', err);
            }
        }, 3000);
    }
};
