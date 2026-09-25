import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
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
    if (!sourceUri || !sourceUri.startsWith('file://')) return;
    if (sourceUri.includes('/cache/') || sourceUri.includes('/Caches/') || sourceUri.includes('DocumentPicker')) {
        try {
            await FileSystem.deleteAsync(sourceUri, { idempotent: true });
        } catch (e) {
            console.warn('[MediaAssetService] Error limpiando archivo temporal:', e);
        }
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

            const items: CanvasVideoItem[] = [];

            for (const file of videoFiles) {
                const uri = `${CANVAS_DIR}${file}`;
                try {
                    // Verificación rápida con stat (sin calcular MD5 de todo el archivo para evitar bloqueos)
                    const info = await FileSystem.getInfoAsync(uri);
                    if (info.exists) {
                        const hashMatch = file.match(/^canvas_([a-f0-9]+)\.[a-z0-9]+$/i);
                        const md5Val = hashMatch ? hashMatch[1] : `${file}_${info.size}`;

                        const thumbPath = `${CANVAS_THUMBNAILS_DIR}${file}.jpg`;
                        let thumbExists = false;
                        try {
                            const thumbInfo = await FileSystem.getInfoAsync(thumbPath);
                            thumbExists = thumbInfo.exists;
                        } catch {}

                        if (!thumbExists) {
                            try {
                                const genResult = await generateVideoThumbnail(uri, thumbPath);
                                if (genResult) {
                                    thumbExists = true;
                                }
                            } catch (e) {
                                console.warn(`[MediaAssetService] Error generando miniatura de ${file}:`, e);
                            }
                        }

                        items.push({
                            uri,
                            fileName: file,
                            size: info.size ?? 0,
                            md5: md5Val,
                            thumbnailUri: thumbExists ? thumbPath : null,
                            modificationTime: info.modificationTime,
                        });
                    }
                } catch (e) {
                    console.warn(`[MediaAssetService] Error leyendo archivo canvas ${file}:`, e);
                }
            }

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

        const ext = getFileExtension(sourceUri, 'mp4');
        let md5 = knownMd5;
        if (!md5) {
            try {
                const info = await FileSystem.getInfoAsync(sourceUri, { md5: true });
                if (info.exists && (info as any).md5) {
                    md5 = (info as any).md5;
                }
            } catch {}
        }

        const fileName = md5 ? `canvas_${md5}.${ext}` : `canvas_${Date.now()}.${ext}`;
        const destPath = `${CANVAS_DIR}${fileName}`;
        const thumbDest = `${CANVAS_THUMBNAILS_DIR}${fileName}.jpg`;

        if (sourceUri !== destPath && !sourceUri.startsWith(CANVAS_DIR)) {
            await FileSystem.copyAsync({ from: sourceUri, to: destPath });
            await cleanupTempSource(sourceUri);
        }

        try {
            await generateVideoThumbnail(destPath, thumbDest);
        } catch (err) {
            console.warn('[MediaAssetService] Error generando miniatura de vídeo:', err);
        }

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

        const ext = getFileExtension(sourceUri, 'mp4');
        let md5: string | undefined;
        try {
            const info = await FileSystem.getInfoAsync(sourceUri, { md5: true });
            if (info.exists && (info as any).md5) {
                md5 = (info as any).md5;
            }
        } catch {}

        const fileName = md5 ? `canvas_${md5}.${ext}` : `canvas_track_${trackId}.${ext}`;
        const destPath = `${CANVAS_DIR}${fileName}`;

        if (sourceUri === destPath || sourceUri.startsWith(CANVAS_DIR)) return sourceUri;

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
                const artistsColl = database.collections.get<Artist>('artists');
                const artists = await artistsColl.query().fetch();
                for (const artist of artists) {
                    if (artist.imageUrl && (artist.imageUrl.includes('/cache/') || artist.imageUrl.includes('/Caches/') || !artist.imageUrl.includes('/media_assets/'))) {
                        try {
                            const info = await FileSystem.getInfoAsync(artist.imageUrl);
                            if (info.exists) {
                                const newPath = await MediaAssetService.saveArtistImage(artist.id, artist.imageUrl);
                                await database.write(async () => {
                                    await artist.update(a => { a.imageUrl = newPath; });
                                });
                            }
                        } catch (e) {
                            console.warn(`[MediaAssetService] Error migrando imagen de artista ${artist.id}:`, e);
                        }
                    }
                }

                // 2. Migrar Portadas de Playlists
                const playlistsColl = database.collections.get<Playlist>('playlists');
                const playlists = await playlistsColl.query().fetch();
                for (const playlist of playlists) {
                    if (playlist.coverCustomUrl && (playlist.coverCustomUrl.includes('/cache/') || playlist.coverCustomUrl.includes('/Caches/') || !playlist.coverCustomUrl.includes('/media_assets/'))) {
                        try {
                            const info = await FileSystem.getInfoAsync(playlist.coverCustomUrl);
                            if (info.exists) {
                                const newPath = await MediaAssetService.savePlaylistCover(playlist.id, playlist.coverCustomUrl);
                                await database.write(async () => {
                                    await playlist.update(p => { p.coverCustomUrl = newPath; });
                                });
                            }
                        } catch (e) {
                            console.warn(`[MediaAssetService] Error migrando portada de playlist ${playlist.id}:`, e);
                        }
                    }
                }

                // 3. Migrar Diseños CD de Álbumes
                const albumsColl = database.collections.get<Album>('albums');
                const albums = await albumsColl.query().fetch();
                for (const album of albums) {
                    if (album.cdArtUrl && (album.cdArtUrl.includes('/cache/') || album.cdArtUrl.includes('/Caches/') || !album.cdArtUrl.includes('/media_assets/'))) {
                        try {
                            const info = await FileSystem.getInfoAsync(album.cdArtUrl);
                            if (info.exists) {
                                const newPath = await MediaAssetService.saveAlbumCDCover(album.id, album.cdArtUrl);
                                await database.write(async () => {
                                    await album.update(a => { a.cdArtUrl = newPath; });
                                });
                            }
                        } catch (e) {
                            console.warn(`[MediaAssetService] Error migrando CD de álbum ${album.id}:`, e);
                        }
                    }
                }

                // 4. Migrar Vídeos Canvas de Canciones
                const tracksColl = database.collections.get<Track>('tracks');
                const tracks = await tracksColl.query().fetch();
                for (const track of tracks) {
                    if (track.bgVideo && (track.bgVideo.includes('/cache/') || track.bgVideo.includes('/Caches/') || !track.bgVideo.includes('/media_assets/'))) {
                        try {
                            const info = await FileSystem.getInfoAsync(track.bgVideo);
                            if (info.exists) {
                                const newPath = await MediaAssetService.saveTrackCanvasVideo(track.id, track.bgVideo);
                                await database.write(async () => {
                                    await track.update(t => { t.bgVideo = newPath; });
                                });
                            }
                        } catch (e) {
                            console.warn(`[MediaAssetService] Error migrando canvas de canción ${track.id}:`, e);
                        }
                    }
                }
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

                // 1. Limpiar fotos de artistas huérfanas
                const artistsColl = database.collections.get<Artist>('artists');
                const allArtists = await artistsColl.query().fetch();
                const validArtistIds = new Set(allArtists.map(a => a.id));

                const artistFiles = await FileSystem.readDirectoryAsync(ARTIST_DIR);
                for (const file of artistFiles) {
                    const match = file.match(/^artist_(.+)\.[a-z0-9]+$/i);
                    if (match && !validArtistIds.has(match[1])) {
                        await FileSystem.deleteAsync(`${ARTIST_DIR}${file}`, { idempotent: true });
                    }
                }

                // 2. Limpiar portadas de playlists huérfanas
                const playlistsColl = database.collections.get<Playlist>('playlists');
                const allPlaylists = await playlistsColl.query().fetch();
                const validPlaylistIds = new Set(allPlaylists.map(p => p.id));

                const playlistFiles = await FileSystem.readDirectoryAsync(PLAYLIST_DIR);
                for (const file of playlistFiles) {
                    const match = file.match(/^playlist_(.+)\.[a-z0-9]+$/i);
                    if (match && !validPlaylistIds.has(match[1])) {
                        await FileSystem.deleteAsync(`${PLAYLIST_DIR}${file}`, { idempotent: true });
                    }
                }

                // 3. Limpiar CDs de álbumes huérfanos
                const albumsColl = database.collections.get<Album>('albums');
                const allAlbums = await albumsColl.query().fetch();
                const validAlbumIds = new Set(allAlbums.map(a => a.id));

                const cdFiles = await FileSystem.readDirectoryAsync(CD_DIR);
                for (const file of cdFiles) {
                    const match = file.match(/^album_cd_(.+)\.[a-z0-9]+$/i);
                    if (match && !validAlbumIds.has(match[1])) {
                        await FileSystem.deleteAsync(`${CD_DIR}${file}`, { idempotent: true });
                    }
                }

                // 4. Limpiar vídeos Canvas huérfanos
                const tracksColl = database.collections.get<Track>('tracks');
                const allTracks = await tracksColl.query().fetch();
                const validTrackIds = new Set(allTracks.map(t => t.id));

                const canvasFiles = await FileSystem.readDirectoryAsync(CANVAS_DIR);
                for (const file of canvasFiles) {
                    const match = file.match(/^canvas_track_(.+)\.[a-z0-9]+$/i);
                    if (match && !validTrackIds.has(match[1])) {
                        await FileSystem.deleteAsync(`${CANVAS_DIR}${file}`, { idempotent: true });
                    }
                }
            } catch (err) {
                console.error('[MediaAssetService] Error en Garbage Collector:', err);
            }
        }, 3000);
    }
};
