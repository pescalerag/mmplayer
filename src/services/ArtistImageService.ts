import { Q } from '@nozbe/watermelondb';
import * as FileSystem from 'expo-file-system/legacy';
import { database } from '../database';
import Artist from '../database/models/Artist';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSyncStore } from '../store/useSyncStore';
import { MediaAssetService } from './MediaAssetService';

let isProcessing = false;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchArtistImageUrl = async (artistName: string): Promise<string | null> => {
    try {
        const response = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}`);
        const json = await response.json();

        if (json && json.data && json.data.length > 0) {
            return json.data[0].picture_xl || json.data[0].picture_medium || null;
        }
        return null;
    } catch (error) {
        console.error(`[ArtistImageService] Error consultando Deezer para ${artistName}:`, error);
        return null;
    }
};

const downloadImageToLocal = async (url: string, artistId: string): Promise<string | null> => {
    try {
        const tempPath = `${FileSystem.cacheDirectory}temp_artist_${artistId}_${Date.now()}.jpg`;
        const downloadResult = await FileSystem.downloadAsync(url, tempPath);

        if (downloadResult.status === 200) {
            const persistentUri = await MediaAssetService.saveArtistImage(artistId, downloadResult.uri);
            return persistentUri;
        } else {
            console.error(`[ArtistImageService] Error HTTP al descargar imagen de artista ${artistId}: ${downloadResult.status}`);
            return null;
        }
    } catch (error) {
        console.error(`[ArtistImageService] Error escribiendo imagen local para ${artistId}:`, error);
        return null;
    }
};

export const ArtistImageService = {
    processMissingArtistImages: async (options?: { forceMode?: 'main' | 'all'; isBackground?: boolean; forceRefresh?: boolean }) => {
        if (isProcessing) {
            console.log("[ArtistImageService] Ya hay un proceso en curso. Omitiendo esta llamada.");
            return;
        }

        const mode = options?.forceMode || useSettingsStore.getState().artistImageDownloadMode;
        if (mode === 'disabled') {
            console.log("[ArtistImageService] Descarga desactivada por configuración. Omitiendo.");
            return;
        }

        const isBackground = options?.isBackground ?? false;
        const allowBackground = useSettingsStore.getState().artistImageBackgroundDownload;
        if (isBackground && !allowBackground) {
            console.log("[ArtistImageService] Descarga en segundo plano desactivada. Omitiendo.");
            return;
        }

        isProcessing = true;
        useSyncStore.getState().setIsDownloadingArtistImages(true);

        try {
            console.log(`[ArtistImageService] Iniciando búsqueda de imágenes en segundo plano (modo: ${mode})...`);
            const artistsCollection = database.collections.get<Artist>('artists');

            let missingImageArtists: Artist[] = [];

            if (mode === 'main') {
                if (options?.forceRefresh) {
                    missingImageArtists = await artistsCollection.query(
                        Q.experimentalJoinTables(['albums']),
                        Q.on('albums', 'id', Q.notEq(null as any))
                    ).fetch();
                } else {
                    missingImageArtists = await artistsCollection.query(
                        Q.experimentalJoinTables(['albums']),
                        Q.on('albums', 'id', Q.notEq(null as any)),
                        Q.or(
                            Q.where('image_url', Q.eq(null as any)),
                            Q.where('image_url', Q.eq(''))
                        )
                    ).fetch();
                }
            } else {
                if (options?.forceRefresh) {
                    missingImageArtists = await artistsCollection.query().fetch();
                } else {
                    missingImageArtists = await artistsCollection.query(
                        Q.or(
                            Q.where('image_url', Q.eq(null as any)),
                            Q.where('image_url', Q.eq(''))
                        )
                    ).fetch();
                }
            }

            if (missingImageArtists.length === 0) {
                console.log("[ArtistImageService] Todos los artistas del modo seleccionado tienen imagen. Fin del proceso.");
                return;
            }

            console.log(`[ArtistImageService] Procesando ${missingImageArtists.length} artistas...`);

            for (const artist of missingImageArtists) {
                if (artist.name === 'Artista Desconocido' || artist.name === 'Varios Artistas') {
                    continue;
                }

                try {
                    const imageUrl = await fetchArtistImageUrl(artist.name);

                    if (imageUrl) {
                        const localUri = await downloadImageToLocal(imageUrl, artist.id);

                        if (localUri) {
                            await database.write(async () => {
                                await artist.update((a) => {
                                    a.imageUrl = localUri;
                                });
                            });
                            console.log(`[ArtistImageService] Imagen guardada con éxito para: ${artist.name}`);
                        }
                    } else {
                        console.log(`[ArtistImageService] Deezer no devolvió resultados para: ${artist.name}`);
                    }
                } catch (artistError) {
                    console.error(`[ArtistImageService] Error aisaldo procesando a ${artist.name}:`, artistError);
                }

                await delay(1500);
            }

            console.log("[ArtistImageService] Proceso completado correctamente.");
        } catch (error) {
            console.error("[ArtistImageService] Error fatal en la ejecución principal:", error);
        } finally {
            isProcessing = false;
            useSyncStore.getState().setIsDownloadingArtistImages(false);
        }
    }
};