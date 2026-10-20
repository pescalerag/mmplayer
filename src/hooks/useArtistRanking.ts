import { ArtistRankingService } from '../services/ArtistRankingService';
import { RatingSummary } from '../utils/trackRatings';
import { useRetainedRanking } from './useRetainedRanking';

export function useArtistRanking(enabled = true) {
  return useRetainedRanking(ArtistRankingService.observe, ['tracks', 'track_collaborators'], () => new Map<string, RatingSummary>(), enabled);
}
