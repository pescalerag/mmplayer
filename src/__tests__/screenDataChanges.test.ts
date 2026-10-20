import { Subject } from 'rxjs';
import { database } from '../database';
import { observeTableChanges } from '../services/ScreenDataChanges';
import { ObservedRefresh } from '../utils/observedRefresh';

it('shares write notifications without fetching rows, isolates dependencies and releases subscriptions', async () => {
    const tracks = new Subject(); const history = new Subject(); const tags = new Subject();
    const tables: Record<string, Subject<unknown>> = { tracks, playback_history: history, tags };
    const fetch = jest.fn();
    (database.get as jest.Mock).mockImplementation(table => ({ changes: tables[table], query: fetch }));
    const ranked = jest.fn(); const listening = jest.fn();
    const a = observeTableChanges(['tracks']).subscribe(ranked);
    const b = observeTableChanges(['tracks', 'playback_history']).subscribe(listening);
    expect(database.get).toHaveBeenCalledTimes(2);
    history.next([{ type: 'updated', durationPlayed: 70 }]);
    expect(ranked).not.toHaveBeenCalled();
    expect(listening).toHaveBeenCalledTimes(1);
    tags.next([{ type: 'created' }]);
    expect(listening).toHaveBeenCalledTimes(1);
    tracks.next([{ type: 'destroyed' }]);
    expect(ranked).toHaveBeenCalledTimes(1);
    expect(listening).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
    a.unsubscribe(); expect(tracks.observed).toBe(true);
    b.unsubscribe(); expect(tracks.observed).toBe(false); expect(history.observed).toBe(false);
});

it('updates visible consumers after a history modification and defers the hidden one until focus', async () => {
    const history = new Subject();
    (database.get as jest.Mock).mockReturnValue({ changes: history });
    const jobs = new Set<() => void>();
    const schedule = (job: () => void) => { jobs.add(job); return () => { jobs.delete(job); }; };
    const visible = jest.fn(); const hidden = jest.fn();
    const a = new ObservedRefresh(visible, schedule, jest.fn());
    const b = new ObservedRefresh(hidden, schedule, jest.fn());
    const subscription = observeTableChanges(['playback_history']).subscribe(() => { a.invalidate(); b.invalidate(); });
    const paint = async () => { [...jobs].forEach(job => { jobs.delete(job); job(); }); for (let i = 0; i < 6; i++) await Promise.resolve(); };
    a.setVisible(true); await paint();
    history.next([{ type: 'updated', record: { durationPlayed: 80 } }]); await paint();
    expect(visible).toHaveBeenCalledTimes(2); expect(hidden).not.toHaveBeenCalled();
    b.setVisible(true); await paint();
    expect(hidden).toHaveBeenCalledTimes(1);
    a.dispose(); b.dispose(); subscription.unsubscribe();
});
