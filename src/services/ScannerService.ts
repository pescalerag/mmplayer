import { usePlayerStore } from '@/store/usePlayerStore';
import { useSyncStore } from '@/store/useSyncStore';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Image as RNImage } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { getAudioFiles, getReplayGain } from '../../modules/native-audio-scanner';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Playlist from '../database/models/Playlist';
import Track from '../database/models/Track';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';
import i18n from '../constants/i18n';
import { ArtistImageService } from './ArtistImageService';
import { HistoryService } from './HistoryService';
import { MediaAssetService } from './MediaAssetService';

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
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "");

const sanitizeDbString = (str: string | undefined | null) => {
    if (!str) return str;
    return str
        .replace(/[\0\x00-\x1F\x7F]/g, '')
        .replace(/#/g, '')
        .trim();
};

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

        const albumsCollection = database.collections.get('albums');
        const allAlbumsRaw = await albumsCollection.query().unsafeFetchRaw();
        allAlbumsRaw.forEach((album: any) => {
            if (album.artist_id) {
                activeEntityIds.add(album.artist_id);
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
    if (coverUrl && coverUrl.startsWith('content://')) {
        // Append query parameter with lastModified to bust image cache on updates
        const separator = coverUrl.includes('?') ? '&' : '?';
        coverUrl = `${coverUrl}${separator}t=${file.lastModified || Date.now()}`;
    } else if (!coverUrl) {
        coverUrl = RNImage.resolveAssetSource(require('../assets/images/nullcover.png')).uri;
    }

    const rawTitle = sanitizeDbString(file.title);
    const rawArtist = sanitizeDbString(file.artist);
    const rawAlbum = sanitizeDbString(file.album);
    const rawAlbumArtist = sanitizeDbString(file.albumArtist);
    const rawGenre = sanitizeDbString(file.genre);

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
    const genre = (rawGenre && rawGenre.trim().length > 0 && rawGenre.trim().toLowerCase() !== 'unknown genre')
        ? rawGenre.trim()
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
        genre,
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

const coverExistsCache = new Map<string, boolean>();

const checkCoverExists = async (uri: string | null): Promise<boolean> => {
    if (!uri) return false;
    if (coverExistsCache.has(uri)) {
        return coverExistsCache.get(uri)!;
    }
    try {
        // Strip query parameters for checking file info
        const cleanUri = uri.split('?')[0];
        const info = await FileSystem.getInfoAsync(cleanUri);
        coverExistsCache.set(uri, info.exists);
        return info.exists;
    } catch {
        coverExistsCache.set(uri, false);
        return false;
    }
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

    let finalCoverUrl = coverUrl;
    if (coverUrl && coverUrl.startsWith('content://')) {
        const exists = await checkCoverExists(coverUrl);
        if (!exists) {
            finalCoverUrl = RNImage.resolveAssetSource(require('../assets/images/nullcover.png')).uri;
        }
    }

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

        const isDefaultCover = finalCoverUrl === RNImage.resolveAssetSource(require('../assets/images/nullcover.png')).uri;
        let newCover = null;
        if (finalCoverUrl && album.coverUrl !== finalCoverUrl && !isDefaultCover) {
            newCover = finalCoverUrl;
        }

        if (nextArtist || newCover) {
            try {
                if ((album as any)._status === 'created') {
                    if (nextArtist) album.artist.set(nextArtist);
                    if (newCover) album.coverUrl = newCover;
                } else {
                    const updateOp = album.prepareUpdate((a: any) => {
                        if (nextArtist) a.artist.set(nextArtist);
                        if (newCover) a.coverUrl = newCover;
                    });
                    newAlbumOps.push(updateOp);
                    if (newCover) (album._raw as any).cover_url = newCover;
                    if (nextArtist) (album._raw as any).artist_id = nextArtist.id;
                }
            } catch (error: any) {
                if (error.message && error.message.includes('pending changes')) {
                    if (newCover) (album._raw as any).cover_url = newCover;
                    if (nextArtist) (album._raw as any).artist_id = nextArtist.id;
                } else {
                    throw error;
                }
            }
        }
    } else {
        const newAlbum = albumsCollection.prepareCreate((a: any) => {
            a.title = albumTitle;
            a.normalizedTitle = normalizeText(albumTitle);
            a.artist.set(primaryArtist);
            a.coverUrl = finalCoverUrl;
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
        t.fileUrl = file.uri.replace(/#/g, '%23');
        t.duration = meta.durationInSeconds;
        t.isFavorite = false;
        t.trackNumber = file.trackNumber || 0;
        t.discNumber = file.discNumber || 1;
        t.album.set(album);
        t.artist.set(primaryArtist);
        t.lastModified = meta.lastModified;
        t.genre = meta.genre || null;
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

const performCreateTracks = async (
    audioFiles: any[],
    onProgress?: (current: number, total: number, phase: string) => void
): Promise<{ added: number }> => {
    let added = 0;
    const artistsCollection = database.collections.get<Artist>('artists');
    const albumsCollection = database.collections.get<Album>('albums');
    const tracksCollection = database.collections.get<Track>('tracks');
    const collaboratorsCollection = database.collections.get('track_collaborators');

    const artistCache = new Map<string, Artist>();
    const albumCache = new Map<string, Album>();

    const existingArtists = await artistsCollection.query().fetch();
    for (const a of existingArtists) artistCache.set(a.name, a);

    const existingAlbums = await albumsCollection.query().fetch();
    for (const a of existingAlbums) albumCache.set(a.title, a);

    let batchOps: any[] = [];
    const BATCH_SIZE = 500;

    for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];

        if (i % 100 === 0) {
            onProgress?.(i, audioFiles.length, 'Añadiendo a tu biblioteca...');
        }

        const meta = extractFileMetadata(file);

        const { trackArtists, newArtistOps } = await resolveArtists(meta.artistString, artistCache, artistsCollection);
        batchOps.push(...newArtistOps);
        const primaryArtist = trackArtists[0];

        let albumArtistObj = primaryArtist;
        if (meta.albumArtist) {
            const { trackArtists: albumArtists, newArtistOps: newAlbumArtistOps } = await resolveArtists(meta.albumArtist, artistCache, artistsCollection);
            batchOps.push(...newAlbumArtistOps);
            if (albumArtists.length > 0) {
                albumArtistObj = albumArtists[0];
            }
        }

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

        const trackOps = prepareTrackRecords(file, meta, album!, primaryArtist, trackArtists, tracksCollection, collaboratorsCollection);
        batchOps.push(...trackOps);

        added++;

        if (batchOps.length >= BATCH_SIZE) {
            await database.write(async () => {
                await database.batch(batchOps);
            });
            batchOps = [];
        }
    }

    if (batchOps.length > 0) {
        await database.write(async () => {
            await database.batch(batchOps);
        });
    }

    return { added };
};

const performDeleteTracks = async (tracks: Track[]) => {
    const idsToDelete = tracks.map(t => t.id);

    const playlistTracksCollection = database.collections.get('playlist_tracks');
    const trackTagsCollection = database.collections.get('track_tags');
    const trackCollaboratorsCollection = database.collections.get('track_collaborators');
    const playbackHistoryCollection = database.collections.get('playback_history');

    const [playlistTracks, trackTags, trackCollaborators, playbackHistory] = await Promise.all([
        playlistTracksCollection.query(Q.where('track_id', Q.oneOf(idsToDelete))).fetch(),
        trackTagsCollection.query(Q.where('track_id', Q.oneOf(idsToDelete))).fetch(),
        trackCollaboratorsCollection.query(Q.where('track_id', Q.oneOf(idsToDelete))).fetch(),
        playbackHistoryCollection.query(Q.where('item_type', 'track'), Q.where('item_id', Q.oneOf(idsToDelete))).fetch()
    ]);

    await database.write(async () => {
        const batchOps = [
            ...tracks.map(t => t.prepareDestroyPermanently()),
            ...playlistTracks.map(r => r.prepareDestroyPermanently()),
            ...trackTags.map(r => r.prepareDestroyPermanently()),
            ...trackCollaborators.map(r => r.prepareDestroyPermanently()),
            ...playbackHistory.map(r => r.prepareDestroyPermanently())
        ];
        await database.batch(batchOps);
    });
};

const showToastNotification = (created: number, deleted: number, reconciled: number, modified: number = 0, isSilent = false) => {
    if (reconciled > 0) {
        const message = reconciled === 1
            ? i18n.t('toasts.library_reconciled', { count: reconciled })
            : i18n.t('toasts.library_reconciled_plural', { count: reconciled });
        useToastStore.getState().showToast(message, 'swap-horizontal');
    } else if (modified > 0 || (created > 0 && deleted > 0)) {
        useToastStore.getState().showToast(i18n.t('toasts.library_updated') || 'Biblioteca actualizada', 'sync');
    } else if (created > 0) {
        useToastStore.getState().showToast(i18n.t('toasts.library_added_tracks', { count: created }) || `${created} nuevas canciones añadidas`, 'add-circle');
    } else if (deleted > 0) {
        useToastStore.getState().showToast(i18n.t('toasts.library_deleted_tracks', { count: deleted }) || `${deleted} canciones eliminadas`, 'trash');
    } else {
        if (!isSilent) {
            useToastStore.getState().showToast(i18n.t('toasts.library_up_to_date') || 'Biblioteca al día', 'checkmark-circle');
        }
    }
};

export const ScannerService = {
    syncLibrary: async (onProgress?: (current: number, total: number, phase: string) => void, isSilent: boolean = false) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true, isSilent);

            onProgress?.(0, 0, 'Solicitando permisos...');
            const { status } = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
            if (status !== 'granted') {
                throw new Error('Permiso de lectura de medios denegado.');
            }

            onProgress?.(0, 0, 'Buscando archivos en el dispositivo...');
            const audioFiles = await getAudioFiles(false);
            if (!audioFiles || audioFiles.length === 0) {
                if (!isSilent) {
                    showToastNotification(0, 0, 0);
                }
                return;
            }

            const tracksCollection = database.collections.get<Track>('tracks');
            const albumsCollection = database.collections.get<Album>('albums');
            const artistsCollection = database.collections.get<Artist>('artists');

            // --- Fase 1: Diffing Rápido (Solo Strings) ---
            onProgress?.(0, 0, 'Analizando cambios...');
            const allTracks = await tracksCollection.query().fetch();
            
            const excludedFolders = useSettingsStore.getState().excludedFolders;
            const excludedSongs = useSettingsStore.getState().excludedSongs || [];

            const isExcluded = (uri: string) => {
                const lastSlash = uri.lastIndexOf('/');
                const folder = lastSlash !== -1 ? uri.substring(0, lastSlash) : '';
                return excludedFolders.includes(folder) || excludedSongs.includes(uri);
            };

            const devicePaths = new Set<string>();
            const activeAudioFiles = audioFiles.filter(f => {
                if (isExcluded(f.uri)) return false;
                devicePaths.add(f.uri);
                return true;
            });

            const dbPaths = new Set(allTracks.map(t => t.fileUrl));

            // canciones_huerfanas: en la BD pero no en el móvil
            const canciones_huerfanas = allTracks.filter(t => !devicePaths.has(t.fileUrl));

            // archivos_nuevos: en el móvil pero no en la BD
            const archivos_nuevos = activeAudioFiles.filter(f => !dbPaths.has(f.uri));

            // archivos_modificados: en la BD y en el móvil, pero con lastModified mayor
            const trackMap = new Map<string, Track>();
            allTracks.forEach(t => trackMap.set(t.fileUrl, t));

            const archivos_modificados: { track: Track; file: any }[] = [];
            for (const file of activeAudioFiles) {
                const existing = trackMap.get(file.uri);
                if (existing) {
                    const dbLastModified = existing.lastModified || 0;
                    const needsGenreBackfill = (existing.genre === null || existing.genre === undefined) && !!file.genre;
                    if (file.lastModified > dbLastModified || needsGenreBackfill) {
                        archivos_modificados.push({ track: existing, file });
                    }
                }
            }

            let tracksCreated = 0;
            let tracksDeleted = 0;
            let tracksReconciled = 0;
            let tracksUpdated = archivos_modificados.length;

            const deletedTrackIds: string[] = [];
            const deletedAlbumIds: string[] = [];
            const deletedArtistIds: string[] = [];

            // --- Fase 2: Condición de Escape (Fast-Path) ---
            const needsReconciliation = canciones_huerfanas.length > 0 && archivos_nuevos.length > 0;
            const hasModifiedFiles = archivos_modificados.length > 0;

            if (!needsReconciliation && !hasModifiedFiles) {
                if (canciones_huerfanas.length > 0) {
                    onProgress?.(0, 0, 'Eliminando canciones huérfanas...');
                    const idsToDelete = canciones_huerfanas.map(t => t.id);
                    deletedTrackIds.push(...idsToDelete);
                    tracksDeleted = canciones_huerfanas.length;

                    await performDeleteTracks(canciones_huerfanas);
                }

                if (archivos_nuevos.length > 0) {
                    onProgress?.(0, 0, 'Importando canciones nuevas...');
                    const result = await performCreateTracks(archivos_nuevos, onProgress);
                    tracksCreated = result.added;
                }
            } else {
                // --- Fase 3 & 4: Huella Ligera & Reconciliación ---
                if (needsReconciliation) {
                    onProgress?.(0, 0, 'Reconciliando canciones movidas...');
                } else {
                    onProgress?.(0, 0, 'Actualizando metadatos modificados...');
                }
                
                const allArtists = await artistsCollection.query().fetch();
                const artistMap = new Map<string, string>();
                allArtists.forEach(a => artistMap.set(a.id, a.name));

                const allAlbums = await albumsCollection.query().fetch();
                const albumMap = new Map<string, string>();
                allAlbums.forEach(al => albumMap.set(al.id, al.title));

                const getTrackFingerprint = (title: string, duration: number, artist: string = '', album: string = '') => {
                    const cleanTitle = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                    const cleanArtist = artist.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                    const cleanAlbum = album.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                    const roundedDuration = Math.round(duration);
                    return `${roundedDuration}_${cleanTitle}_${cleanArtist}_${cleanAlbum}`;
                };

                const orphanMap = new Map<string, Track[]>();
                for (const track of canciones_huerfanas) {
                    const trackArtistId = (track._raw as any).artist_id;
                    const trackAlbumId = (track._raw as any).album_id;
                    const artistName = artistMap.get(trackArtistId) || '';
                    const albumTitle = albumMap.get(trackAlbumId) || '';
                    const fp = getTrackFingerprint(track.title, track.duration, artistName, albumTitle);

                    if (!orphanMap.has(fp)) {
                        orphanMap.set(fp, []);
                    }
                    orphanMap.get(fp)!.push(track);
                }

                const canciones_actualizadas: { track: Track; file: any }[] = [...archivos_modificados];
                const canciones_nuevas_restantes: any[] = [];

                let matchedCount = 0;
                for (const file of archivos_nuevos) {
                    const meta = extractFileMetadata(file);
                    const fp = getTrackFingerprint(meta.title, meta.durationInSeconds, meta.artistString, meta.albumTitle);

                    const matchingOrphans = orphanMap.get(fp);
                    if (matchingOrphans && matchingOrphans.length > 0) {
                        const matchedTrack = matchingOrphans.shift()!;
                        canciones_actualizadas.push({
                            track: matchedTrack,
                            file: file
                        });
                        matchedCount++;
                    } else {
                        canciones_nuevas_restantes.push(file);
                    }
                }

                const canciones_huerfanas_restantes: Track[] = [];
                for (const tracks of orphanMap.values()) {
                    canciones_huerfanas_restantes.push(...tracks);
                }

                // --- Fase 5: Acción en WatermelonDB (Batch) ---
                let batchOps: any[] = [];
                const BATCH_SIZE = 500;

                if (canciones_actualizadas.length > 0 || canciones_huerfanas_restantes.length > 0) {
                    await database.write(async () => {
                        const artistCache = new Map<string, Artist>();
                        const albumCache = new Map<string, Album>();

                        const existingArtists = await artistsCollection.query().fetch();
                        for (const a of existingArtists) artistCache.set(a.name, a);

                        const existingAlbums = await albumsCollection.query().fetch();
                        for (const a of existingAlbums) albumCache.set(a.title, a);

                        if (canciones_actualizadas.length > 0) {
                            tracksReconciled = matchedCount;
                            for (const item of canciones_actualizadas) {
                                const matchedTrack = item.track;
                                const file = item.file;

                                const meta = extractFileMetadata(file);

                                const { trackArtists, newArtistOps } = await resolveArtists(meta.artistString, artistCache, artistsCollection);
                                batchOps.push(...newArtistOps);
                                const primaryArtist = trackArtists[0];

                                let albumArtistObj = primaryArtist;
                                if (meta.albumArtist) {
                                    const { trackArtists: albumArtists, newArtistOps: newAlbumArtistOps } = await resolveArtists(meta.albumArtist, artistCache, artistsCollection);
                                    batchOps.push(...newAlbumArtistOps);
                                    if (albumArtists.length > 0) {
                                        albumArtistObj = albumArtists[0];
                                    }
                                }

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

                                const updateOp = matchedTrack.prepareUpdate((t: any) => {
                                    t.fileUrl = file.uri.replace(/#/g, '%23');
                                    t.lastModified = file.lastModified || Date.now();
                                    t.title = meta.title;
                                    t.normalizedTitle = normalizeText(meta.title);
                                    t.duration = meta.durationInSeconds;
                                    t.trackNumber = file.trackNumber || 0;
                                    t.discNumber = file.discNumber || 1;
                                    t.album.set(album);
                                    t.artist.set(primaryArtist);
                                    t.genre = meta.genre || null;
                                });
                                batchOps.push(updateOp);

                                const collaboratorsCollection = database.collections.get('track_collaborators');
                                const existingCollabs = await collaboratorsCollection.query(Q.where('track_id', matchedTrack.id)).fetch();
                                const collabsToDestroy = existingCollabs.filter(c => !(c as any)._preparedState);
                                batchOps.push(...collabsToDestroy.map(c => c.prepareDestroyPermanently()));

                                for (const artist of trackArtists) {
                                    const newCollab = collaboratorsCollection.prepareCreate((tc: any) => {
                                        tc.track.set(matchedTrack);
                                        tc.artist.set(artist);
                                    });
                                    batchOps.push(newCollab);
                                }
                            }
                        }

                        if (canciones_huerfanas_restantes.length > 0) {
                            tracksDeleted = canciones_huerfanas_restantes.length;
                            const idsToDelete = canciones_huerfanas_restantes.map(t => t.id);
                            deletedTrackIds.push(...idsToDelete);

                            const playlistTracksCollection = database.collections.get('playlist_tracks');
                            const trackTagsCollection = database.collections.get('track_tags');
                            const trackCollaboratorsCollection = database.collections.get('track_collaborators');
                            const playbackHistoryCollection = database.collections.get('playback_history');

                            const [playlistTracks, trackTags, trackCollaborators, playbackHistory] = await Promise.all([
                                playlistTracksCollection.query(Q.where('track_id', Q.oneOf(idsToDelete))).fetch(),
                                trackTagsCollection.query(Q.where('track_id', Q.oneOf(idsToDelete))).fetch(),
                                trackCollaboratorsCollection.query(Q.where('track_id', Q.oneOf(idsToDelete))).fetch(),
                                playbackHistoryCollection.query(Q.where('item_type', 'track'), Q.where('item_id', Q.oneOf(idsToDelete))).fetch()
                            ]);

                            batchOps.push(
                                ...canciones_huerfanas_restantes.map(t => t.prepareDestroyPermanently()),
                                ...playlistTracks.map(r => r.prepareDestroyPermanently()),
                                ...trackTags.map(r => r.prepareDestroyPermanently()),
                                ...trackCollaborators.map(r => r.prepareDestroyPermanently()),
                                ...playbackHistory.map(r => r.prepareDestroyPermanently())
                            );
                        }

                        for (let i = 0; i < batchOps.length; i += BATCH_SIZE) {
                            const chunk = batchOps.slice(i, i + BATCH_SIZE);
                            await database.batch(chunk);
                        }
                    });
                }

                if (canciones_nuevas_restantes.length > 0) {
                    onProgress?.(0, canciones_nuevas_restantes.length, 'Importando canciones nuevas...');
                    const result = await performCreateTracks(canciones_nuevas_restantes, onProgress);
                    tracksCreated = result.added;
                }
            }

            // --- Fase de Limpieza Final ---
            if (deletedTrackIds.length > 0 || tracksReconciled > 0 || tracksUpdated > 0) {
                onProgress?.(audioFiles.length, audioFiles.length, 'Limpiando base de datos...');
                const deletedAlbums = await removeEmptyEntities(
                    albumsCollection,
                    tracksCollection,
                    'album_id',
                    'Limpiando álbumes vacíos...',
                    (phase) => onProgress?.(audioFiles.length, audioFiles.length, phase)
                );
                const deletedArtists = await removeEmptyEntities(
                    artistsCollection,
                    tracksCollection,
                    'artist_id',
                    'Limpiando artistas vacíos...',
                    (phase) => onProgress?.(audioFiles.length, audioFiles.length, phase)
                );
                deletedAlbumIds.push(...deletedAlbums);
                deletedArtistIds.push(...deletedArtists);
            }

            if (deletedTrackIds.length > 0 || deletedAlbumIds.length > 0 || deletedArtistIds.length > 0) {
                await usePlayerStore.getState().handleDeletedEntities(deletedTrackIds, deletedAlbumIds, deletedArtistIds);
            }

            await normalizePinnedValues().catch(() => { });

            if (tracksCreated > 0) {
                await HistoryService.initializeDefaultsIfNeeded();
            }

            ArtistImageService.processMissingArtistImages({ isBackground: true });
            MediaAssetService.migrateLegacyCacheAssets();
            MediaAssetService.runGarbageCollector();

            onProgress?.(audioFiles.length, audioFiles.length, '¡Librería actualizada!');

            showToastNotification(tracksCreated, tracksDeleted, tracksReconciled, tracksUpdated, isSilent);

        } catch (error: any) {
            console.error("Error en syncLibrary:", error);
            if (!isSilent) {
                import('react-native').then(({ Alert }) => {
                    Alert.alert('Error al escanear', error?.message || String(error));
                });
            }
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
        } catch (error: any) {
            console.error('Error en fullDataWipe:', error);
            import('react-native').then(({ Alert }) => {
                Alert.alert('Error al borrar/escanear', error?.message || String(error));
            });
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

    repairCorruptedData: async (onProgress?: (phase: string) => void) => {
        try {
            onProgress?.('Iniciando reparación de datos corruptos...');
            const tracksCollection = database.collections.get<Track>('tracks');
            const albumsCollection = database.collections.get<Album>('albums');
            const artistsCollection = database.collections.get<Artist>('artists');

            const [tracks, albums, artists] = await Promise.all([
                tracksCollection.query().fetch(),
                albumsCollection.query().fetch(),
                artistsCollection.query().fetch()
            ]);

            let batchOps: any[] = [];
            const BATCH_SIZE = 400;

            // Limpiar Artistas
            onProgress?.('Reparando artistas...');
            for (const artist of artists) {
                const cleanName = sanitizeDbString(artist.name) || 'Artista Desconocido';
                const normName = normalizeText(cleanName);

                if (artist.name !== cleanName || artist.normalizedName !== normName) {
                    batchOps.push(
                        artist.prepareUpdate(a => {
                            a.name = cleanName;
                            a.normalizedName = normName;
                        })
                    );
                }
            }

            // Limpiar Álbumes
            onProgress?.('Reparando álbumes...');
            for (const album of albums) {
                const cleanTitle = sanitizeDbString(album.title) || 'Álbum Desconocido';
                const normTitle = normalizeText(cleanTitle);

                if (album.title !== cleanTitle || album.normalizedTitle !== normTitle) {
                    batchOps.push(
                        album.prepareUpdate(a => {
                            a.title = cleanTitle;
                            a.normalizedTitle = normTitle;
                        })
                    );
                }
            }

            // Limpiar Tracks
            onProgress?.('Reparando canciones...');
            let index = 0;
            for (const track of tracks) {
                index++;
                if (index % 100 === 0) {
                    onProgress?.(`Reparando canciones (${index}/${tracks.length})...`);
                }
                const cleanTitle = sanitizeDbString(track.title) || 'Unknown Title';
                const normTitle = normalizeText(cleanTitle);
                let urlChanged = false;
                let cleanUrl = track.fileUrl;

                if (track.fileUrl.includes('#')) {
                    cleanUrl = track.fileUrl.replace(/#/g, '%23');
                    urlChanged = true;
                }

                if (track.title !== cleanTitle || track.normalizedTitle !== normTitle || urlChanged) {
                    batchOps.push(
                        track.prepareUpdate(t => {
                            t.title = cleanTitle;
                            t.normalizedTitle = normTitle;
                            if (urlChanged) t.fileUrl = cleanUrl;
                        })
                    );
                }
            }

            // Ejecutar en Lotes
            if (batchOps.length > 0) {
                onProgress?.(`Guardando ${batchOps.length} reparaciones en base de datos...`);
                for (let i = 0; i < batchOps.length; i += BATCH_SIZE) {
                    const chunk = batchOps.slice(i, i + BATCH_SIZE);
                    await database.write(async () => {
                        await database.batch(chunk);
                    });
                }
            }

            onProgress?.('¡Reparación completada!');
        } catch (error) {
            console.error('Error reparando datos corruptos:', error);
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
                        const countAlbums = await albumsCollection.query(Q.where('artist_id', artistId)).fetchCount();
                        if (countTracks === 0 && countCollabs === 0 && countAlbums === 0) {
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

            // Buscamos todas las canciones cuya URL empiece por la ruta de la carpeta y filtramos por la carpeta exacta
            const allTracks = await tracksCollection.query(
                Q.where('file_url', Q.like(`${folderPath}%`))
            ).fetch();

            const tracksToDelete = allTracks.filter(t => {
                const lastSlash = t.fileUrl.lastIndexOf('/');
                if (lastSlash === -1) return false;
                const dirPath = t.fileUrl.substring(0, lastSlash);
                return dirPath === folderPath;
            });

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

                for (const t of tracksToDelete) {
                    await MediaAssetService.removeTrackCanvasVideo(t.id);
                }

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

    deleteMultipleSongsContents: async (songPaths: string[], onProgress?: (phase: string) => void) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true);
            onProgress?.('Buscando canciones a eliminar...');
            const tracksCollection = database.collections.get<Track>('tracks');

            const tracksToDelete = await tracksCollection.query(
                Q.where('file_url', Q.oneOf(songPaths))
            ).fetch();

            if (tracksToDelete.length > 0) {
                onProgress?.('Eliminando canciones...');
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
            console.error("Error al borrar las canciones excluidas:", error);
        } finally {
            useSyncStore.getState().setIsScanning(false);
        }
    },

    autoScanAndroid: async (
        onProgress?: (current: number, total: number, phase: string) => void
    ): Promise<{ total: number; added: number; skipped: number }> => {
        await ScannerService.syncLibrary(onProgress, true);
        return { total: 0, added: 0, skipped: 0 };
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
    },

    runDeepReplayGainScan: async (
        onProgress?: (current: number, total: number, phase: string) => void
    ): Promise<number> => {
        try {
            const tracksCollection = database.collections.get<Track>('tracks');
            // Buscamos solo canciones que no tengan replay_gain asignado
            const tracksWithoutGain = await tracksCollection.query(
                Q.where('replay_gain', Q.eq(null as any))
            ).fetch();

            if (tracksWithoutGain.length === 0) {
                return 0;
            }

            console.log(`[ReplayGain Deep Scan] Encontradas ${tracksWithoutGain.length} canciones sin ReplayGain.`);

            const CHUNK_SIZE = 10;
            let processed = 0;

            for (let i = 0; i < tracksWithoutGain.length; i += CHUNK_SIZE) {
                const chunk = tracksWithoutGain.slice(i, i + CHUNK_SIZE);

                onProgress?.(processed, tracksWithoutGain.length, `Analizando volumen (${processed}/${tracksWithoutGain.length})...`);

                const batchOps: any[] = [];

                await Promise.all(chunk.map(async (track) => {
                    try {
                        const gain = await getReplayGain(track.fileUrl);
                        if (gain !== null && gain !== undefined) {
                            const parsedGain = typeof gain === 'number' ? gain : parseFloat(gain);
                            const updateOp = track.prepareUpdate((t: any) => {
                                t.replayGain = parsedGain;
                            });
                            batchOps.push(updateOp);
                        }
                    } catch (err) {
                        console.error(`Error al obtener ReplayGain para ${track.fileUrl}:`, err);
                    }
                }));

                if (batchOps.length > 0) {
                    await database.write(async () => {
                        await database.batch(batchOps);
                    });
                }

                processed += chunk.length;

                // Dar respiro a la UI
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            return tracksWithoutGain.length;
        } catch (error) {
            console.error("Error en runDeepReplayGainScan:", error);
            throw error;
        }
    },

    repairMissingAlbumCovers: async (
        onProgress?: (current: number, total: number, phase: string) => void
    ): Promise<number> => {
        try {
            const albumsCollection = database.collections.get<Album>('albums');
            const allAlbums = await albumsCollection.query().fetch();

            const affectedAlbums = allAlbums.filter(a => a.coverUrl && a.coverUrl.startsWith('content://'));

            if (affectedAlbums.length === 0) {
                return 0;
            }

            let repairedCount = 0;
            const batchOps: any[] = [];
            const BATCH_SIZE = 100;

            coverExistsCache.clear();

            for (let i = 0; i < affectedAlbums.length; i++) {
                const album = affectedAlbums[i];
                onProgress?.(i, affectedAlbums.length, `Verificando carátulas (${i}/${affectedAlbums.length})...`);

                const exists = await checkCoverExists(album.coverUrl);
                if (!exists) {
                    const nullCoverUri = RNImage.resolveAssetSource(require('../assets/images/nullcover.png')).uri;
                    const updateOp = album.prepareUpdate((a: any) => {
                        a.coverUrl = nullCoverUri;
                    });
                    batchOps.push(updateOp);
                    repairedCount++;
                }

                if (batchOps.length >= BATCH_SIZE) {
                    await database.write(async () => {
                        await database.batch(batchOps);
                    });
                    batchOps.length = 0;
                }
            }

            if (batchOps.length > 0) {
                await database.write(async () => {
                    await database.batch(batchOps);
                });
            }

            return repairedCount;
        } catch (error) {
            console.error("Error en repairMissingAlbumCovers:", error);
            throw error;
        }
    }
};