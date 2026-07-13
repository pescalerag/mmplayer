import { create } from 'zustand';
import { HistoryService } from '../services/HistoryService';

interface StatsState {
    totalHours: number;
    topArtist: string;
    topArtistId: string;
    topArtistImg: string | null;
    topArtistDuration: number;
    topAlbum: string;
    topAlbumId: string;
    topAlbumImg: string | null;
    topAlbumDuration: number;
    topSong: string;
    topSongId: string;
    topSongImg: string | null;
    topSongArtist: string;
    topSongDuration: number;
    isLoading: boolean;
    fetchStats: () => Promise<void>;
}

export const useStatsStore = create<StatsState>((set) => ({
    totalHours: 0,
    topArtist: '',
    topArtistId: '',
    topArtistImg: null,
    topArtistDuration: 0,
    topAlbum: '',
    topAlbumId: '',
    topAlbumImg: null,
    topAlbumDuration: 0,
    topSong: '',
    topSongId: '',
    topSongImg: null,
    topSongArtist: '',
    topSongDuration: 0,
    isLoading: false,
    fetchStats: async () => {
        set({ isLoading: true });
        try {
            const stats = await HistoryService.getWeeklyStats();
            set({
                totalHours: stats.totalHours,
                topArtist: stats.topArtist,
                topArtistId: stats.topArtistId,
                topArtistImg: stats.topArtistImg,
                topArtistDuration: stats.topArtistDuration,
                topAlbum: stats.topAlbum,
                topAlbumId: stats.topAlbumId,
                topAlbumImg: stats.topAlbumImg,
                topAlbumDuration: stats.topAlbumDuration,
                topSong: stats.topSong,
                topSongId: stats.topSongId,
                topSongImg: stats.topSongImg,
                topSongArtist: stats.topSongArtist,
                topSongDuration: stats.topSongDuration
            });
        } catch (err) {
            console.error("[useStatsStore] Failed to fetch weekly stats:", err);
        } finally {
            set({ isLoading: false });
        }
    }
}));
