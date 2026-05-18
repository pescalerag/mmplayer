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
    isShuffleEnabled: boolean;
    shuffleOriginalQueue: TPTrack[];
    // Número de tracks que el usuario ha añadido manualmente a la cola
    // (se sitúan después de la canción actual pero antes del contexto del álbum)
    userQueueSize: number;
    loadQueue: (tracks: Track[], index: number, context?: string) => Promise<void>;
    startShuffled: (tracks: Track[], context?: string) => Promise<void>;
    playSingleTrack: (track: Track, context?: string) => Promise<void>;
    setActiveTrackById: (trackId: string) => Promise<void>;
    setIsPlaying: (playing: boolean) => void;
    addToQueueNext: (track: Track) => Promise<void>;
    addToQueueEnd: (track: Track) => Promise<void>;
    updateQueueStatus: (currentIndex?: number) => Promise<void>;
    clearPlayer: () => Promise<void>;
    setShuffleState: (enabled: boolean, queue: TPTrack[]) => void;
    decrementUserQueue: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
    activeTrack: null,
    playbackContext: null,
    isPlaying: false,
    hasNext: false,
    hasPrevious: false,
    isShuffleEnabled: false,
    shuffleOriginalQueue: [],
    userQueueSize: 0,

    loadQueue: async (tracks, index, context = 'unknown') => {
        try {
            const tpTracks = await Promise.all(tracks.map(mapToTPTrack));

            await TrackPlayer.reset();
            await TrackPlayer.add(tpTracks);
            await TrackPlayer.skip(index);
            await TrackPlayer.play();
            // Al cargar una nueva cola se resetea el shuffle y la cola manual
            set({ activeTrack: tracks[index], playbackContext: context, isShuffleEnabled: false, shuffleOriginalQueue: [], userQueueSize: 0 });

        } catch (error) {
            console.error('Error loading queue:', error);
        }
    },

    startShuffled: async (tracks, context = 'unknown') => {
        try {
            const tpTracks = await Promise.all(tracks.map(mapToTPTrack));

            // 1. Elegir un track de inicio aleatorio
            const startIndex = Math.floor(Math.random() * tracks.length);

            // 2. Cargar la cola completa en orden original
            await TrackPlayer.reset();
            await TrackPlayer.add(tpTracks);
            await TrackPlayer.skip(startIndex);
            await TrackPlayer.play();

            // 3. Barajar los tracks que vienen después
            const upcoming = tpTracks.slice(startIndex + 1);
            const shuffled = [...upcoming].sort(() => Math.random() - 0.5);
            await TrackPlayer.removeUpcomingTracks();
            if (shuffled.length > 0) await TrackPlayer.add(shuffled);

            // 4. Guardar estado: shuffle activo, cola original guardada
            set({
                activeTrack: tracks[startIndex],
                playbackContext: context,
                isShuffleEnabled: true,
                shuffleOriginalQueue: tpTracks,
                userQueueSize: 0,
            });
        } catch (error) {
            console.error('Error starting shuffled queue:', error);
        }
    },

    playSingleTrack: async (track, context = 'unknown') => {
        try {
            const tpTrack = await mapToTPTrack(track);
            await TrackPlayer.reset();
            await TrackPlayer.add([tpTrack]);
            await TrackPlayer.play();
            set({ activeTrack: track, playbackContext: context, userQueueSize: 0 });

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
                // Insertar justo después de la canción actual (primer slot de la user queue)
                await TrackPlayer.add([tpTrack], currentIndex + 1);
            } else {
                await TrackPlayer.add([tpTrack]);
            }
            // Incrementar el tamaño de la cola manual
            set(state => ({ userQueueSize: state.userQueueSize + 1 }));
            console.log(`🎵 Añadido a continuación: ${track.title}`);
            await get().updateQueueStatus();
        } catch (error) {
            console.error('Error adding to queue next:', error);
        }
    },

    addToQueueEnd: async (track) => {
        try {
            const tpTrack = await mapToTPTrack(track);
            const currentIndex = await TrackPlayer.getActiveTrackIndex();
            const { userQueueSize } = get();

            if (currentIndex !== undefined && currentIndex !== null) {
                // Insertar después de todos los tracks de la user queue
                // pero antes de la cola de contexto (resto del álbum/artista)
                const insertAt = currentIndex + 1 + userQueueSize;
                await TrackPlayer.add([tpTrack], insertAt);
            } else {
                await TrackPlayer.add([tpTrack]);
            }
            // Incrementar el tamaño de la cola manual
            set(state => ({ userQueueSize: state.userQueueSize + 1 }));
            console.log(`🎵 Añadido al final de la cola manual: ${track.title}`);
            await get().updateQueueStatus();
        } catch (error) {
            console.error('Error adding to queue end:', error);
        }
    },

    clearPlayer: async () => {
        try {
            await TrackPlayer.reset();
            set({
                activeTrack: null,
                playbackContext: null,
                isPlaying: false,
                hasNext: false,
                hasPrevious: false,
                isShuffleEnabled: false,
                shuffleOriginalQueue: [],
                userQueueSize: 0,
            });
        } catch (error) {
            console.error('Error in clearPlayer:', error);
        }
    },

    setShuffleState: (enabled, queue) => set({
        isShuffleEnabled: enabled,
        shuffleOriginalQueue: queue,
    }),

    // Llamado por TrackPlayerSync cuando el track avanza hacia adelante
    // y hay tracks de la user queue pendientes
    decrementUserQueue: () => {
        set(state => ({ userQueueSize: Math.max(0, state.userQueueSize - 1) }));
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
