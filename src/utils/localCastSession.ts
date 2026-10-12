export interface CastReport {
  readonly sessionId: string;
  readonly token: string;
  readonly position: number;
  readonly duration: number;
  readonly listened: number;
  readonly playing: boolean;
  readonly sequence: number;
}

export class LocalCastSession {
  private revision = 0;
  private trackId: string | null = null;
  private sequence = -1;
  private listened = 0;
  private ended = false;
  private initial = true;
  private stopRequested = false;
  private closed = false;
  private resolveStop?: (report: CastReport | null) => void;
  private stopPromise?: Promise<CastReport | null>;
  private timer?: ReturnType<typeof setTimeout>;
  private snapshot: CastReport;

  constructor(readonly id: string, trackId: string, position: number, playing: boolean) {
    this.trackId = trackId;
    this.snapshot = { sessionId: id, token: this.token, position, playing, duration: 0, listened: 0, sequence: -1 };
  }

  get token() { return `${this.id}:${this.revision}`; }
  get activeTrackId() { return this.trackId; }
  get stopping() { return this.stopRequested; }
  get state() { return this.snapshot; }

  select(trackId: string, restart = false) {
    if (trackId === this.trackId && !restart) return;
    this.trackId = trackId;
    this.revision++;
    this.sequence = -1;
    this.listened = 0;
    this.ended = false;
    this.initial = false;
    this.snapshot = { ...this.snapshot, token: this.token, position: 0, duration: 0, listened: 0, sequence: -1 };
  }

  accept(report: CastReport): number | null {
    if (this.closed || report.sessionId !== this.id || report.token !== this.token || report.sequence <= this.sequence) return null;
    if (![report.position, report.duration, report.listened, report.sequence].every(Number.isFinite)) return null;
    if (report.position < 0 || report.duration < 0 || report.listened < this.listened) return null;
    const delta = report.listened - this.listened;
    this.sequence = report.sequence;
    this.listened = report.listened;
    this.initial = false;
    this.snapshot = report;
    return delta;
  }

  position(fallback: number) { return this.initial ? this.snapshot.position : fallback; }

  finish(token: string): boolean {
    if (token !== this.token || this.ended || this.stopRequested) return false;
    this.ended = true;
    return true;
  }

  requestStop(): Promise<CastReport | null> {
    if (this.stopPromise) return this.stopPromise;
    this.stopRequested = true;
    this.stopPromise = new Promise(resolve => {
      this.resolveStop = resolve;
      this.timer = setTimeout(() => this.completeStop(null), 2000);
    });
    return this.stopPromise;
  }

  completeStop(report: CastReport | null) {
    this.closed = true;
    clearTimeout(this.timer);
    this.resolveStop?.(report);
    this.resolveStop = undefined;
  }
}
