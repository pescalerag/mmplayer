import React from 'react';
import { Subject } from 'rxjs';
import { database } from '../database';
import { useSearchBrowseTags } from '../hooks/useSearchBrowseTags';
import { scheduleScreenRefresh } from '../utils/scheduleScreenRefresh';

jest.mock('../utils/scheduleScreenRefresh', () => ({ scheduleScreenRefresh: jest.fn() }));

describe('search browse data without blocking initial screen rendering', () => {
    let start: () => void;
    let cleanup: (() => void) | undefined;
    let rows: Subject<any[]>;
    const cancel = jest.fn();
    const updateTags = jest.fn();
    const query = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        rows = new Subject();
        cleanup = undefined;
        jest.spyOn(React, 'useState').mockReturnValue([null, updateTags]);
        jest.spyOn(React, 'useEffect').mockImplementation(effect => { cleanup = effect() || undefined; });
        (scheduleScreenRefresh as jest.Mock).mockImplementation(callback => { start = callback; return cancel; });
        query.mockReturnValue({ observe: () => rows });
        (database.get as jest.Mock).mockReturnValue({ query });
    });
    afterEach(() => { cleanup?.(); jest.restoreAllMocks(); });

    it('returns a pending browse state immediately and starts the query after the screen paints', () => {
        expect(useSearchBrowseTags()).toBeNull();
        expect(query).not.toHaveBeenCalled();
        expect(updateTags).not.toHaveBeenCalled();
        start();
        expect(query).toHaveBeenCalledTimes(1);
        expect(updateTags).not.toHaveBeenCalled();
        const tags = [{ id: 'rock', name: 'Rock' }];
        rows.next(tags);
        expect(updateTags).toHaveBeenCalledWith(tags);
        rows.next([]);
        expect(updateTags).toHaveBeenLastCalledWith([]);
    });

    it('cancels deferred loading when leaving before the query starts', () => {
        useSearchBrowseTags();
        cleanup?.();
        cleanup = undefined;
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(query).not.toHaveBeenCalled();
    });

    it('unsubscribes on leaving and ignores later database results', () => {
        useSearchBrowseTags();
        start();
        cleanup?.();
        cleanup = undefined;
        rows.next([{ id: 'late' }]);
        expect(updateTags).not.toHaveBeenCalled();
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('handles query failures without preventing the rest of the search screen from rendering', () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        useSearchBrowseTags();
        start();
        rows.error(new Error('Database unavailable'));
        expect(updateTags).toHaveBeenCalledWith([]);
        expect(console.warn).toHaveBeenCalled();
    });
});
