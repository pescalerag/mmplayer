import { usePlayerStore } from '@/store/usePlayerStore';
import { useSyncStore } from '@/store/useSyncStore';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { PermissionService } from './PermissionService';
import { Platform, Image as RNImage } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { findAndScanUnindexedAudioFiles, getAudioFiles, getReplayGain, readMetadata } from '../../modules/native-audio-scanner';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Playlist from '../database/models/Playlist';
import Track from '../database/models/Track';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';
import { useMigrationStore } from '../store/useMigrationStore';
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
    onProgress?.(i18n.t('scanner.verifying_files'));
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
        onProgress?.(i18n.t('scanner.deleting_removed_tracks', { count: trackIdsToDelete.length }));
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

        const nullCoverUri = RNImage.resolveAssetSource(require('../assets/images/nullcover.png')).uri;
        const isDefaultCover = finalCoverUrl === nullCoverUri;
        let newCover = null;
        if (finalCoverUrl && album.coverUrl !== finalCoverUrl) {
            const isDowngradeToDefault = isDefaultCover && (album.coverUrl && album.coverUrl !== nullCoverUri);
            if (!isDowngradeToDefault) {
                newCover = finalCoverUrl;
            }
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
            onProgress?.(i, audioFiles.length, i18n.t('scanner.adding_to_library'));
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

const getFilenameFromUri = (uri: string) => {
    const clean = uri.split('?')[0];
    const lastSlash = clean.lastIndexOf('/');
    if (lastSlash === -1) return '';
    const raw = clean.substring(lastSlash + 1);
    try {
        return decodeURIComponent(raw).toLowerCase().trim();
    } catch {
        return raw.toLowerCase().trim();
    }
};

const runMultiTierMatching = (
    remainingOrphans: Track[],
    newCandidates: any[],
    artistMap: Map<string, string>,
    albumMap: Map<string, string>
): { track: Track; file: any }[] => {
    const matched: { track: Track; file: any }[] = [];

    // --- Tier 1: Nombre de archivo idéntico ---
    for (let i = remainingOrphans.length - 1; i >= 0; i--) {
        const orphan = remainingOrphans[i];
        const orphanName = getFilenameFromUri(orphan.fileUrl);
        if (!orphanName) continue;

        // Buscar todos los candidatos con el mismo nombre de archivo
        const matchingIndices: number[] = [];
        for (let j = 0; j < newCandidates.length; j++) {
            if (getFilenameFromUri(newCandidates[j].uri) === orphanName) {
                matchingIndices.push(j);
            }
        }

        if (matchingIndices.length === 1) {
            // Nombre de archivo único: coincidencia directa 100% segura
            const matchedFile = newCandidates.splice(matchingIndices[0], 1)[0];
            remainingOrphans.splice(i, 1);
            matched.push({ track: orphan, file: matchedFile });
        } else if (matchingIndices.length > 1) {
            // Varios archivos con el mismo nombre (ej: 01.mp3): desempatar por duración más cercana
            let bestIdx = -1;
            let bestDiff = 999999;
            for (const idx of matchingIndices) {
                const cand = newCandidates[idx];
                const diff = Math.abs((cand.duration || 0) - (orphan.duration || 0));
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestIdx = idx;
                }
            }
            if (bestIdx !== -1 && bestDiff <= 4.0) {
                const matchedFile = newCandidates.splice(bestIdx, 1)[0];
                remainingOrphans.splice(i, 1);
                matched.push({ track: orphan, file: matchedFile });
            }
        }
    }

    if (remainingOrphans.length === 0 || newCandidates.length === 0) return matched;

    // --- Tier 2: Huella completa (Título + Artista + Álbum + Duración) ---
    const getFullFp = (title: string, duration: number, artist: string = '', album: string = '') => {
        const cleanTitle = normalizeText(title);
        const cleanArtist = normalizeText(artist);
        const cleanAlbum = normalizeText(album);
        const roundedDuration = Math.round(duration);
        return `${roundedDuration}_${cleanTitle}_${cleanArtist}_${cleanAlbum}`;
    };

    const orphanFpMap = new Map<string, Track[]>();
    for (const track of remainingOrphans) {
        const trackArtistId = (track._raw as any).artist_id;
        const trackAlbumId = (track._raw as any).album_id;
        const artistName = artistMap.get(trackArtistId) || '';
        const albumTitle = albumMap.get(trackAlbumId) || '';
        const fp = getFullFp(track.title, track.duration, artistName, albumTitle);
        if (!orphanFpMap.has(fp)) orphanFpMap.set(fp, []);
        orphanFpMap.get(fp)!.push(track);
    }

    for (let j = newCandidates.length - 1; j >= 0; j--) {
        const file = newCandidates[j];
        const meta = extractFileMetadata(file);
        const fp = getFullFp(meta.title, meta.durationInSeconds, meta.artistString, meta.albumTitle);
        const matches = orphanFpMap.get(fp);
        if (matches && matches.length > 0) {
            const matchedTrack = matches.shift()!;
            const idx = remainingOrphans.indexOf(matchedTrack);
            if (idx !== -1) remainingOrphans.splice(idx, 1);
            newCandidates.splice(j, 1);
            matched.push({ track: matchedTrack, file });
        }
    }

    if (remainingOrphans.length === 0 || newCandidates.length === 0) return matched;

    // --- Tier 3: Huella relajada (Título + Artista + Duración) ---
    const getRelaxedFp = (title: string, duration: number, artist: string = '') => {
        const cleanTitle = normalizeText(title);
        const cleanArtist = normalizeText(artist);
        const roundedDuration = Math.round(duration);
        return `${roundedDuration}_${cleanTitle}_${cleanArtist}`;
    };

    const orphanRelaxedMap = new Map<string, Track[]>();
    for (const track of remainingOrphans) {
        const trackArtistId = (track._raw as any).artist_id;
        const artistName = artistMap.get(trackArtistId) || '';
        const fp = getRelaxedFp(track.title, track.duration, artistName);
        if (!orphanRelaxedMap.has(fp)) orphanRelaxedMap.set(fp, []);
        orphanRelaxedMap.get(fp)!.push(track);
    }

    for (let j = newCandidates.length - 1; j >= 0; j--) {
        const file = newCandidates[j];
        const meta = extractFileMetadata(file);
        const fp = getRelaxedFp(meta.title, meta.durationInSeconds, meta.artistString);
        const matches = orphanRelaxedMap.get(fp);
        if (matches && matches.length > 0) {
            const matchedTrack = matches.shift()!;
            const idx = remainingOrphans.indexOf(matchedTrack);
            if (idx !== -1) remainingOrphans.splice(idx, 1);
            newCandidates.splice(j, 1);
            matched.push({ track: matchedTrack, file });
        }
    }

    if (remainingOrphans.length === 0 || newCandidates.length === 0) return matched;

    // --- Tier 4: Título distintivo (>= 4 letras) + Álbum o Artista coincidente ---
    for (let i = remainingOrphans.length - 1; i >= 0; i--) {
        const orphan = remainingOrphans[i];
        const cleanTitle = normalizeText(orphan.title);
        if (cleanTitle.length < 4) continue;
        const trackArtistId = (orphan._raw as any).artist_id;
        const trackAlbumId = (orphan._raw as any).album_id;
        const orphanArtist = normalizeText(artistMap.get(trackArtistId) || '');
        const orphanAlbum = normalizeText(albumMap.get(trackAlbumId) || '');

        const matchIdx = newCandidates.findIndex(f => {
            const meta = extractFileMetadata(f);
            const cleanNewTitle = normalizeText(meta.title);
            if (cleanNewTitle !== cleanTitle) return false;
            const newArtist = normalizeText(meta.artistString);
            const newAlbum = normalizeText(meta.albumTitle);
            const durDiff = Math.abs(meta.durationInSeconds - orphan.duration);
            return (durDiff <= 3.0) || (orphanArtist && newArtist === orphanArtist) || (orphanAlbum && newAlbum === orphanAlbum);
        });

        if (matchIdx !== -1) {
            const matchedFile = newCandidates.splice(matchIdx, 1)[0];
            remainingOrphans.splice(i, 1);
            matched.push({ track: orphan, file: matchedFile });
        }
    }

    if (remainingOrphans.length === 0 || newCandidates.length === 0) return matched;

    // --- Tier 5: Título distintivo (>= 4 letras) + Duración exacta (±2s) ---
    for (let i = remainingOrphans.length - 1; i >= 0; i--) {
        const orphan = remainingOrphans[i];
        const cleanTitle = normalizeText(orphan.title);
        if (cleanTitle.length < 4) continue;

        const matchIdx = newCandidates.findIndex(f => {
            const meta = extractFileMetadata(f);
            const cleanNewTitle = normalizeText(meta.title);
            const durDiff = Math.abs(meta.durationInSeconds - orphan.duration);
            return cleanNewTitle === cleanTitle && durDiff <= 2.0;
        });

        if (matchIdx !== -1) {
            const matchedFile = newCandidates.splice(matchIdx, 1)[0];
            remainingOrphans.splice(i, 1);
            matched.push({ track: orphan, file: matchedFile });
        }
    }

    return matched;
};

export const ScannerService = {
    syncLibrary: async (
        onProgress?: (current: number, total: number, phase: string) => void,
        isSilent: boolean = false,
        forcedFileUrls?: Set<string> | string[] | Map<string, any>
    ) => {
        if (useSyncStore.getState().isScanning) {
            let waitCount = 0;
            while (useSyncStore.getState().isScanning && waitCount < 30) {
                await new Promise(r => setTimeout(r, 200));
                waitCount++;
            }
            if (useSyncStore.getState().isScanning) return;
        }
        try {
            coverExistsCache.clear();
            useSyncStore.getState().setIsScanning(true, isSilent);

            onProgress?.(0, 0, i18n.t('scanner.requesting_permissions'));
            const status = await PermissionService.requestAudioPermission();
            if (status !== 'granted') {
                throw new Error(i18n.t('scanner.permission_denied'));
            }

            onProgress?.(0, 0, i18n.t('scanner.searching_files'));
            let audioFiles = await getAudioFiles(false);
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
            onProgress?.(0, 0, i18n.t('scanner.analyzing_changes'));
            const allTracks = await tracksCollection.query().fetch();
            
            const excludedFolders = useSettingsStore.getState().excludedFolders;
            const excludedSongs = useSettingsStore.getState().excludedSongs || [];

            const isExcluded = (uri: string) => {
                const lastSlash = uri.lastIndexOf('/');
                const folder = lastSlash !== -1 ? uri.substring(0, lastSlash) : '';
                return excludedFolders.includes(folder) || excludedSongs.includes(uri);
            };

            const devicePaths = new Set<string>();
            const isDevicePath = (uri: string) => {
                if (!uri) return false;
                if (devicePaths.has(uri)) return true;
                if (uri.includes('%23') && devicePaths.has(uri.replace(/%23/g, '#'))) return true;
                if (uri.includes('#') && devicePaths.has(uri.replace(/#/g, '%23'))) return true;
                return false;
            };

            const populateActiveAudioFiles = (files: any[]) => {
                devicePaths.clear();
                return files.filter(f => {
                    if (isExcluded(f.uri)) return false;
                    devicePaths.add(f.uri);
                    if (f.uri.includes('#')) {
                        devicePaths.add(f.uri.replace(/#/g, '%23'));
                    }
                    return true;
                });
            };

            let activeAudioFiles = populateActiveAudioFiles(audioFiles);

            const dbPaths = new Set<string>();
            allTracks.forEach(t => {
                dbPaths.add(t.fileUrl);
                if (t.fileUrl.includes('%23')) {
                    dbPaths.add(t.fileUrl.replace(/%23/g, '#'));
                }
                if (t.fileUrl.includes('#')) {
                    dbPaths.add(t.fileUrl.replace(/#/g, '%23'));
                }
            });

            // canciones_huerfanas: en la BD pero no en el móvil
            let canciones_huerfanas = allTracks.filter(t => !isDevicePath(t.fileUrl));
            let archivos_nuevos = activeAudioFiles.filter(f => !dbPaths.has(f.uri));

            // --- Fase de Detección en Disco y Migración ---
            // Si hay canciones en la BD que no aparecen en MediaStore, buscar en disco
            if (canciones_huerfanas.length > 0) {
                // Si alguna canción huérfana está en reproducción o en la cola, parar la reproducción
                await usePlayerStore.getState().checkAndPauseIfTracksActiveOrQueued(
                    canciones_huerfanas.map(t => t.id)
                ).catch(() => {});

                useMigrationStore.getState().startMigration(
                    canciones_huerfanas.length,
                    i18n.t('migration.searching_disk')
                );

                try {
                    const knownUris = Array.from(devicePaths);
                    const unindexedFiles = await findAndScanUnindexedAudioFiles(knownUris);
                    if (unindexedFiles.length > 0) {
                        useMigrationStore.getState().setPhase('indexing', i18n.t('migration.indexing_system'));
                        const refreshedAudio = await getAudioFiles(false);
                        if (refreshedAudio && refreshedAudio.length > 0) {
                            audioFiles = refreshedAudio;
                            activeAudioFiles = populateActiveAudioFiles(audioFiles);
                            canciones_huerfanas = allTracks.filter(t => !isDevicePath(t.fileUrl));
                            archivos_nuevos = activeAudioFiles.filter(f => !dbPaths.has(f.uri));
                        }
                    }
                } catch (diskScanErr) {
                    console.warn('[ScannerService] Error buscando archivos no indexados en disco:', diskScanErr);
                }
            }

            // archivos_modificados: en la BD y en el móvil, pero con lastModified mayor
            const trackMap = new Map<string, Track>();
            allTracks.forEach(t => {
                trackMap.set(t.fileUrl, t);
                if (t.fileUrl.includes('%23')) {
                    trackMap.set(t.fileUrl.replace(/%23/g, '#'), t);
                }
            });

            const forcedUrlsSet = forcedFileUrls
                ? (forcedFileUrls instanceof Set 
                    ? forcedFileUrls 
                    : (forcedFileUrls instanceof Map ? new Set(forcedFileUrls.keys()) : new Set(forcedFileUrls)))
                : undefined;
            const forcedMetaMap = forcedFileUrls instanceof Map ? forcedFileUrls : undefined;

            const archivos_modificados: { track: Track; file: any; isForced?: boolean }[] = [];
            for (const file of activeAudioFiles) {
                const existing = trackMap.get(file.uri) || (file.uri.includes('#') ? trackMap.get(file.uri.replace(/#/g, '%23')) : undefined);
                if (existing) {
                    const dbLastModified = existing.lastModified || 0;
                    const needsGenreBackfill = (existing.genre === null || existing.genre === undefined) && !!file.genre;
                    const isForced = !!(forcedUrlsSet && (
                        forcedUrlsSet.has(file.uri) ||
                        forcedUrlsSet.has(existing.fileUrl) ||
                        forcedUrlsSet.has(file.uri.replace(/#/g, '%23')) ||
                        forcedUrlsSet.has(existing.fileUrl.replace(/%23/g, '#'))
                    ));
                    if (file.lastModified > dbLastModified || needsGenreBackfill || isForced) {
                        if (isForced) {
                            file.lastModified = Date.now();
                        }
                        archivos_modificados.push({ track: existing, file, isForced });
                    }
                }
            }

            // Para archivos editados/forzados, leer metadatos físicos reales del archivo para evitar
            // que la latencia o caché desactualizada de Android MediaStore sobreescriba los cambios guardados.
            if (forcedUrlsSet && archivos_modificados.some(a => a.isForced)) {
                const parseNumOrNull = (val: any) => {
                    if (val === null || val === undefined || val === '') return null;
                    const parsed = parseInt(String(val), 10);
                    return isNaN(parsed) ? null : parsed;
                };

                for (const item of archivos_modificados) {
                    if (item.isForced) {
                        const file = item.file;
                        const existing = item.track;
                        try {
                            const physical = await readMetadata(file.uri);
                            if (physical) {
                                if (physical.title) file.title = physical.title;
                                if (physical.artist) file.artist = physical.artist;
                                if (physical.album) file.album = physical.album;
                                if (physical.albumArtist) file.albumArtist = physical.albumArtist;
                                if (physical.genre) file.genre = physical.genre;
                                if (physical.year) file.year = parseInt(physical.year, 10) || file.year;
                                if (physical.trackNumber) file.trackNumber = parseInt(physical.trackNumber, 10) || file.trackNumber;
                                if (physical.discNumber) file.discNumber = parseInt(physical.discNumber, 10) || file.discNumber;
                            }
                        } catch (readErr) {
                            console.warn('[ScannerService] No se pudo leer metadatos físicos directos para:', file.uri, readErr);
                        }

                        // Sobrescribir con cualquier metadato explícito pasado desde MetadataEditorService
                        const explicitMeta = forcedMetaMap?.get(file.uri) ||
                            forcedMetaMap?.get(existing.fileUrl) ||
                            (file.uri.includes('#') ? forcedMetaMap?.get(file.uri.replace(/#/g, '%23')) : undefined) ||
                            (existing.fileUrl.includes('%23') ? forcedMetaMap?.get(existing.fileUrl.replace(/%23/g, '#')) : undefined);

                        if (explicitMeta) {
                            if (explicitMeta.title !== undefined && explicitMeta.title !== null) file.title = explicitMeta.title;
                            if (explicitMeta.artist !== undefined && explicitMeta.artist !== null) file.artist = explicitMeta.artist;
                            if (explicitMeta.album !== undefined && explicitMeta.album !== null) file.album = explicitMeta.album;
                            if (explicitMeta.albumArtist !== undefined) file.albumArtist = explicitMeta.albumArtist || null;
                            if (explicitMeta.genre !== undefined) file.genre = explicitMeta.genre || null;
                            if (explicitMeta.year !== undefined) file.year = parseNumOrNull(explicitMeta.year);
                            if (explicitMeta.trackNumber !== undefined) file.trackNumber = parseNumOrNull(explicitMeta.trackNumber) || 0;
                            if (explicitMeta.discNumber !== undefined) file.discNumber = parseNumOrNull(explicitMeta.discNumber) || 1;
                            if (explicitMeta.coverArtPath !== undefined) {
                                file.coverUrl = explicitMeta.coverArtPath || RNImage.resolveAssetSource(require('../assets/images/nullcover.png')).uri;
                            }
                        }
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

            // --- Fase de Reconciliación Multicapa con Bucle Dinámico ---
            const remainingOrphans: Track[] = [...canciones_huerfanas];
            const canciones_reubicadas: { track: Track; file: any }[] = [];
            let unassignedNewFiles: any[] = [];

            const allArtists = await artistsCollection.query().fetch();
            const artistMap = new Map<string, string>();
            allArtists.forEach(a => artistMap.set(a.id, a.name));

            const allAlbums = await albumsCollection.query().fetch();
            const albumMap = new Map<string, string>();
            allAlbums.forEach(al => albumMap.set(al.id, al.title));

            if (remainingOrphans.length > 0) {
                if (useMigrationStore.getState().isVisible) {
                    useMigrationStore.getState().setPhase(
                        'reconciling',
                        i18n.t('migration.reconciling_tracks', { count: remainingOrphans.length })
                    );
                }

                const alreadyRelocatedUris = new Set<string>();
                let newCandidates = activeAudioFiles.filter(f => !dbPaths.has(f.uri));

                if (newCandidates.length > 0) {
                    const matched = runMultiTierMatching(remainingOrphans, newCandidates, artistMap, albumMap);
                    for (const m of matched) {
                        canciones_reubicadas.push(m);
                        alreadyRelocatedUris.add(m.file.uri);
                    }
                }

                // Si aún quedan huérfanas, esperar brevemente y re-consultar MediaStore por si hubo latencia de escritura en disco
                if (remainingOrphans.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                    const refreshedAudio = await getAudioFiles(false);
                    if (refreshedAudio && refreshedAudio.length > 0) {
                        audioFiles = refreshedAudio;
                        activeAudioFiles = populateActiveAudioFiles(audioFiles);
                        newCandidates = activeAudioFiles.filter(f => !dbPaths.has(f.uri) && !alreadyRelocatedUris.has(f.uri));
                        if (newCandidates.length > 0) {
                            const secondMatched = runMultiTierMatching(remainingOrphans, newCandidates, artistMap, albumMap);
                            for (const m of secondMatched) {
                                canciones_reubicadas.push(m);
                                alreadyRelocatedUris.add(m.file.uri);
                            }
                        }
                    }
                }

            }

            // Gestión de huérfanas no encontradas (3 opciones: Los he cambiado de sitio, Eliminar, Conservar y continuar)
            let shouldDeleteOrphans = false;
            while (remainingOrphans.length > 0) {
                const action = await useMigrationStore.getState().promptConfirmDelete(
                    remainingOrphans.length
                );

                if (action === 'delete') {
                    shouldDeleteOrphans = true;
                    break;
                } else if (action === 'keep') {
                    shouldDeleteOrphans = false;
                    break;
                } else if (action === 'retry') {
                    // "Los he cambiado de sitio": re-ejecuta la búsqueda de archivos en disco
                    useMigrationStore.getState().setPhase('searching', i18n.t('migration.searching_disk'));
                    try {
                        const knownUris = Array.from(devicePaths);
                        const unindexedFiles = await findAndScanUnindexedAudioFiles(knownUris);
                        if (unindexedFiles.length > 0) {
                            useMigrationStore.getState().setPhase('indexing', i18n.t('migration.indexing_system'));
                            await new Promise(resolve => setTimeout(resolve, 500));
                            const refreshedAudio = await getAudioFiles(false);
                            if (refreshedAudio && refreshedAudio.length > 0) {
                                audioFiles = refreshedAudio;
                                activeAudioFiles = populateActiveAudioFiles(audioFiles);
                            }
                        }
                    } catch (e) {
                        console.warn('[ScannerService] Error al reintentar escaneo de disco:', e);
                    }

                    useMigrationStore.getState().setPhase(
                        'reconciling',
                        i18n.t('migration.reconciling_tracks', { count: remainingOrphans.length })
                    );

                    const alreadyRelocatedUris = new Set<string>(canciones_reubicadas.map(r => r.file.uri));
                    const newCandidates = activeAudioFiles.filter(f => !dbPaths.has(f.uri) && !alreadyRelocatedUris.has(f.uri));
                    if (newCandidates.length > 0 && remainingOrphans.length > 0) {
                        const matched = runMultiTierMatching(remainingOrphans, newCandidates, artistMap, albumMap);
                        for (const m of matched) {
                            canciones_reubicadas.push(m);
                            alreadyRelocatedUris.add(m.file.uri);
                        }
                    }

                    if (remainingOrphans.length === 0) {
                        break;
                    }
                }
            }

            if (useMigrationStore.getState().isVisible) {
                useMigrationStore.getState().setPhase('cleaning', i18n.t('migration.cleaning_up'));
            }

            const alreadyRelocatedUrisFinal = new Set<string>(canciones_reubicadas.map(r => r.file.uri));
            unassignedNewFiles = activeAudioFiles.filter(f => !dbPaths.has(f.uri) && !alreadyRelocatedUrisFinal.has(f.uri));

            tracksReconciled = canciones_reubicadas.length;
            const canciones_actualizadas: { track: Track; file: any }[] = [
                ...canciones_reubicadas,
                ...archivos_modificados
            ];
            const canciones_nuevas_restantes: any[] = unassignedNewFiles;
            const canciones_huerfanas_restantes: Track[] = remainingOrphans;

            // --- Fase de Acción en WatermelonDB (Batch) ---
            let batchOps: any[] = [];
            const BATCH_SIZE = 500;

            const hasOrphansToDelete = shouldDeleteOrphans && canciones_huerfanas_restantes.length > 0;

            if (canciones_actualizadas.length > 0 || hasOrphansToDelete) {
                await database.write(async () => {
                    const artistCache = new Map<string, Artist>();
                    const albumCache = new Map<string, Album>();

                    const existingArtists = await artistsCollection.query().fetch();
                    for (const a of existingArtists) artistCache.set(a.name, a);

                    const existingAlbums = await albumsCollection.query().fetch();
                    for (const a of existingAlbums) albumCache.set(a.title, a);

                    if (canciones_actualizadas.length > 0) {
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

                    if (hasOrphansToDelete) {
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
                onProgress?.(0, canciones_nuevas_restantes.length, i18n.t('scanner.importing_new'));
                const result = await performCreateTracks(canciones_nuevas_restantes, onProgress);
                tracksCreated = result.added;
            }

            // --- Fase de Limpieza Final ---
            if (deletedTrackIds.length > 0 || tracksReconciled > 0 || tracksUpdated > 0) {
                onProgress?.(audioFiles.length, audioFiles.length, i18n.t('scanner.cleaning_database'));
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

            if (canciones_reubicadas.length > 0) {
                const relocatedTrackIds = canciones_reubicadas.map(r => r.track.id);
                await usePlayerStore.getState().handleRelocatedTracks(relocatedTrackIds);
            }

            // Sincronizar recientes tras cambios en la base de datos
            await usePlayerStore.getState().refreshRecentsFromDatabase().catch(() => {});

            // Actualizar pistas modificadas en el reproductor si están en cola o activas
            for (const item of archivos_modificados) {
                await usePlayerStore.getState().updateTrackMetadata(item.track.id).catch(() => {});
            }

            await normalizePinnedValues().catch(() => { });

            if (tracksCreated > 0) {
                await HistoryService.initializeDefaultsIfNeeded();
            }

            ArtistImageService.processMissingArtistImages({ isBackground: true });
            MediaAssetService.migrateLegacyCacheAssets();
            MediaAssetService.runGarbageCollector();

            onProgress?.(audioFiles.length, audioFiles.length, i18n.t('toasts.library_updated'));

            if (useMigrationStore.getState().isVisible) {
                useMigrationStore.getState().finishMigration();
            }

            showToastNotification(tracksCreated, tracksDeleted, tracksReconciled, tracksUpdated, isSilent);

        } catch (error: any) {
            console.error("Error en syncLibrary:", error);
            useMigrationStore.getState().close();
            if (!isSilent) {
                import('react-native').then(({ Alert }) => {
                    Alert.alert(i18n.t('scanner.scan_error'), error?.message || String(error));
                });
            }
        } finally {
            useSyncStore.getState().setIsScanning(false, false);
            useMigrationStore.getState().close();
        }
    },
    fullDataWipe: async (onProgress?: (current: number, total: number, phase: string) => void) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true);

            onProgress?.(0, 0, i18n.t('scanner.stopping_player'));
            await usePlayerStore.getState().clearPlayer();

            onProgress?.(0, 0, i18n.t('scanner.clearing_memory'));
            const mmkv = createMMKV();
            mmkv.remove('@player_persistence');
            mmkv.remove('@player_recents');
            usePlayerStore.setState({
                recentMedia: [],
                recentPlaylists: [],
            });

            onProgress?.(0, 0, i18n.t('scanner.clearing_config'));
            await AsyncStorage.removeItem('mmplayer-settings');
            useSettingsStore.setState({
                excludedFolders: [],
                excludedSongs: [],
                lastSeenVersion: null,
                hasSeenWelcomeModal: false,
            });

            onProgress?.(0, 0, i18n.t('scanner.resetting_database'));
            await database.write(async () => {
                await database.unsafeResetDatabase();
            });

            await ScannerService.autoScanAndroid(onProgress);
        } catch (error: any) {
            console.error('Error en fullDataWipe:', error);
            import('react-native').then(({ Alert }) => {
                Alert.alert(i18n.t('scanner.delete_scan_error'), error?.message || String(error));
            });
        } finally {
            useSyncStore.getState().setIsScanning(false);
        }
    },

    repairCollaborators: async (onProgress?: (current: number, total: number, phase: string) => void) => {
        if (useSyncStore.getState().isScanning) return;
        try {
            useSyncStore.getState().setIsScanning(true);
            onProgress?.(0, 0, i18n.t('scanner.analyzing_local_files'));
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

                    if (i % 50 === 0) onProgress?.(i, audioFiles.length, i18n.t('scanner.repairing_lost_artists'));

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

            onProgress?.(audioFiles.length, audioFiles.length, i18n.t('scanner.library_repaired_success'));
        } catch (error) {
            console.error("Error reparando colaboradores:", error);
        } finally {
            useSyncStore.getState().setIsScanning(false);
        }
    },

    repairCorruptedData: async (onProgress?: (phase: string) => void) => {
        try {
            onProgress?.(i18n.t('scanner.repairing_corrupt_data'));
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
            onProgress?.(i18n.t('scanner.repairing_artists'));
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
            onProgress?.(i18n.t('scanner.repairing_albums'));
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
            onProgress?.(i18n.t('scanner.repairing_tracks'));
            let index = 0;
            for (const track of tracks) {
                index++;
                if (index % 100 === 0) {
                    onProgress?.(i18n.t('scanner.repairing_tracks_progress', { current: index, total: tracks.length }));
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
                onProgress?.(i18n.t('scanner.saving_repairs', { count: batchOps.length }));
                for (let i = 0; i < batchOps.length; i += BATCH_SIZE) {
                    const chunk = batchOps.slice(i, i + BATCH_SIZE);
                    await database.write(async () => {
                        await database.batch(chunk);
                    });
                }
            }

            onProgress?.(i18n.t('scanner.repair_completed'));
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
                    onProgress?.(i18n.t('scanner.checking_albums'));
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
                    onProgress?.(i18n.t('scanner.checking_artists'));
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
            onProgress?.(i18n.t('scanner.searching_files_to_delete'));
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
                onProgress?.(i18n.t('scanner.deleting_songs_count', { count: tracksToDelete.length }));
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
                onProgress?.(i18n.t('scanner.cleaning_library'));
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
            onProgress?.(i18n.t('scanner.finding_song_to_delete'));
            const tracksCollection = database.collections.get<Track>('tracks');

            const tracksToDelete = await tracksCollection.query(
                Q.where('file_url', songPath)
            ).fetch();

            if (tracksToDelete.length > 0) {
                onProgress?.(i18n.t('scanner.deleting_song'));
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
                onProgress?.(i18n.t('scanner.cleaning_library'));
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
            onProgress?.(i18n.t('scanner.finding_songs_to_delete'));
            const tracksCollection = database.collections.get<Track>('tracks');

            const tracksToDelete = await tracksCollection.query(
                Q.where('file_url', Q.oneOf(songPaths))
            ).fetch();

            if (tracksToDelete.length > 0) {
                onProgress?.(i18n.t('scanner.deleting_songs_count', { count: tracksToDelete.length }));
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
                onProgress?.(i18n.t('scanner.cleaning_library'));
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