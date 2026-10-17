import { runInNewContext } from 'node:vm';
import { timestampReceiverSource } from '../services/TimestampReceiver';

let position: number;
let playing: boolean;
let duration: number;
let seek: jest.Mock;
let engine: any;
const config = { enabled: true, segments: [{ id: 'intro', startMs: 0, endMs: 10000 }, { id: 'middle', startMs: 20000, endMs: 40000 }, { id: 'tail', startMs: 90000, endMs: 100000 }] };
beforeEach(() => {
    jest.useFakeTimers(); position = 0; playing = true; duration = 100;
    seek = jest.fn((value: number) => { position = value; });
    const factory = runInNewContext(`(${timestampReceiverSource})`, { setInterval, clearInterval, Date });
    engine = factory({ position: () => position, playing: () => playing, duration: () => duration, seek });
});
afterEach(() => { engine.stop(); jest.useRealTimers(); });

it('skips intro, middle and tail locally without adding a request to the phone', () => {
    engine.update(config, 'one'); jest.advanceTimersByTime(50); expect(position).toBe(10);
    position = 22; jest.advanceTimersByTime(550); expect(position).toBe(40);
    position = 91; jest.advanceTimersByTime(550); expect(position).toBe(100);
});

it('lets a manual seek play an omitted section, retains it across polls and rearms on the next visit', () => {
    engine.update(config, 'one'); position = 25; engine.manualSeek(position);
    engine.update(JSON.parse(JSON.stringify(config)), 'one'); jest.advanceTimersByTime(1000);
    expect(seek).not.toHaveBeenCalled();
    position = 45; engine.tick(); position = 25; engine.tick(); expect(position).toBe(40);
});

it('clears manual overrides on a new queue occurrence or an automatic A–B seek', () => {
    engine.update(config, 'one'); position = 25; engine.manualSeek(position);
    engine.update(config, 'two'); engine.tick(); expect(position).toBe(40);
    position = 25; engine.manualSeek(position); engine.automaticSeek(); jest.advanceTimersByTime(550);
    expect(position).toBe(40);
});

it('does no background work for ordinary songs and never jumps while paused or disabled', () => {
    engine.update({ enabled: true, segments: [] }, 'one'); expect(jest.getTimerCount()).toBe(0);
    engine.update(config, 'one'); playing = false; jest.advanceTimersByTime(2000); expect(seek).not.toHaveBeenCalled();
    engine.update({ ...config, enabled: false }, 'one'); expect(jest.getTimerCount()).toBe(0);
    playing = true; engine.tick(); expect(seek).not.toHaveBeenCalled();
});

it('ignores boundaries outside the receiving file duration and stops its timer on handoff', () => {
    engine.update(config, 'one'); position = 25; duration = 30;
    jest.advanceTimersByTime(1000); expect(seek).not.toHaveBeenCalled();
    engine.stop(); expect(jest.getTimerCount()).toBe(0);
});
