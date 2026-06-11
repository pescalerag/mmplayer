import { usePlayerStore } from '@/store/usePlayerStore';
import { useSyncStore } from '@/store/useSyncStore';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Image as RNImage } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { getAudioFiles } from '../../modules/native-audio-scanner';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Playlist from '../database/models/Playlist';
import Track from '../database/models/Track';
import { useSettingsStore } from '../store/useSettingsStore';
import { HistoryService } from './HistoryService';

const sanitizeArtistName = (name: string) => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replaceAll(/[\u0300-\u036f]/g, "")
        .replaceAll(/[^a-z0-9]/g, "_")
        .replaceAll(/_+/g, "_")
        .trim();
};

/** Elimina acentos y diacríticos para búsquedas sin acento */
const normalizeText = (value: string) =>
    value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

// 1. Helper function to find and delete tracks with missing files
const removeMissingTracks = async (tracksCollection: any, onProgress?: (phase: string) => void) => {
    onProgress?.('Verificando archivos existentes...');
    const allTracksRaw = await tracksCollection.query().unsafeFetchRaw();
    const trackIdsToDelete: string[] = [];

    const CHUNK_SIZE = 50;
    for (let i = 0; i < allTracksRaw.length; i += CHUNK_SIZE) {
        const chunk = allTracksRaw.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
            chunk.map(async (rawTrack: any) => {
                const fileUrl = rawTrack.file_url;
                if (!fileUrl) return { id: rawTrack.id, missing: true };
                try {
                    const fileInfo = await FileSystem.getInfoAsync(fileUrl);
                    return { id: rawTrack.id, missing: !fileInfo.exists };
                } catch {
                    return { id: rawTrack.id, missing: true };
                }
            })
        );

        for (const res of results) {
            if (res.missing) {
                trackIdsToDelete.push(res.id);
            }
        }
    }

    if (trackIdsToDelete.length > 0) {
        onProgress?.(`Eliminando ${trackIdsToDelete.length} canciones borradas...`);
        const BATCH_DELETE_SIZE = 100;
        for (let i = 0; i < trackIdsToDelete.length; i += BATCH_DELETE_SIZE) {
            const batchIds = trackIdsToDelete.slice(i, i + BATCH_DELETE_SIZE);
            const tracksToDelete = await tracksCollection.query(Q.where('id', Q.oneOf(batchIds))).fetch();

            const playlistTracksCollection = database.collections.get('playlist_tracks');
            const trackTagsCollection = database.collections.get('track_tags');
            const trackCollaboratorsCollection = database.collections.get('track_collaborators');
            const playbackHistoryCollection = database.collections.get('playback_history');

            const [playlistTracks, trackTags, trackCollaborators, playbackHistory] = await Promise.all([
                playlistTracksCollection.query(Q.where('track_id', Q.oneOf(batchIds))).fetch(),
                trackTagsCollection.query(Q.where('track_id', Q.oneOf(batchIds))).fetch(),
                trackCollaboratorsCollection.query(Q.where('track_id', Q.oneOf(batchIds))).fetch(),
                playbackHistoryCollection.query(Q.where('item_type', 'track'), Q.where('item_id', Q.oneOf(batchIds))).fetch()
            ]);

            await database.write(async () => {
                const batchOps = [
                    ...tracksToDelete.map((t: Track) => t.prepareDestroyPermanently()),
                    ...playlistTracks.map((r: any) => r.prepareDestroyPermanently()),
                    ...trackTags.map((r: any) => r.prepareDestroyPermanently()),
                    ...trackCollaborators.map((r: any) => r.prepareDestroyPermanently()),
                    ...playbackHistory.map((r: any) => r.prepareDestroyPermanently())
                ];
                await database.batch(batchOps);
            });
        }
    }
    return trackIdsToDelete;
};

const removeEmptyEntities = async (
    collection: any,
    tracksCollection: any,
    foreignKey: string, // 'album_id' o 'artist_id'
    progressMsg: string,
    onProgress?: (phase: string) => void
) => {
    onProgress?.(progressMsg);

    // 1. Traemos all a memoria como datos planos ligeros
    const [allEntitiesRaw, allTracksRaw] = await Promise.all([
        collection.query().unsafeFetchRaw(),
        tracksCollection.query().unsafeFetchRaw()
    ]);

    // 2. Extraemos los IDs que sí tienen canciones usando un Set (Búsqueda ultrarrápida)
    const activeEntityIds = new Set();
    allTracksRaw.forEach((track: any) => {
        if (track[foreignKey]) {
            activeEntityIds.add(track[foreignKey]);
        }
    });

    if (foreignKey === 'artist_id') {
        const collaboratorsCollection = database.collections.get('track_collaborators');
        const allCollaboratorsRaw = await collaboratorsCollection.query().unsafeFetchRaw();
        allCollaboratorsRaw.forEach((collab: any) => {
            if (collab.artist_id) {
                activeEntityIds.add(collab.artist_id);
            }
        });
    }

    // 3. Filtramos los IDs de las entidades que no están en el Set
    const entityIdsToDelete = allEntitiesRaw
        .filter((entity: any) => !activeEntityIds.has(entity.id))
        .map((entity: any) => entity.id);

    // 4. Borramos en bloque
    if (entityIdsToDelete.length > 0) {
        const BATCH_DELETE_SIZE = 100;
        for (let i = 0; i < entityIdsToDelete.length; i += BATCH_DELETE_SIZE) {
            const batchIds = entityIdsToDelete.slice(i, i + BATCH_DELETE_SIZE);
            const entitiesToDelete = await collection.query(Q.where('id', Q.oneOf(batchIds))).fetch();

            const itemType = foreignKey === 'album_id' ? 'album' : 'artist';

            let extraOps: any[] = [];
            if (itemType === 'album') {
                const albumTagsCollection = database.collections.get('album_tags');
                const albumTags = await albumTagsCollection.query(Q.where('album_id', Q.oneOf(batchIds))).fetch();
                extraOps.push(...albumTags.map((r: any) => r.prepareDestroyPermanently()));
            }

            const playbackHistoryCollection = database.collections.get('playback_history');
            const playbackHistory = await playbackHistoryCollection.query(Q.where('item_type', itemType), Q.where('item_id', Q.oneOf(batchIds))).fetch();
            extraOps.push(...playbackHistory.map((r: any) => r.prepareDestroyPermanently()));

            await database.write(async () => {
                const batchOps = [
                    ...entitiesToDelete.map((e: any) => e.prepareDestroyPermanently()),
                    ...extraOps
                ];
                await database.batch(batchOps);
            });
        }
    }
    return entityIdsToDelete;
};

// --- 1. Helper to extract metadata ---
const extractFileMetadata = (file: any) => {
    let coverUrl = file.coverUrl || null;
    if (!coverUrl) {
        coverUrl = RNImage.resolveAssetSource(require('../assets/images/nullcover.png')).uri;
    }

    const rawTitle = file.title?.trim();
    const rawArtist = file.artist?.trim();
    const rawAlbum = file.album?.trim();
    const rawAlbumArtist = file.albumArtist?.trim();

    const title = (!rawTitle || rawTitle === 'Unknown Title')
        ? file.filename.replace(/\.[^/.]+$/, '')
        : rawTitle;
    const artistString = (!rawArtist || rawArtist === 'Unknown Artist')
        ? 'Artista Desconocido'
        : rawArtist;
    const albumTitle = (!rawAlbum || rawAlbum === 'Unknown Album')
        ? 'Álbum Desconocido'
        : rawAlbum;
    const albumArtist = (rawAlbumArtist && rawAlbumArtist !== 'Unknown Artist' && rawAlbumArtist.length > 0)
        ? rawAlbumArtist
        : null;

    return {
        title,
        artistString,
        albumTitle,
        albumId: file.albumId || albumTitle,
        coverUrl: coverUrl,
        durationInSeconds: file.duration || 0,
        year: file.year || null,
        albumArtist,
        lastModified: file.lastModified || 0,
    };
};

// --- 2. Helper to resolve the local artist image ---
const getLocalArtistImage = async (name: string): Promise<string | null> => {
    const sanitized = sanitizeArtistName(name);
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) return null;

    const fileName = `artist_${sanitized}.jpg`;
    const imgPath = baseDir.endsWith('/') ? `${baseDir}${fileName}` : `${baseDir}/${fileName}`;

    try {
        const check = await FileSystem.getInfoAsync(imgPath);
        return check.exists ? imgPath : null;
    } catch {
        // Return null if file access fails; the UI will handle the missing image gracefully
        return null;
    }
};

// --- 3. Helper to resolve and optionally create artists ---
const resolveArtists = async (artistString: string, artistCache: Map<string, Artist>, artistsCollection: any) => {
    const names = artistString.split(/[~;,]/).map(s => s.trim()).filter(s => s.length > 0);
    if (names.length === 0) names.push('Artista Desconocido');

    const trackArtists: Artist[] = [];
    const newArtistOps: any[] = [];

    for (const name of names) {
        let artist = artistCache.get(name);
        if (!artist) {
            const imageUrl = await getLocalArtistImage(name);
            const newArtist = artistsCollection.prepareCreate((a: any) => {
                a.name = name;
                a.normalizedName = normalizeText(name);
                a.imageUrl = imageUrl;
                a.isPinned = false;
            });

            newArtistOps.push(newArtist);
            artistCache.set(name, newArtist);
            artist = newArtist;
        }
        trackArtists.push(artist!);
    }

    return { trackArtists, newArtistOps };
};

// --- 4. Helper to resolve and optionally create an album ---
const resolveAlbum = async (
    albumId: string,
    albumTitle: string,
    primaryArtist: Artist,
    isExplicitAlbumArtist: boolean,
    coverUrl: string | null,
    year: number | null,
    albumCache: Map<string, Album>,
    albumsCollection: any,
    artistCache: Map<string, Artist>,
    artistsCollection: any,
    newArtistOps: any[]
) => {
    const newAlbumOps: any[] = [];
    let album = albumCache.get(albumId) || albumCache.get(albumTitle);

    if (album) {
        const currentArtistId = (album._raw as any).artist_id;
        let nextArtist: Artist | null = null;

        if (isExplicitAlbumArtist && currentArtistId !== primaryArtist.id) {
            nextArtist = primaryArtist;
        } else if (!isExplicitAlbumArtist && currentArtistId !== primaryArtist.id && year !== null && album.year === year) {
            const { trackArtists: variosArtists, newArtistOps: newVariosOps } = await resolveArtists("Varios Artistas", artistCache, artistsCollection);
            const variosArtist = variosArtists[0];

            if (currentArtistId !== variosArtist.id) {
                newArtistOps.push(...newVariosOps);
                nextArtist = variosArtist;
            }
        }

        const isDefaultCover = coverUrl === RNImage.resolveAssetSource(require('../assets/images/nullcover.png')).uri;
        let newCover = null;
        if (coverUrl && album.coverUrl !== coverUrl && !isDefaultCover) {
            newCover = coverUrl;
        }

        if (nextArtist || newCover) {
            if ((album as any)._status === 'created') {
                if (nextArtist) album.artist.set(nextArtist);
                if (newCover) album.coverUrl = newCover;
            } else if ((album as any)._preparedState === 'update') {
                if (newCover) (album._raw as any).cover_url = newCover;
                if (nextArtist) (album._raw as any).artist_id = nextArtist.id;
            } else {
                const updateOp = album.prepareUpdate((a: any) => {
                    if (nextArtist) a.artist.set(nextArtist);
                    if (newCover) a.coverUrl = newCover;
                });
                newAlbumOps.push(updateOp);

                if (newCover) (album._raw as any).cover_url = newCover;
                if (nextArtist) (album._raw as any).artist_id = nextArtist.id;
            }
        }
    } else {
        const newAlbum = albumsCollection.prepareCreate((a: any) => {
            a.title = albumTitle;
            a.normalizedTitle = normalizeText(albumTitle);
            a.artist.set(primaryArtist);
            a.coverUrl = coverUrl;
            a.year = year;
            a.isPinned = false;
        });

        newAlbumOps.push(newAlbum);
        albumCache.set(albumId, newAlbum);
        albumCache.set(albumTitle, newAlbum);
        album = newAlbum;
    }

    return { album, newAlbumOps };
};

// --- 5. Helper to prepare tracks and collaborator records ---
const prepareTrackRecords = (
    file: any,
    meta: any,
    album: Album,
    primaryArtist: Artist,
    trackArtists: Artist[],
    tracksCollection: any,
    collaboratorsCollection: any
) => {
    const ops: any[] = [];

    const track = tracksCollection.prepareCreate((t: any) => {
        t.title = meta.title;
        t.normalizedTitle = normalizeText(meta.title);
        t.fileUrl = file.uri;
        t.duration = meta.durationInSeconds;
        t.isFavorite = false;
        t.trackNumber = file.trackNumber || 0;
        t.discNumber = file.discNumber || 1;
        t.album.set(album);
        t.artist.set(primaryArtist);
        t.lastModified = meta.lastModified;
    });
    ops.push(track);

    for (const artist of trackArtists) {
        const collaborator = collaboratorsCollection.prepareCreate((tc: any) => {
            tc.track.set(track);
            tc.artist.set(artist);
        });
        ops.push(collaborator);
    }

    return ops;
};

/**
 * Ensures every album, artist, and playlist with a NULL is_pinned gets set to false.
 * This fixes records created before the is_pinned column existed.
 */
const normalizePinnedValues = async () => {
    await database.write(async () => {
        const albumsCollection = database.collections.get<Album>('albums');
        const artistsCollection = database.collections.get<Artist>('artists');
        const playlistsCollection = database.collections.get<Playlist>('playlists');

        const [albums, artists, playlists] = await Promise.all([
            albumsCollection.query(Q.where('is_pinned', Q.eq(null as any))).fetch(),
            artistsCollection.query(Q.where('is_pinned', Q.eq(null as any))).fetch(),
            playlistsCollection.query(Q.where('is_pinned', Q.eq(null as any))).fetch(),
        ]);

        const ops = [
            ...albums.map(a => a.prepareUpdate(r => { r.isPinned = false; })),
            ...artists.map(a => a.prepareUpdate(r => { r.isPinned = false; })),
            ...playlists.map(p => p.prepareUpdate(r => { r.isPinned = false; })),
        ];

        if (ops.length > 0) {
            await database.batch(ops);
        }
    });
};

export const ScannerService = {
    syncLibrary: async (onProgress?: (current: number, total: number, phase: string) => void, isSilent: boolean = false) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true, isSilent);
            await ScannerService.cleanDeletedFiles((phase) => onProgress?.(0, 0, phase));
            await ScannerService.autoScanAndroid(onProgress);
        } catch (error) {
            console.error("Error en syncLibrary:", error);
        } finally {
            useSyncStore.getState().setIsScanning(false, false);
        }
    },

    fullDataWipe: async (onProgress?: (current: number, total: number, phase: string) => void) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true);

            onProgress?.(0, 0, 'Deteniendo reproductor...');
            await usePlayerStore.getState().clearPlayer();

            onProgress?.(0, 0, 'Borrando datos en memoria...');
            const mmkv = createMMKV();
            mmkv.remove('@player_persistence');
            mmkv.remove('@player_recents');
            usePlayerStore.setState({
                recentMedia: [],
                recentPlaylists: [],
            });

            onProgress?.(0, 0, 'Borrando configuración persistida...');
            await AsyncStorage.removeItem('mmplayer-settings');
            useSettingsStore.setState({
                excludedFolders: [],
                excludedSongs: [],
                lastSeenVersion: null,
            });

            onProgress?.(0, 0, 'Reiniciando base de datos local...');
            await database.write(async () => {
                await database.unsafeResetDatabase();
            });

            await ScannerService.autoScanAndroid(onProgress);
        } catch (error) {
            console.error('Error en fullDataWipe:', error);
        } finally {
            useSyncStore.getState().setIsScanning(false);
        }
    },

    repairCollaborators: async (onProgress?: (current: number, total: number, phase: string) => void) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true);
            onProgress?.(0, 0, 'Analizando archivos locales...');
            const audioFiles = await getAudioFiles();

            const tracksCollection = database.collections.get<Track>('tracks');
            const artistsCollection = database.collections.get<Artist>('artists');
            const collaboratorsCollection = database.collections.get('track_collaborators');

            const existingTracks = await tracksCollection.query().fetch();
            const trackMap = new Map<string, Track>();
            existingTracks.forEach(t => trackMap.set(t.fileUrl, t));

            await database.write(async () => {
                const artistCache = new Map<string, Artist>();
                const existingArtists = await artistsCollection.query().fetch();
                for (const a of existingArtists) artistCache.set(a.name, a);

                let batchOps: any[] = [];
                const BATCH_SIZE = 400;

                for (let i = 0; i < audioFiles.length; i++) {
                    const file = audioFiles[i];
                    const track = trackMap.get(file.uri);

                    if (!track) continue;

                    if (i % 50 === 0) onProgress?.(i, audioFiles.length, 'Reparando artistas perdidos...');

                    const meta = extractFileMetadata(file);
                    const { trackArtists, newArtistOps } = await resolveArtists(meta.artistString, artistCache, artistsCollection);
                    batchOps.push(...newArtistOps);

                    const existingCollabs = await collaboratorsCollection.query(Q.where('track_id', track.id)).fetch();
                    const collabsToDestroy = existingCollabs.filter(c => !(c as any)._preparedState);
                    batchOps.push(...collabsToDestroy.map(c => c.prepareDestroyPermanently()));

                    for (const artist of trackArtists) {
                        const newCollab = collaboratorsCollection.prepareCreate((tc: any) => {
                            tc.track.set(track);
                            tc.artist.set(artist);
                        });
                        batchOps.push(newCollab);
                    }

                    if (batchOps.length >= BATCH_SIZE) {
                        await database.batch(batchOps);
                        batchOps = [];
                    }
                }

                if (batchOps.length > 0) {
                    await database.batch(batchOps);
                }
            });

            onProgress?.(audioFiles.length, audioFiles.length, '¡Biblioteca reparada con éxito!');
        } catch (error) {
            console.error("Error reparando colaboradores:", error);
        } finally {
            useSyncStore.getState().setIsScanning(false);
        }
    },

    cleanDeletedFiles: async (
        arg1?: {
            targetAlbumIds?: string[];
            targetArtistIds?: string[];
            skipFileCheck?: boolean;
        } | ((phase: string) => void),
        arg2?: (phase: string) => void
    ) => {
        if (Platform.OS !== 'android') return;

        const options = typeof arg1 === 'object' ? arg1 : undefined;
        const onProgress = typeof arg1 === 'function' ? arg1 : arg2;

        let deletedTracks: string[] = [];
        let deletedAlbums: string[] = [];
        let deletedArtists: string[] = [];

        try {
            const tracksCollection = database.collections.get<Track>('tracks');
            const albumsCollection = database.collections.get<Album>('albums');
            const artistsCollection = database.collections.get<Artist>('artists');

            // Phase 1: Clean missing tracks
            if (!options?.skipFileCheck) {
                deletedTracks = await removeMissingTracks(tracksCollection, onProgress);
            }

            // Phase 2: Clean empty albums
            if (options?.targetAlbumIds !== undefined) {
                if (options.targetAlbumIds.length > 0) {
                    onProgress?.('Comprobando álbumes afectados...');
                    const albumsToDelete: Album[] = [];
                    for (const albumId of options.targetAlbumIds) {
                        const count = await tracksCollection.query(Q.where('album_id', albumId)).fetchCount();
                        if (count === 0) {
                            try {
                                const albumDoc = await albumsCollection.find(albumId);
                                albumsToDelete.push(albumDoc);
                            } catch {
                                // Already deleted or not found
                            }
                        }
                    }
                    if (albumsToDelete.length > 0) {
                        deletedAlbums = albumsToDelete.map(a => a.id);
                        await database.write(async () => {
                            const batchOps = albumsToDelete.map(a => a.prepareDestroyPermanently());
                            await database.batch(batchOps);
                        });
                    }
                }
            } else {
                deletedAlbums = await removeEmptyEntities(
                    albumsCollection,
                    tracksCollection,
                    'album_id',
                    'Limpiando álbumes vacíos...',
                    onProgress
                );
            }

            // Phase 3: Clean empty artists
            if (options?.targetArtistIds !== undefined) {
                if (options.targetArtistIds.length > 0) {
                    onProgress?.('Comprobando artistas afectados...');
                    const artistsToDelete: Artist[] = [];
                    const collaboratorsCollection = database.collections.get('track_collaborators');
                    for (const artistId of options.targetArtistIds) {
                        const countTracks = await tracksCollection.query(Q.where('artist_id', artistId)).fetchCount();
                        const countCollabs = await collaboratorsCollection.query(Q.where('artist_id', artistId)).fetchCount();
                        if (countTracks === 0 && countCollabs === 0) {
                            try {
                                const artistDoc = await artistsCollection.find(artistId);
                                artistsToDelete.push(artistDoc);
                            } catch {
                                // Already deleted or not found
                            }
                        }
                    }
                    if (artistsToDelete.length > 0) {
                        deletedArtists = artistsToDelete.map(a => a.id);
                        await database.write(async () => {
                            const batchOps = artistsToDelete.map(a => a.prepareDestroyPermanently());
                            await database.batch(batchOps);
                        });
                    }
                }
            } else {
                deletedArtists = await removeEmptyEntities(
                    artistsCollection,
                    tracksCollection,
                    'artist_id',
                    'Limpiando artistas vacíos...',
                    onProgress
                );
            }

        } catch (error) {
            console.error("Error limpiando archivos borrados:", error);
        }

        if (deletedTracks.length > 0 || deletedAlbums.length > 0 || deletedArtists.length > 0) {
            await usePlayerStore.getState().handleDeletedEntities(deletedTracks, deletedAlbums, deletedArtists);
        }

        // Normalize any NULL is_pinned values to false
        await normalizePinnedValues().catch(() => { });
    },

    deleteFolderContents: async (folderPath: string, onProgress?: (phase: string) => void) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true);
            onProgress?.('Buscando archivos a eliminar...');
            const tracksCollection = database.collections.get<Track>('tracks');

            // Buscamos todas las canciones cuya URL empiece por la ruta de la carpeta
            const tracksToDelete = await tracksCollection.query(
                Q.where('file_url', Q.like(`${folderPath}%`))
            ).fetch();

            if (tracksToDelete.length > 0) {
                onProgress?.(`Eliminando ${tracksToDelete.length} canciones...`);
                const trackIdsToDelete = tracksToDelete.map(t => t.id);

                const affectedAlbumIds = new Set<string>();
                const affectedArtistIds = new Set<string>();
                tracksToDelete.forEach((t: Track) => {
                    const albId = (t._raw as any).album_id as string | undefined;
                    const artId = (t._raw as any).artist_id as string | undefined;
                    if (albId) affectedAlbumIds.add(albId);
                    if (artId) affectedArtistIds.add(artId);
                });

                const BATCH_DELETE_SIZE = 100;
                for (let i = 0; i < trackIdsToDelete.length; i += BATCH_DELETE_SIZE) {
                    const batchIds = trackIdsToDelete.slice(i, i + BATCH_DELETE_SIZE);
                    const tracksToDeleteBatch = await tracksCollection.query(Q.where('id', Q.oneOf(batchIds))).fetch();

                    const playlistTracksCollection = database.collections.get('playlist_tracks');
                    const trackTagsCollection = database.collections.get('track_tags');
                    const trackCollaboratorsCollection = database.collections.get('track_collaborators');
                    const playbackHistoryCollection = database.collections.get('playback_history');

                    const [playlistTracks, trackTags, trackCollaborators, playbackHistory] = await Promise.all([
                        playlistTracksCollection.query(Q.where('track_id', Q.oneOf(batchIds))).fetch(),
                        trackTagsCollection.query(Q.where('track_id', Q.oneOf(batchIds))).fetch(),
                        trackCollaboratorsCollection.query(Q.where('track_id', Q.oneOf(batchIds))).fetch(),
                        playbackHistoryCollection.query(Q.where('item_type', 'track'), Q.where('item_id', Q.oneOf(batchIds))).fetch()
                    ]);

                    trackCollaborators.forEach((tc: any) => {
                        const artId = (tc._raw as any).artist_id as string | undefined;
                        if (artId) affectedArtistIds.add(artId);
                    });

                    await database.write(async () => {
                        const batchOps = [
                            ...tracksToDeleteBatch.map((t: Track) => t.prepareDestroyPermanently()),
                            ...playlistTracks.map((r: any) => r.prepareDestroyPermanently()),
                            ...trackTags.map((r: any) => r.prepareDestroyPermanently()),
                            ...trackCollaborators.map((r: any) => r.prepareDestroyPermanently()),
                            ...playbackHistory.map((r: any) => r.prepareDestroyPermanently())
                        ];
                        await database.batch(batchOps);
                    });
                }

                // Inform player store of immediate track deletions
                await usePlayerStore.getState().handleDeletedEntities(trackIdsToDelete, [], []);

                // Limpiamos los álbumes y artistas que se hayan quedado huérfanos
                onProgress?.('Limpiando la biblioteca...');
                await ScannerService.cleanDeletedFiles({
                    targetAlbumIds: Array.from(affectedAlbumIds),
                    targetArtistIds: Array.from(affectedArtistIds),
                    skipFileCheck: true
                }, onProgress);
            }
        } catch (error) {
            console.error("Error al borrar contenido de la carpeta:", error);
        } finally {
            useSyncStore.getState().setIsScanning(false);
        }
    },

    deleteSongContents: async (songPath: string, onProgress?: (phase: string) => void) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true);
            onProgress?.('Buscando canción a eliminar...');
            const tracksCollection = database.collections.get<Track>('tracks');

            const tracksToDelete = await tracksCollection.query(
                Q.where('file_url', songPath)
            ).fetch();

            if (tracksToDelete.length > 0) {
                onProgress?.('Eliminando canción...');
                const trackIdsToDelete = tracksToDelete.map(t => t.id);

                const affectedAlbumIds = new Set<string>();
                const affectedArtistIds = new Set<string>();
                tracksToDelete.forEach((t: Track) => {
                    const albId = (t._raw as any).album_id as string | undefined;
                    const artId = (t._raw as any).artist_id as string | undefined;
                    if (albId) affectedAlbumIds.add(albId);
                    if (artId) affectedArtistIds.add(artId);
                });

                const playlistTracksCollection = database.collections.get('playlist_tracks');
                const trackTagsCollection = database.collections.get('track_tags');
                const trackCollaboratorsCollection = database.collections.get('track_collaborators');
                const playbackHistoryCollection = database.collections.get('playback_history');

                const [playlistTracks, trackTags, trackCollaborators, playbackHistory] = await Promise.all([
                    playlistTracksCollection.query(Q.where('track_id', Q.oneOf(trackIdsToDelete))).fetch(),
                    trackTagsCollection.query(Q.where('track_id', Q.oneOf(trackIdsToDelete))).fetch(),
                    trackCollaboratorsCollection.query(Q.where('track_id', Q.oneOf(trackIdsToDelete))).fetch(),
                    playbackHistoryCollection.query(Q.where('item_type', 'track'), Q.where('item_id', Q.oneOf(trackIdsToDelete))).fetch()
                ]);

                trackCollaborators.forEach((tc: any) => {
                    const artId = (tc._raw as any).artist_id as string | undefined;
                    if (artId) affectedArtistIds.add(artId);
                });

                await database.write(async () => {
                    const batchOps = [
                        ...tracksToDelete.map((t: Track) => t.prepareDestroyPermanently()),
                        ...playlistTracks.map((r: any) => r.prepareDestroyPermanently()),
                        ...trackTags.map((r: any) => r.prepareDestroyPermanently()),
                        ...trackCollaborators.map((r: any) => r.prepareDestroyPermanently()),
                        ...playbackHistory.map((r: any) => r.prepareDestroyPermanently())
                    ];
                    await database.batch(batchOps);
                });

                // Inform player store of immediate track deletions
                await usePlayerStore.getState().handleDeletedEntities(trackIdsToDelete, [], []);

                // Limpiamos los álbumes y artistas que se hayan quedado huérfanos
                onProgress?.('Limpiando la biblioteca...');
                await ScannerService.cleanDeletedFiles({
                    targetAlbumIds: Array.from(affectedAlbumIds),
                    targetArtistIds: Array.from(affectedArtistIds),
                    skipFileCheck: true
                }, onProgress);
            }
        } catch (error) {
            console.error("Error al borrar la canción excluida:", error);
        } finally {
            useSyncStore.getState().setIsScanning(false);
        }
    },

    autoScanAndroid: async (
        onProgress?: (current: number, total: number, phase: string) => void
    ): Promise<{ total: number; added: number; skipped: number }> => {

        if (Platform.OS !== 'android') {
            console.warn("Auto-scan is only supported on Android right now.");
            return { total: 0, added: 0, skipped: 0 };
        }

        onProgress?.(0, 0, 'Solicitando permisos...');
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Permiso de lectura de medios denegado.');
        }

        onProgress?.(0, 0, 'Buscando archivos nuevos en el sistema...');
        const audioFiles = await getAudioFiles();

        if (!audioFiles || audioFiles.length === 0) {
            return { total: 0, added: 0, skipped: 0 };
        }

        let added = 0;
        let skipped = 0;

        const artistsCollection = database.collections.get<Artist>('artists');
        const albumsCollection = database.collections.get<Album>('albums');
        const tracksCollection = database.collections.get<Track>('tracks');
        const collaboratorsCollection = database.collections.get('track_collaborators');

        onProgress?.(0, audioFiles.length, 'Sincronizando...');

        const excludedFolders = useSettingsStore.getState().excludedFolders;
        const excludedSongs = useSettingsStore.getState().excludedSongs || [];

        const affectedAlbumIds = new Set<string>();
        const affectedArtistIds = new Set<string>();

        await database.write(async () => {
            const artistCache = new Map<string, Artist>();
            const albumCache = new Map<string, Album>();

            const existingArtists = await artistsCollection.query().fetch();
            for (const a of existingArtists) artistCache.set(a.name, a);

            const existingAlbums = await albumsCollection.query().fetch();
            for (const a of existingAlbums) albumCache.set(a.title, a);

            const existingTracks = await tracksCollection.query().fetch();
            const existingTrackMap = new Map<string, Track>();
            existingTracks.forEach(t => existingTrackMap.set(t.fileUrl, t));

            let batchOps: any[] = [];
            const BATCH_SIZE = 500;

            for (let i = 0; i < audioFiles.length; i++) {
                const file = audioFiles[i];

                if (i % 100 === 0) onProgress?.(i, audioFiles.length, 'Añadiendo a tu biblioteca...');

                const isFolderExcluded = excludedFolders.some(folderPath => file.uri.startsWith(folderPath));
                const isSongExcluded = excludedSongs.includes(file.uri);
                if (isFolderExcluded || isSongExcluded) {
                    skipped++;
                    continue;
                }

                const existingTrack = existingTrackMap.get(file.uri);
                if (existingTrack) {
                    if ((existingTrack as any)._preparedState) {
                        skipped++;
                        continue;
                    }
                    
                    const dbLastModified = existingTrack.lastModified || 0;
                    if (file.lastModified <= dbLastModified) {
                        skipped++;
                        continue;
                    }

                    // Guardar IDs de álbum y artista antiguos para limpiar si quedan vacíos
                    const oldAlbumId = (existingTrack._raw as any).album_id;
                    const oldArtistId = (existingTrack._raw as any).artist_id;
                    if (oldAlbumId) affectedAlbumIds.add(oldAlbumId);
                    if (oldArtistId) affectedArtistIds.add(oldArtistId);

                    // Se ha modificado el archivo: actualizamos metadatos
                    const meta = extractFileMetadata(file);

                    // Resolve Artists
                    const { trackArtists, newArtistOps } = await resolveArtists(meta.artistString, artistCache, artistsCollection);
                    batchOps.push(...newArtistOps);
                    const primaryArtist = trackArtists[0];

                    // Resolve Album Artist
                    let albumArtistObj = primaryArtist;
                    if (meta.albumArtist) {
                        const { trackArtists: albumArtists, newArtistOps: newAlbumArtistOps } = await resolveArtists(meta.albumArtist, artistCache, artistsCollection);
                        batchOps.push(...newAlbumArtistOps);
                        if (albumArtists.length > 0) {
                            albumArtistObj = albumArtists[0];
                        }
                    }

                    // Resolve Album
                    const { album, newAlbumOps } = await resolveAlbum(
                        meta.albumId,
                        meta.albumTitle,
                        albumArtistObj,
                        !!meta.albumArtist,
                        meta.coverUrl,
                        meta.year,
                        albumCache,
                        albumsCollection,
                        artistCache,
                        artistsCollection,
                        batchOps
                    );
                    batchOps.push(...newAlbumOps);

                    // Update Track metadata
                    const updateOp = existingTrack.prepareUpdate((t: any) => {
                        t.title = meta.title;
                        t.normalizedTitle = normalizeText(meta.title);
                        t.duration = meta.durationInSeconds;
                        t.trackNumber = file.trackNumber || 0;
                        t.discNumber = file.discNumber || 1;
                        t.lastModified = meta.lastModified;
                        t.album.set(album);
                        t.artist.set(primaryArtist);
                    });
                    batchOps.push(updateOp);

                    // Re-associate collaborators
                    const collaboratorsCollection = database.collections.get('track_collaborators');
                    const existingCollabs = await collaboratorsCollection.query(Q.where('track_id', existingTrack.id)).fetch();
                    existingCollabs.forEach(c => {
                        const collabArtistId = (c._raw as any).artist_id;
                        if (collabArtistId) affectedArtistIds.add(collabArtistId);
                    });
                    const collabsToDestroy = existingCollabs.filter(c => !(c as any)._preparedState);
                    batchOps.push(...collabsToDestroy.map(c => c.prepareDestroyPermanently()));

                    for (const artist of trackArtists) {
                        const newCollab = collaboratorsCollection.prepareCreate((tc: any) => {
                            tc.track.set(existingTrack);
                            tc.artist.set(artist);
                        });
                        batchOps.push(newCollab);
                    }

                    added++;
                } else {
                    // 1. Parse Metadata
                    const meta = extractFileMetadata(file);

                    // 2. Resolve Artists
                    const { trackArtists, newArtistOps } = await resolveArtists(meta.artistString, artistCache, artistsCollection);
                    batchOps.push(...newArtistOps);
                    const primaryArtist = trackArtists[0];

                    // 2.5 Resolve Album Artist if present
                    let albumArtistObj = primaryArtist;
                    if (meta.albumArtist) {
                        const { trackArtists: albumArtists, newArtistOps: newAlbumArtistOps } = await resolveArtists(meta.albumArtist, artistCache, artistsCollection);
                        batchOps.push(...newAlbumArtistOps);
                        if (albumArtists.length > 0) {
                            albumArtistObj = albumArtists[0];
                        }
                    }

                    // 3. Resolve Album
                    const { album, newAlbumOps } = await resolveAlbum(
                        meta.albumId,
                        meta.albumTitle,
                        albumArtistObj,
                        !!meta.albumArtist,
                        meta.coverUrl,
                        meta.year,
                        albumCache,
                        albumsCollection,
                        artistCache,
                        artistsCollection,
                        batchOps
                    );
                    batchOps.push(...newAlbumOps);

                    // 4. Create Track & Collaborators
                    const trackOps = prepareTrackRecords(file, meta, album!, primaryArtist, trackArtists, tracksCollection, collaboratorsCollection);
                    batchOps.push(...trackOps);

                    added++;
                }

                // 5. Batch Execution
                if (batchOps.length >= BATCH_SIZE) {
                    await database.batch(batchOps);
                    batchOps = [];
                }
            }

            if (batchOps.length > 0) {
                await database.batch(batchOps);
            }
        });

        // Limpiar álbumes/artistas vacíos si se cambiaron metadatos en tracks existentes
        if (affectedAlbumIds.size > 0 || affectedArtistIds.size > 0) {
            onProgress?.(audioFiles.length, audioFiles.length, 'Limpiando álbumes/artistas vacíos...');
            await ScannerService.cleanDeletedFiles({
                targetAlbumIds: Array.from(affectedAlbumIds),
                targetArtistIds: Array.from(affectedArtistIds),
                skipFileCheck: true
            }, (phase) => onProgress?.(audioFiles.length, audioFiles.length, phase)).catch(err => {
                console.error("Error limpiando álbumes/artistas vacíos tras actualización:", err);
            });
        }

        if (added > 0) {
            await HistoryService.initializeDefaultsIfNeeded();
        }

        // Normalize any NULL is_pinned values to false (covers pre-existing records)
        await normalizePinnedValues().catch(() => { });

        onProgress?.(audioFiles.length, audioFiles.length, '¡Librería actualizada!');
        return { total: audioFiles.length, added, skipped };
    },

    migrateLastModifiedIfNeeded: async () => {
        try {
            const tracksCollection = database.collections.get<Track>('tracks');
            const allTracks = await tracksCollection.query().fetch();
            const tracksToMigrate = allTracks.filter(t => !t.lastModified);

            if (tracksToMigrate.length === 0) {
                return;
            }

            console.log(`[Migration] Encontradas ${tracksToMigrate.length} canciones sin last_modified. Rellenando...`);

            const audioFiles = await getAudioFiles();
            const fileMap = new Map<string, number>();
            audioFiles.forEach(f => fileMap.set(f.uri, f.lastModified));

            let batchOps: any[] = [];
            const BATCH_SIZE = 400;

            await database.write(async () => {
                for (const track of tracksToMigrate) {
                    const lm = fileMap.get(track.fileUrl);
                    if (lm) {
                        const updateOp = track.prepareUpdate((t: any) => {
                            t.lastModified = lm;
                        });
                        batchOps.push(updateOp);
                    }

                    if (batchOps.length >= BATCH_SIZE) {
                        await database.batch(batchOps);
                        batchOps = [];
                    }
                }

                if (batchOps.length > 0) {
                    await database.batch(batchOps);
                }
            });

            console.log('[Migration] Migración de last_modified completada con éxito.');
        } catch (error) {
            console.error('[Migration] Error ejecutando migración de last_modified:', error);
        }
    }
};