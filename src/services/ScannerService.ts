// src/services/ScannerService.ts
import { Q } from '@nozbe/watermelondb';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { getAudioFiles } from '../../modules/native-audio-scanner';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';

const sanitizeArtistName = (name: string) => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replaceAll(/[\u0300-\u036f]/g, "")
        .replaceAll(/[^a-z0-9]/g, "_")
        .replaceAll(/_+/g, "_")
        .trim();
};

// 1. Helper function to find and delete tracks with missing files
const removeMissingTracks = async (tracksCollection: any, onProgress?: (phase: string) => void) => {
    onProgress?.('Verificando archivos existentes...');
    const allTracks = await tracksCollection.query().fetch();
    const tracksToDelete: Track[] = [];

    for (const track of allTracks) {
        if (!track.fileUrl) {
            tracksToDelete.push(track);
            continue;
        }
        const fileInfo = await FileSystem.getInfoAsync(track.fileUrl);
        if (!fileInfo.exists) {
            tracksToDelete.push(track);
        }
    }

    if (tracksToDelete.length > 0) {
        onProgress?.(`Eliminando ${tracksToDelete.length} canciones borradas...`);
        await database.write(async () => {
            const batchOps = tracksToDelete.map(t => t.prepareDestroyPermanently());
            await database.batch(batchOps);
        });
    }
};

// 2. Generic helper function to delete parent entities (Albums or Artists) that have 0 tracks
const removeEmptyEntities = async (
    collection: any,
    tracksCollection: any,
    foreignKey: string,
    progressMsg: string,
    onProgress?: (phase: string) => void
) => {
    onProgress?.(progressMsg);
    const allEntities = await collection.query().fetch();
    const entitiesToDelete: any[] = [];

    for (const entity of allEntities) {
        const tracksCount = await tracksCollection.query(Q.where(foreignKey, entity.id)).fetchCount();
        if (tracksCount === 0) entitiesToDelete.push(entity);
    }

    if (entitiesToDelete.length > 0) {
        await database.write(async () => {
            const batchOps = entitiesToDelete.map(e => e.prepareDestroyPermanently());
            await database.batch(batchOps);
        });
    }
};

// --- 1. Helper to extract metadata ---
const extractFileMetadata = (file: any) => ({
    title: file.title?.trim() || file.filename.replace(/\.[^/.]+$/, ''),
    artistString: file.artist?.trim() || 'Artista Desconocido',
    albumTitle: file.album?.trim() || 'Álbum Desconocido',
    albumId: file.albumId || file.album?.trim() || 'Álbum Desconocido',
    coverUrl: file.coverUrl || null,
    durationInSeconds: file.duration || 0,
    year: file.year || null,
});

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
    const names = artistString.split('~').map(s => s.trim()).filter(s => s.length > 0);
    if (names.length === 0) names.push('Artista Desconocido');

    const trackArtists: Artist[] = [];
    const newArtistOps: any[] = [];

    for (const name of names) {
        let artist = artistCache.get(name);
        if (!artist) {
            const imageUrl = await getLocalArtistImage(name);
            const newArtist = artistsCollection.prepareCreate((a: any) => {
                a.name = name;
                a.imageUrl = imageUrl;
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
const resolveAlbum = (
    albumId: string,
    albumTitle: string,
    primaryArtist: Artist,
    coverUrl: string | null,
    year: number | null,
    albumCache: Map<string, Album>,
    albumsCollection: any
) => {
    const newAlbumOps: any[] = [];
    let album = albumCache.get(albumId);

    if (!album) {
        const newAlbum = albumsCollection.prepareCreate((a: any) => {
            a.title = albumTitle;
            a.artist.set(primaryArtist);
            a.coverUrl = coverUrl;
            a.year = year;
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
        t.fileUrl = file.uri;
        t.duration = meta.durationInSeconds;
        t.isFavorite = false;
        t.trackNumber = file.trackNumber || 0;
        t.discNumber = file.discNumber || 1;
        t.album.set(album);
        t.artist.set(primaryArtist);
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

export const ScannerService = {
    cleanDeletedFiles: async (onProgress?: (phase: string) => void) => {
        if (Platform.OS !== 'android') return;

        try {
            const tracksCollection = database.collections.get<Track>('tracks');
            const albumsCollection = database.collections.get<Album>('albums');
            const artistsCollection = database.collections.get<Artist>('artists');

            // Phase 1: Clean missing tracks
            await removeMissingTracks(tracksCollection, onProgress);

            // Phase 2: Clean empty albums
            await removeEmptyEntities(
                albumsCollection,
                tracksCollection,
                'album_id',
                'Limpiando álbumes vacíos...',
                onProgress
            );

            // Phase 3: Clean empty artists
            await removeEmptyEntities(
                artistsCollection,
                tracksCollection,
                'artist_id',
                'Limpiando artistas vacíos...',
                onProgress
            );

        } catch (error) {
            console.error("Error limpiando archivos borrados:", error);
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

        await database.write(async () => {
            const artistCache = new Map<string, Artist>();
            const albumCache = new Map<string, Album>();

            const existingArtists = await artistsCollection.query().fetch();
            for (const a of existingArtists) artistCache.set(a.name, a);

            const existingAlbums = await albumsCollection.query().fetch();
            for (const a of existingAlbums) albumCache.set(a.title, a);

            const existingTracksList = await tracksCollection.query().fetch();
            const existingLinks = new Set(existingTracksList.map(t => t.fileUrl));

            let batchOps: any[] = [];
            const BATCH_SIZE = 500;

            for (let i = 0; i < audioFiles.length; i++) {
                const file = audioFiles[i];

                if (i % 100 === 0) onProgress?.(i, audioFiles.length, 'Añadiendo a tu biblioteca...');

                if (existingLinks.has(file.uri)) {
                    skipped++;
                    continue;
                }

                // 1. Parse Metadata
                const meta = extractFileMetadata(file);

                // 2. Resolve Artists
                const { trackArtists, newArtistOps } = await resolveArtists(meta.artistString, artistCache, artistsCollection);
                batchOps.push(...newArtistOps);
                const primaryArtist = trackArtists[0];

                // 3. Resolve Album
                const { album, newAlbumOps } = resolveAlbum(
                    meta.albumId, 
                    meta.albumTitle, 
                    primaryArtist, 
                    meta.coverUrl, 
                    meta.year,
                    albumCache, 
                    albumsCollection
                );
                batchOps.push(...newAlbumOps);

                // 4. Create Track & Collaborators
                const trackOps = prepareTrackRecords(file, meta, album!, primaryArtist, trackArtists, tracksCollection, collaboratorsCollection);
                batchOps.push(...trackOps);

                added++;

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

        onProgress?.(audioFiles.length, audioFiles.length, '¡Librería actualizada!');
        return { total: audioFiles.length, added, skipped };
    }
};