import { combineLatest, Observable, Subject } from 'rxjs';
import { observeScreenData } from '../utils/observeScreenData';
import { scheduleScreenRefresh } from '../utils/scheduleScreenRefresh';

jest.mock('../utils/scheduleScreenRefresh', () => ({ scheduleScreenRefresh: jest.fn() }));

let start: () => void;
const cancel = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (scheduleScreenRefresh as jest.Mock).mockImplementation(callback => { start = callback; return cancel; });
});

it('provides a synchronous pending value so the screen can mount before creating its database query', () => {
    const source = new Subject<string[]>();
    const createQuery = jest.fn(() => source);
    const values: unknown[] = [];
    const subscription = observeScreenData(createQuery).subscribe(value => values.push(value));
    expect(values).toEqual([undefined]);
    expect(createQuery).not.toHaveBeenCalled();
    start();
    expect(createQuery).toHaveBeenCalledTimes(1);
    source.next(['first']); source.next(['second']);
    expect(values).toEqual([undefined, ['first'], ['second']]);
    subscription.unsubscribe();
});

it('keeps a pending count distinct from a real empty library', () => {
    const rows = new Subject<number>();
    const values: unknown[] = [];
    const subscription = observeScreenData(() => rows, null).subscribe(value => values.push(value));
    expect(values).toEqual([null]);
    start(); rows.next(0);
    expect(values).toEqual([null, 0]);
    subscription.unsubscribe();
});

it('cancels loading when the user leaves before the opening transition finishes', () => {
    const query = jest.fn(() => new Subject<string>());
    const subscription = observeScreenData(query).subscribe();
    subscription.unsubscribe(); start();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
});

it('unsubscribes from live database updates after leaving the screen', () => {
    const rows = new Subject<string>();
    const next = jest.fn();
    const subscription = observeScreenData(() => rows).subscribe(next);
    start(); rows.next('current');
    subscription.unsubscribe(); rows.next('late');
    expect(next.mock.calls).toEqual([[undefined], ['current']]);
    expect(rows.observed).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
});

it('waits for all detail queries while keeping the initial loading shell available', () => {
    const album = new Subject<string | null>(); const tracks = new Subject<string[]>();
    const values: unknown[] = [];
    const subscription = observeScreenData(() => combineLatest({ album, tracks })).subscribe(value => values.push(value));
    start(); album.next('album');
    expect(values).toEqual([undefined]);
    tracks.next([]);
    expect(values).toEqual([undefined, { album: 'album', tracks: [] }]);
    album.next(null);
    expect(values.at(-1)).toEqual({ album: null, tracks: [] });
    subscription.unsubscribe();
});

it('forwards a synchronous query error after the pending screen has mounted', () => {
    const failure = new Error('Query unavailable'); const error = jest.fn(); const next = jest.fn();
    observeScreenData(() => { throw failure; }).subscribe({ next, error });
    expect(next).toHaveBeenCalledWith(undefined);
    expect(error).not.toHaveBeenCalled();
    start();
    expect(error).toHaveBeenCalledWith(failure);
    expect(cancel).toHaveBeenCalledTimes(1);
});

it('keeps a deleted record distinct from the initial pending state', () => {
    const rows = new Subject<string | null>(); const values: unknown[] = [];
    const subscription = observeScreenData(() => rows).subscribe(value => values.push(value));
    start(); rows.next(null);
    expect(values).toEqual([undefined, null]);
    subscription.unsubscribe();
});

it('releases deferred work when a source completes synchronously', () => {
    const subscription = observeScreenData(() => new Observable<string>(subscriber => {
        subscriber.next('ready'); subscriber.complete();
    })).subscribe();
    start();
    expect(subscription.closed).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
});
