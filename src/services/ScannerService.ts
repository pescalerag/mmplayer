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
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .trim();
};

export const ScannerService = {
    cleanDeletedFiles: async (onProgress?: (phase: string) => void) => {
        // ... (Tu código actual de cleanDeletedFiles se mantiene intacto)
        if (Platform.OS !== 'android') return;

        try {
            onProgress?.('Verificando archivos existentes...');
            const tracksCollection = database.collections.get<Track>('tracks');
            const albumsCollection = database.collections.get<Album>('albums');
            const artistsCollection = database.collections.get<Artist>('artists');

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

            onProgress?.('Limpiando álbumes vacíos...');
            const allAlbums = await albumsCollection.query().fetch();
            const albumsToDelete: Album[] = [];
            for (const album of allAlbums) {
                const tracksCount = await tracksCollection.query(Q.where('album_id', album.id)).fetchCount();
                if (tracksCount === 0) albumsToDelete.push(album);
            }

            if (albumsToDelete.length > 0) {
                await database.write(async () => {
                    const batchOps = albumsToDelete.map(a => a.prepareDestroyPermanently());
                    await database.batch(batchOps);
                });
            }

            onProgress?.('Limpiando artistas vacíos...');
            const allArtists = await artistsCollection.query().fetch();
            const artistsToDelete: Artist[] = [];
            for (const artist of allArtists) {
                const tracksCount = await tracksCollection.query(Q.where('artist_id', artist.id)).fetchCount();
                if (tracksCount === 0) artistsToDelete.push(artist);
            }

            if (artistsToDelete.length > 0) {
                await database.write(async () => {
                    const batchOps = artistsToDelete.map(a => a.prepareDestroyPermanently());
                    await database.batch(batchOps);
                });
            }

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
            const BATCH_SIZE = 500; // Constante para el chunking

            for (let i = 0; i < audioFiles.length; i++) {
                const file = audioFiles[i];

                if (i % 100 === 0) onProgress?.(i, audioFiles.length, 'Añadiendo a tu biblioteca...');

                const title = file.title?.trim() || file.filename.replace(/\.[^/.]+$/, '');
                const artistString = file.artist?.trim() || 'Artista Desconocido';
                const albumTitle = file.album?.trim() || 'Álbum Desconocido';
                const albumId = file.albumId || albumTitle;
                const coverUrl = file.coverUrl || null;
                const durationInSeconds = file.duration || 0;

                if (existingLinks.has(file.uri)) {
                    skipped++;
                    continue;
                }

                const artistNames = artistString.split('~').map(s => s.trim()).filter(s => s.length > 0);
                if (artistNames.length === 0) artistNames.push('Artista Desconocido');

                const trackArtists: Artist[] = [];
                for (const name of artistNames) {
                    let artist = artistCache.get(name);
                    if (!artist) {
                        const sanitized = sanitizeArtistName(name);
                        const baseDir = FileSystem.documentDirectory;
                        let imageUrl = null;

                        if (baseDir) {
                            const fileName = `artist_${sanitized}.jpg`;
                            const imgPath = baseDir.endsWith('/') ? `${baseDir}${fileName}` : `${baseDir}/${fileName}`;
                            try {
                                const check = await FileSystem.getInfoAsync(imgPath);
                                if (check.exists) {
                                    imageUrl = imgPath;
                                }
                            } catch (e) { }
                        }

                        artist = artistsCollection.prepareCreate(a => {
                            a.name = name;
                            (a as any).imageUrl = imageUrl;
                        });
                        batchOps.push(artist);
                        artistCache.set(name, artist);
                    }
                    trackArtists.push(artist);
                }

                const primaryArtist = trackArtists[0];

                const albumKey = albumId;
                let album = albumCache.get(albumKey);

                if (!album) {
                    album = albumsCollection.prepareCreate(a => {
                        a.title = albumTitle;
                        a.artist.set(primaryArtist);
                        a.coverUrl = coverUrl;
                    });
                    batchOps.push(album);
                    albumCache.set(albumKey, album);
                    albumCache.set(albumTitle, album);
                }

                const track = tracksCollection.prepareCreate(t => {
                    t.title = title;
                    t.fileUrl = file.uri;
                    t.duration = durationInSeconds;
                    t.isFavorite = false;
                    t.trackNumber = file.trackNumber || 0;
                    t.discNumber = file.discNumber || 1;
                    t.album.set(album as Album);
                    t.artist.set(primaryArtist);
                });
                batchOps.push(track);

                for (const artist of trackArtists) {
                    const collaborator = database.collections.get('track_collaborators').prepareCreate((tc: any) => {
                        tc.track.set(track);
                        tc.artist.set(artist);
                    });
                    batchOps.push(collaborator);
                }
                added++;

                // === NUEVO: Ejecutar batch cuando alcancemos el límite ===
                if (batchOps.length >= BATCH_SIZE) {
                    await database.batch(batchOps);
                    batchOps = []; // Vaciamos el array para liberar memoria
                }
            }

            // === NUEVO: Ejecutar cualquier operación sobrante ===
            if (batchOps.length > 0) {
                await database.batch(batchOps);
            }
        });

        onProgress?.(audioFiles.length, audioFiles.length, '¡Librería actualizada!');
        return { total: audioFiles.length, added, skipped };
    }
};