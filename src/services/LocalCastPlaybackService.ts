import { CastReport, LocalCastSession } from '../utils/localCastSession';
import { useCastStore } from '../store/useCastStore';
import TrackPlayer from 'react-native-track-player';
import { LocalCastQueueService } from './LocalCastQueueService';

let session: LocalCastSession | null = null;

export const LocalCastPlaybackService = {
  begin(id: string, trackId: string, position: number, playing: boolean) {
    session?.completeStop(null);
    session = new LocalCastSession(id, trackId, position, playing);
  },
  selectTrack(trackId: string) { session?.select(trackId); },
  getState() { return session; },
  receive(params: URLSearchParams): boolean {
    const raw = params.get('report');
    if (!session || !raw) return false;
    try {
      const report: CastReport = JSON.parse(raw);
      const delta = session.accept(report);
      if (delta === null) return false;
      useCastStore.getState().setCastPlayback(report.position, undefined, report.duration);
      const { PlaybackTimeTracker } = require('./PlaybackService');
      PlaybackTimeTracker.addReportedSeconds(session.activeTrackId, delta);
      if (params.get('stopped') === 'true' && session.stopping) session.completeStop(report);
      return true;
    } catch { return false; }
  },
  async requestStop() { return session?.requestStop() ?? null; },
  async saveListen(complete = false) {
    const trackId = session?.activeTrackId;
    if (!trackId) return;
    const { PlaybackTimeTracker } = require('./PlaybackService');
    const { PlaybackListenService } = require('./PlaybackListenService');
    PlaybackTimeTracker.onStateNotPlaying();
    await PlaybackListenService.save(trackId, PlaybackTimeTracker.getAccumulatedSeconds(trackId), complete);
    if (complete) PlaybackTimeTracker.clearAccumulated(trackId);
  },
  finish(token: string) { return session?.finish(token) ?? false; },
  async advance(ended = false) {
    if (!session || session.stopping) return false;
    const token = session?.token;
    try {
      if (ended) await this.saveListen(true);
      const advanced = await LocalCastQueueService.advance(ended);
      if (!advanced) { useCastStore.getState().setCastPlaying(false); return false; }
      await this.syncTransition(token);
      await TrackPlayer.play();
      return true;
    } catch { useCastStore.getState().setCastPlaying(false); return false; }
  },
  async syncTransition(previousToken: string | undefined) {
    const index = await TrackPlayer.getActiveTrackIndex();
    const track = index == null ? null : await TrackPlayer.getTrack(index);
    if (track?.id && session && session.token === previousToken) {
      session.select(String(track.id), true);
      useCastStore.getState().setCastPlayback(0, undefined, 0);
    }
  },
  async selectQueueItem(params: URLSearchParams) {
    if (!session || session.stopping) return false;
    const index = Number(params.get('index') ?? 'NaN');
    if (!await LocalCastQueueService.validate(session.id, params.get('version') ?? '', index, params.get('id') ?? '')) return false;
    this.receive(params);
    await this.saveListen(true);
    const token = session.token;
    await TrackPlayer.skip(index);
    await this.syncTransition(token);
    await TrackPlayer.play();
    return true;
  },
  clear() { session?.completeStop(null); session = null; },
};

export async function handleCastReportRoute(method: string, pathname: string, params: URLSearchParams, respond: (body: object) => void): Promise<boolean> {
  if (method !== 'POST') return false;
  if (pathname !== '/api/report' && pathname !== '/api/ended') return false;
  const accepted = LocalCastPlaybackService.receive(params);
  if (pathname === '/api/ended' && accepted && LocalCastPlaybackService.finish(params.get('token') || '')) {
    await LocalCastPlaybackService.advance(true);
  }
  respond({ accepted });
  return true;
}
