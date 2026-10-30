import { create } from 'zustand';
import { HistoryService } from '../services/HistoryService';
import { ObservedResource } from '../utils/observedResource';
import { observeTableChanges, STAT_TABLES } from '../services/ScreenDataChanges';

const weeklyStatsResource = new ObservedResource<Awaited<ReturnType<typeof HistoryService.getWeeklyStats>>>(() => observeTableChanges(STAT_TABLES), 1);

let latestStatsRequest = 0;

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
    isLoading: true,
    fetchStats: async () => {
        const request = ++latestStatsRequest;
        set({ isLoading: weeklyStatsResource.read(new Date().toDateString()) === undefined });
        try {
            const stats = await weeklyStatsResource.load(new Date().toDateString(), () => HistoryService.getWeeklyStats());
            if (request !== latestStatsRequest) return;
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
            if (request === latestStatsRequest) set({ isLoading: false });
        }
    }
}));
