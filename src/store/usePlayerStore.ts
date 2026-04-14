import TrackPlayer, { Track as TPTrack } from 'react-native-track-player';
import { create } from 'zustand';
import { database } from '../database';
import Track from '../database/models/Track';
import Artist from '../database/models/Artist';

async function mapToTPTrack(track: Track): Promise<TPTrack> {
    const album = await track.album.fetch();
    const artists = (await track.queryCollaborators.fetch()) as Artist[];
    const artistNames = artists.length > 0 ? artists.map(a => a.name).join(', ') : 'Artista desconocido';

    return {
        id: track.id,
        url: track.fileUrl,
        title: track.title,
        artist: artistNames,
        album: album?.title || 'Álbum desconocido',
        artwork: album?.coverUrl || undefined,
        duration: track.duration,
    };
}

interface PlayerState {
    activeTrack: Track | null;
    playbackContext: string | null;
    isPlaying: boolean;
    hasNext: boolean;
    hasPrevious: boolean;
    loadQueue: (tracks: Track[], index: number, context?: string) => Promise<void>;
    playSingleTrack: (track: Track, context?: string) => Promise<void>;
    setActiveTrackById: (trackId: string) => Promise<void>;
    setIsPlaying: (playing: boolean) => void;
    addToQueueNext: (track: Track) => Promise<void>;
    addToQueueEnd: (track: Track) => Promise<void>;
    updateQueueStatus: (currentIndex?: number) => Promise<void>;
    clearPlayer: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
    activeTrack: null,
    playbackContext: null,
    isPlaying: false,
    hasNext: false,
    hasPrevious: false,

    loadQueue: async (tracks, index, context = 'unknown') => {
        try {
            const tpTracks = await Promise.all(tracks.map(mapToTPTrack));

            await TrackPlayer.reset();
            await TrackPlayer.add(tpTracks);
            await TrackPlayer.skip(index);
            await TrackPlayer.play();
            set({ activeTrack: tracks[index], playbackContext: context });

        } catch (error) {
            console.error('Error loading queue:', error);
        }
    },

    playSingleTrack: async (track, context = 'unknown') => {
        try {
            const tpTrack = await mapToTPTrack(track);
            await TrackPlayer.reset();
            await TrackPlayer.add([tpTrack]);
            await TrackPlayer.play();
            set({ activeTrack: track, playbackContext: context });

        } catch (error) {
            console.error('Error playing single track:', error);
        }
    },

    setActiveTrackById: async (trackId) => {

        try {
            const track = await database.get<Track>('tracks').find(trackId);
            set({ activeTrack: track });

        } catch (error) {
            console.error('Error setting active track by ID:', error);

        }
    },

    setIsPlaying: (playing) => {

        set({ isPlaying: playing });
    },

    addToQueueNext: async (track) => {
        try {
            const tpTrack = await mapToTPTrack(track);
            const currentIndex = await TrackPlayer.getActiveTrackIndex();

            if (currentIndex !== undefined && currentIndex !== null) {
                await TrackPlayer.add([tpTrack], currentIndex + 1);
            } else {
                await TrackPlayer.add([tpTrack]);
            }
            console.log(`🎵 Añadido a continuación: ${track.title}`);
        } catch (error) {
            console.error('Error adding to queue next:', error);
        }
    },

    addToQueueEnd: async (track) => {
        try {
            const tpTrack = await mapToTPTrack(track);
            await TrackPlayer.add([tpTrack]);
            console.log(`🎵 Añadido al final de la cola: ${track.title}`);
        } catch (error) {
            console.error('Error adding to queue end:', error);
        }
    },

    clearPlayer: async () => {

        try {
            await TrackPlayer.reset();
            set({ activeTrack: null, playbackContext: null, isPlaying: false, hasNext: false, hasPrevious: false });

        } catch (error) {
            console.error('Error in clearPlayer:', error);
        }
    },

    updateQueueStatus: async (currentIndex?: number) => {
        try {
            console.log("📊 [Store] Evaluando estado de la cola...");
            const queue = await TrackPlayer.getQueue();
            const index = currentIndex !== undefined ? currentIndex : await TrackPlayer.getActiveTrackIndex();

            console.log(`📊 [Store] Datos de Cola -> Longitud: ${queue.length}, Index Activo: ${index}`);

            if (index !== undefined && index !== null) {
                set({
                    hasPrevious: index > 0,
                    hasNext: index < queue.length - 1
                });
                console.log(`📊 [Store] Resultado Cola -> hasPrevious: ${index > 0}, hasNext: ${index < queue.length - 1}`);
            } else {
                set({ hasPrevious: false, hasNext: false });
                console.log(`📊 [Store] Resultado Cola -> Nada reproduciéndose (index missing)`);
            }
        } catch (error) {
            console.error('❌ [Store] Error actualizando status de la cola:', error);
        }
    },
}));
