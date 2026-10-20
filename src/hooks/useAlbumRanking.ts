import Album from '../database/models/Album';
import { AlbumRankingService } from '../services/AlbumRankingService';
import { RankedAlbum } from '../utils/albumRanking';
import { useRetainedRanking } from './useRetainedRanking';

export function useAlbumRanking(enabled = true) {
  return useRetainedRanking(AlbumRankingService.observe, ['tracks', 'albums'], () => [] as RankedAlbum<Album>[], enabled);
}
