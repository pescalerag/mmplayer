import { CastReport, LocalCastSession } from '../utils/localCastSession';

describe('LocalCast session ownership and handoff', () => {
  const report = (session: LocalCastSession, overrides: Partial<CastReport> = {}): CastReport => ({ sessionId: session.id, token: session.token, position: 87, duration: 180, listened: 20, playing: true, sequence: 1, ...overrides });
  afterEach(() => jest.useRealTimers());
  it('retains the initial position until the browser confirms it and resets only on track changes', () => {
    const session = new LocalCastSession('one', 'track', 34, true);
    expect(session.position(0)).toBe(34);
    session.select('track'); expect(session.token).toBe('one:0');
    expect(session.accept(report(session))).toBe(20);
    expect(session.position(87)).toBe(87);
    session.select('next');
    expect(session.position(0)).toBe(0);
    expect(session.state.position).toBe(0);
    expect(session.state.duration).toBe(0);
    expect(session.activeTrackId).toBe('next');
  });
  it('rejects old sessions, songs, reordered reports and invalid numbers without counting twice', () => {
    const session = new LocalCastSession('one', 'track', 34, false);
    expect(session.accept(report(session, { sessionId: 'old' }))).toBeNull();
    expect(session.accept(report(session, { token: 'old' }))).toBeNull();
    expect(session.accept(report(session, { position: NaN }))).toBeNull();
    expect(session.accept(report(session, { position: -1 }))).toBeNull();
    expect(session.accept(report(session, { duration: -1 }))).toBeNull();
    expect(session.accept(report(session, { listened: -1 }))).toBeNull();
    expect(session.accept(report(session))).toBe(20);
    expect(session.accept(report(session))).toBeNull();
    expect(session.accept(report(session, { sequence: 2, listened: 19 }))).toBeNull();
    expect(session.accept(report(session, { sequence: 3, listened: 25 }))).toBe(5);
  });
  it('accepts each finish once, rejects stale endings and blocks advancement during handoff', () => {
    const session = new LocalCastSession('one', 'track', 0, true);
    expect(session.finish('old')).toBe(false);
    expect(session.finish(session.token)).toBe(true);
    expect(session.finish(session.token)).toBe(false);
    session.select('next'); expect(session.finish(session.token)).toBe(true);
    session.completeStop(null);
    session.requestStop(); expect(session.stopping).toBe(true);
    expect(session.finish(session.token)).toBe(false);
    session.completeStop(null);
  });
  it('returns the browser final position when acknowledged and otherwise times out at two seconds', async () => {
    jest.useFakeTimers();
    const session = new LocalCastSession('one', 'track', 34, true);
    const promise = session.requestStop(); expect(session.requestStop()).toBe(promise);
    const final = report(session); session.completeStop(final);
    await expect(promise).resolves.toBe(final);
    expect(session.accept(report(session, { sequence: 2 }))).toBeNull();
    const disconnected = new LocalCastSession('two', 'track', 34, true);
    const fallback = disconnected.requestStop();
    await jest.advanceTimersByTimeAsync(2000);
    await expect(fallback).resolves.toBeNull();
  });
});
