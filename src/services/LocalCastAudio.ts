export interface BrowserCastState {
  readonly sessionId: string;
  readonly playbackToken: string;
  readonly mediaFileName: string;
  readonly position: number;
  readonly isPlaying: boolean;
}

// Self-contained browser factory. Regenerate its portable source with npm run generate:localcast.
export function createLocalCastAudio(audio: HTMLAudioElement, onEnded: (report: Record<string, unknown>) => void, onError: (error: unknown) => void, now: () => number = Date.now,
  playAudio: (canPlay: () => boolean) => Promise<void> = () => audio.play()) {
  let state: BrowserCastState | null = null;
  let listened = 0;
  let sequence = 0;
  let mediaTime = 0;
  let clock = now();
  let endedToken: string | null = null;
  let episodeToken: string | null = null;
  let loading = false;
  let lastContact = now();
  let desiredPlaying = false;
  let playPending = false;

  function rebase() { mediaTime = audio.currentTime; clock = now(); }
  function sample() {
    const elapsed = Math.max(0, (now() - clock) / 1000);
    const movement = audio.currentTime - mediaTime;
    if (!loading && !audio.seeking && movement > 0 && movement <= elapsed * audio.playbackRate + 0.5) listened += Math.min(movement, elapsed);
    rebase();
  }
  function report() {
    sample();
    sequence++;
    return { sessionId: state?.sessionId, token: loading ? undefined : state?.playbackToken, position: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : 0, listened, playing: !audio.paused && !audio.ended, sequence };
  }
  function clear() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    loading = false;
    desiredPlaying = false;
    state = null;
  }
  function stop() { const final = report(); clear(); return final; }
  function play() {
    const token = state?.playbackToken;
    function canPlay() { return !loading && desiredPlaying && state?.playbackToken === token && endedToken !== token; }
    if (canPlay() && !playPending) {
      playPending = true;
      void playAudio(canPlay).catch(onError).finally(() => { playPending = false; });
    }
  }
  function loaded() {
    if (!state || !loading) return;
    audio.currentTime = state.position;
    rebase();
    loading = false;
    play();
  }
  function sync(next: BrowserCastState) {
    lastContact = now();
    desiredPlaying = next.isPlaying;
    if (state?.playbackToken !== next.playbackToken) {
      clear();
      state = Object.assign({}, next, { sessionId: String(next.sessionId) });
      desiredPlaying = next.isPlaying;
      if (episodeToken !== next.playbackToken) {
        listened = 0;
        sequence = 0;
        endedToken = null;
        episodeToken = next.playbackToken;
      }
      loading = true;
      audio.src = '/static/' + encodeURIComponent(next.mediaFileName);
      audio.load();
      return;
    }
    if (next.isPlaying) play();
    else { sample(); audio.pause(); }
  }
  function seek(position: number) {
    if (loading && state) { state = Object.assign({}, state, { position }); return; }
    sample(); audio.currentTime = position; rebase();
  }
  function retry() {
    if (!state) return;
    const next = Object.assign({}, state, { position: audio.currentTime, isPlaying: desiredPlaying });
    state = null;
    sync(next);
  }
  function ended() {
    if (!state || loading || endedToken === state.playbackToken || !audio.ended) return;
    endedToken = state.playbackToken;
    onEnded(report());
  }
  function checkConnection() { if (state && now() - lastContact >= 5000) clear(); }
  audio.addEventListener('loadedmetadata', loaded);
  audio.addEventListener('timeupdate', sample);
  audio.addEventListener('seeking', rebase);
  audio.addEventListener('seeked', rebase);
  audio.addEventListener('playing', rebase);
  audio.addEventListener('ended', ended);
  function isReady(token: string | null) { return !loading && !!state && state.playbackToken === token; }
  return { sync, seek, report, stop, retry, checkConnection, isReady };
}
