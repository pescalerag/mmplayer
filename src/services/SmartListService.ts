import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Track from '../database/models/Track';
import PlaybackHistory from '../database/models/PlaybackHistory';
import { HistoryService } from './HistoryService';
import i18n from '../constants/i18n';

export interface SmartList {
  id: string;
  name: string;
  description: string;
  placeholderIcon: string;
  group?: 'listening' | 'rating' | 'genre';
  genre?: string;
  getTracks: () => Promise<Track[]>;
}

export const SmartListService = {
  getSmartLists(language = i18n.language): SmartList[] {
    const now = new Date();
    const lang = language || 'es';
    const translate = i18n.getFixedT(lang);

    const monthName = now.toLocaleDateString(lang, { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return [
      // ─── LISTAS SEGÚN TUS ESCUCHAS ───
      {
        id: 'top_50_week',
        name: translate('smart_playlists.week_title'),
        description: translate('smart_playlists.week_desc'),
        placeholderIcon: 'time-outline',
        group: 'listening',
        getTracks: async () => {
          const fromDate = HistoryService.getPeriodRange('week').from;
          return SmartListService.getTopTracksByDuration(50, fromDate || undefined);
        }
      },
      {
        id: 'top_50_month',
        name: translate('smart_playlists.month_title', { month: capitalizedMonth }),
        description: translate('smart_playlists.month_desc', { month: monthName }),
        placeholderIcon: 'calendar-outline',
        group: 'listening',
        getTracks: async () => {
          const fromDate = HistoryService.getPeriodRange('month').from;
          return SmartListService.getTopTracksByDuration(50, fromDate || undefined);
        }
      },
      {
        id: 'top_50',
        name: translate('smart_playlists.all_title'),
        description: translate('smart_playlists.all_desc'),
        placeholderIcon: 'stats-chart-outline',
        group: 'listening',
        getTracks: async () => {
          return SmartListService.getTopTracksByDuration(50);
        }
      },

      // ─── LISTAS SEGÚN PUNTUACIÓN ───
      {
        id: 'rating_unrated',
        name: translate('smart_playlists.unrated_title'),
        description: translate('smart_playlists.unrated_desc'),
        placeholderIcon: 'star-outline',
        group: 'rating',
        getTracks: async () => {
          return database.collections.get<Track>('tracks').query(
            Q.or(
              Q.where('rating', Q.eq(null as any)),
              Q.where('rating', 0)
            )
          ).fetch();
        }
      },
      {
        id: 'rating_1_2',
        name: translate('smart_playlists.rating_title', { range: '1-2' }),
        description: translate('smart_playlists.rating_desc', { min: 1, max: 2 }),
        placeholderIcon: 'star-outline',
        group: 'rating',
        getTracks: async () => {
          return database.collections.get<Track>('tracks').query(
            Q.where('rating', Q.oneOf([1.0, 1.5, 2.0]))
          ).fetch();
        }
      },
      {
        id: 'rating_2_3',
        name: translate('smart_playlists.rating_title', { range: '2-3' }),
        description: translate('smart_playlists.rating_desc', { min: 2, max: 3 }),
        placeholderIcon: 'star-half-outline',
        group: 'rating',
        getTracks: async () => {
          return database.collections.get<Track>('tracks').query(
            Q.where('rating', Q.oneOf([2.0, 2.5, 3.0]))
          ).fetch();
        }
      },
      {
        id: 'rating_3_4',
        name: translate('smart_playlists.rating_title', { range: '3-4' }),
        description: translate('smart_playlists.rating_desc', { min: 3, max: 4 }),
        placeholderIcon: 'star-half-outline',
        group: 'rating',
        getTracks: async () => {
          return database.collections.get<Track>('tracks').query(
            Q.where('rating', Q.oneOf([3.0, 3.5, 4.0]))
          ).fetch();
        }
      },
      {
        id: 'rating_4_5',
        name: translate('smart_playlists.rating_title', { range: '4-5' }),
        description: translate('smart_playlists.rating_top_desc'),
        placeholderIcon: 'star',
        group: 'rating',
        getTracks: async () => {
          return database.collections.get<Track>('tracks').query(
            Q.where('rating', Q.oneOf([4.0, 4.5, 5.0]))
          ).fetch();
        }
      },
      {
        id: 'rating_5',
        name: translate('smart_playlists.perfect_title'),
        description: translate('smart_playlists.perfect_desc'),
        placeholderIcon: 'star',
        group: 'rating',
        getTracks: async () => {
          return database.collections.get<Track>('tracks').query(
            Q.where('rating', 5.0)
          ).fetch();
        }
      }
    ];
  },

  async getTopTracksByDuration(limit = 50, fromDate?: Date): Promise<Track[]> {
    try {
      const query = fromDate
        ? database.collections.get<PlaybackHistory>('playback_history')
            .query(Q.where('played_at', Q.gte(fromDate.getTime())))
        : database.collections.get<PlaybackHistory>('playback_history')
            .query();

      const historyRecords = await query.fetch();

      const trackDurations: Record<string, number> = {};
      for (const record of historyRecords) {
        const seconds = record.durationPlayed || 0;
        trackDurations[record.itemId] = (trackDurations[record.itemId] || 0) + seconds;
      }

      const sortedTrackIds = Object.entries(trackDurations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(entry => entry[0]);

      if (sortedTrackIds.length === 0) return [];

      const tracks = await database.collections.get<Track>('tracks')
        .query(Q.where('id', Q.oneOf(sortedTrackIds)))
        .fetch();

      // Return ordered by duration
      return sortedTrackIds
        .map(id => tracks.find(t => t.id === id))
        .filter((t): t is Track => !!t);
    } catch (e) {
      console.error('[SmartListService] Error getting top tracks by duration:', e);
      return [];
    }
  },

  async getGenreSmartLists(): Promise<SmartList[]> {
    try {
      const tracks = await database.collections.get<Track>('tracks')
        .query(
          Q.where('genre', Q.notEq(null)),
          Q.where('genre', Q.notEq(''))
        )
        .fetch();
      const genreSet = new Set<string>();
      for (const t of tracks) {
        const g = t.genre?.trim();
        if (g) {
          genreSet.add(g);
        }
      }

      const sortedGenres = Array.from(genreSet).sort((a, b) => a.localeCompare(b));

      return sortedGenres.map(genre => ({
        id: `genre_${encodeURIComponent(genre)}`,
        name: genre,
        description: i18n.t('library.smart_genre_desc', { genre }),
        placeholderIcon: 'disc-outline',
        group: 'genre' as const,
        genre,
        getTracks: async () => {
          return database.collections.get<Track>('tracks').query(
            Q.where('genre', genre),
            Q.sortBy('title', Q.asc)
          ).fetch();
        }
      }));
    } catch (e) {
      console.error('[SmartListService] Error getting genre smart lists:', e);
      return [];
    }
  }
};
