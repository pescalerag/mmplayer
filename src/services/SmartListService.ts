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
  placeholderIcon: 'star-half-outline' | 'star' | 'star-outline' | 'time-outline' | 'calendar-outline' | 'stats-chart-outline';
  group?: 'listening' | 'rating';
  getTracks: () => Promise<Track[]>;
}

export const SmartListService = {
  getSmartLists(): SmartList[] {
    const now = new Date();
    const lang = i18n.language || 'es';
    const isEs = lang.startsWith('es');

    const monthName = now.toLocaleDateString(lang, { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return [
      // ─── LISTAS SEGÚN TUS ESCUCHAS ───
      {
        id: 'top_50_week',
        name: isEs ? 'Tu Semana' : 'Your Week',
        description: isEs ? 'Tus 50 canciones más escuchadas de esta semana' : 'Your 50 most played tracks this week',
        placeholderIcon: 'time-outline',
        group: 'listening',
        getTracks: async () => {
          const fromDate = HistoryService.getPeriodRange('week').from;
          return SmartListService.getTopTracksByDuration(50, fromDate || undefined);
        }
      },
      {
        id: 'top_50_month',
        name: isEs ? `Mes de ${capitalizedMonth}` : `${capitalizedMonth} Month`,
        description: isEs ? `Tus 50 canciones más escuchadas en ${monthName}` : `Your 50 most played tracks in ${monthName}`,
        placeholderIcon: 'calendar-outline',
        group: 'listening',
        getTracks: async () => {
          const fromDate = HistoryService.getPeriodRange('month').from;
          return SmartListService.getTopTracksByDuration(50, fromDate || undefined);
        }
      },
      {
        id: 'top_50',
        name: isEs ? 'Tus más escuchadas' : 'Your Most Listened',
        description: isEs ? 'Tus 50 canciones más escuchadas en MMPlayer' : 'Your 50 most listened tracks in MMPlayer',
        placeholderIcon: 'stats-chart-outline',
        group: 'listening',
        getTracks: async () => {
          return SmartListService.getTopTracksByDuration(50);
        }
      },

      // ─── LISTAS SEGÚN PUNTUACIÓN ───
      {
        id: 'rating_unrated',
        name: isEs ? 'Sin puntuar' : 'Unrated',
        description: isEs ? 'Canciones que aún no han sido valoradas' : 'Songs without a rating',
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
        name: isEs ? '1-2 estrellas' : '1-2 Stars',
        description: isEs ? 'Canciones valoradas entre 1 y 2 estrellas' : 'Songs rated 1 to 2 stars',
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
        name: isEs ? '2-3 estrellas' : '2-3 Stars',
        description: isEs ? 'Canciones valoradas entre 2 y 3 estrellas' : 'Songs rated 2 to 3 stars',
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
        name: isEs ? '3-4 estrellas' : '3-4 Stars',
        description: isEs ? 'Canciones valoradas entre 3 y 4 estrellas' : 'Songs rated 3 to 4 stars',
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
        name: isEs ? '4-5 estrellas' : '4-5 Stars',
        description: isEs ? 'Canciones con valoración de 4 a 5 estrellas' : 'Songs rated between 4 and 5 stars',
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
        name: isEs ? '5 estrellas' : '5 Stars',
        description: isEs ? 'Canciones con valoración perfecta de 5 estrellas' : 'Songs with perfect 5-star rating',
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
  }
};
