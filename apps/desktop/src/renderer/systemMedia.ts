import type { PlayerView } from "./player";

/** Chromium publishes this session to Windows SMTC (and MPRIS on Linux). */
export class SystemMediaSession {
  private metadataKey = "";
  private positionKey = "";
  constructor(
    private session: MediaSession,
    actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>>,
  ) {
    for (const [action, callback] of Object.entries(actions)) {
      try {
        session.setActionHandler(action as MediaSessionAction, callback!);
      } catch {
        /* A platform can omit an optional action. */
      }
    }
  }
  update(view: PlayerView, rate: number) {
    const track = view.track;
    const metadataKey = JSON.stringify(
      track
        ? [track.id, track.title, track.artist, track.album, track.cover]
        : null,
    );
    if (metadataKey !== this.metadataKey) {
      this.metadataKey = metadataKey;
      this.session.metadata = track
        ? new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: track.cover ? [{ src: track.cover }] : [],
          })
        : null;
    }
    this.session.playbackState = track?.available
      ? view.playing
        ? "playing"
        : "paused"
      : "none";
    const duration = view.duration;
    const position = Math.max(0, Math.min(view.position, duration));
    const key = `${track?.id}/${Math.floor(position)}/${duration}/${rate}/${view.playing}`;
    if (key === this.positionKey) return;
    this.positionKey = key;
    if (!this.session.setPositionState) return;
    if (!track?.available || !Number.isFinite(duration) || duration <= 0)
      this.session.setPositionState();
    else
      this.session.setPositionState({ duration, position, playbackRate: rate });
  }
}
