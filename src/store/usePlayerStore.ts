import TrackPlayer, { Track as TPTrack } from 'react-native-track-player';
import { create } from 'zustand';
import { database } from '../database';
import Track from '../database/models/Track';

async function mapToTPTrack(track: Track): Promise<TPTrack> {
    const album = await track.album.fetch();
    const artist = await track.artist.fetch();

    return {
        id: track.id,
        url: track.fileUrl,
        title: track.title,
        artist: artist?.name || 'Artista desconocido',
        album: album?.title || 'Álbum desconocido',
        artwork: album?.coverUrl || undefined,
        duration: track.duration,
    };
}

interface PlayerState {
    activeTrack: Track | null;
    isPlaying: boolean;
    loadQueue: (tracks: Track[], index: number) => Promise<void>;
    playSingleTrack: (track: Track) => Promise<void>;
    setActiveTrackById: (trackId: string) => Promise<void>;
    setIsPlaying: (playing: boolean) => void;
    addToQueue: (track: Track) => Promise<void>;
    clearPlayer: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set) => ({
    activeTrack: null,
    isPlaying: false,

    loadQueue: async (tracks, index) => {

        try {
            const tpTracks = await Promise.all(tracks.map(mapToTPTrack));

            await TrackPlayer.reset();
            await TrackPlayer.add(tpTracks);
            await TrackPlayer.skip(index);
            await TrackPlayer.play();
            set({ activeTrack: tracks[index] });

        } catch (error) {
            console.error('Error loading queue:', error);
        }
    },

    playSingleTrack: async (track) => {

        try {
            const tpTrack = await mapToTPTrack(track);
            await TrackPlayer.reset();
            await TrackPlayer.add([tpTrack]);
            await TrackPlayer.play();
            set({ activeTrack: track });

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

    addToQueue: async (track) => {
        try {
            const tpTrack = await mapToTPTrack(track);
            await TrackPlayer.add([tpTrack]);
            console.log(`🎵 Añadido a la cola: ${track.title}`);
        } catch (error) {
            console.error('Error adding to queue:', error);
        }
    },

    clearPlayer: async () => {

        try {
            await TrackPlayer.reset();
            set({ activeTrack: null, isPlaying: false });

        } catch (error) {
            console.error('Error in clearPlayer:', error);
        }
    },
}));
