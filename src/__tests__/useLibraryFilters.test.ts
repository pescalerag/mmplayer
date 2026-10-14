import React from 'react';
import { Subject } from 'rxjs';
import { useIsFocused } from '@react-navigation/native';
import { useLibraryFilters } from '../hooks/useLibraryFilters';
import { LibraryFilterService } from '../services/LibraryFilterService';
import { EMPTY_SECTION_FILTERS, emptyLibraryFilterIndex, LibraryFilterIndex } from '../utils/libraryFilters';

let mockFilters = { ...EMPTY_SECTION_FILTERS };
jest.mock('../store/useLibraryStore', () => ({ useLibraryStore: (selector: any) => selector({ sectionFilters: { tracks: mockFilters } }) }));
jest.mock('../services/LibraryFilterService', () => ({ LibraryFilterService: { observe: jest.fn() } }));
jest.mock('../hooks/useDelayedLoader', () => ({ useDelayedLoader: (loading: boolean) => loading }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn(() => true) }));

describe('library filter subscription lifecycle', () => {
  let states: any[], cursor: number, source: Subject<LibraryFilterIndex>;
  let effect: { deps?: React.DependencyList; cleanup?: () => void } | undefined;
  let pending: (() => void)[];
  const render = function useFilterRender() {
    cursor = 0; pending = [];
    const result = useLibraryFilters('tracks'); pending.forEach(callback => callback()); return result;
  };
  beforeEach(() => {
    states = []; cursor = 0; effect = undefined; pending = [];
    mockFilters = { ...EMPTY_SECTION_FILTERS, neverPlayed: true };
    source = new Subject();
    (useIsFocused as jest.Mock).mockReturnValue(true);
    (LibraryFilterService.observe as jest.Mock).mockReset().mockImplementation(() => source);
    jest.spyOn(React, 'useContext').mockReturnValue('tracks');
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
      return [states[slot], (value: any) => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
    }) as any);
    jest.spyOn(React, 'useEffect').mockImplementation((callback, deps) => {
      if (effect?.deps && deps?.every((value, index) => Object.is(value, effect?.deps?.[index]))) return;
      pending.push(() => { effect?.cleanup?.(); effect = { deps, cleanup: callback() || undefined }; });
    });
  });
  afterEach(() => { effect?.cleanup?.(); jest.restoreAllMocks(); });

  it('subscribes only for the visible section and releases queries on blur', () => {
    (React.useContext as jest.Mock).mockReturnValue('folders');
    render(); expect(LibraryFilterService.observe).not.toHaveBeenCalled();
    (React.useContext as jest.Mock).mockReturnValue('tracks');
    render(); expect(source.observed).toBe(true);
    (useIsFocused as jest.Mock).mockReturnValue(false);
    render(); expect(source.observed).toBe(false);
  });

  it('waits for the current filters and discards previous results after a change', () => {
    expect(render().ready).toBe(false);
    const first = emptyLibraryFilterIndex(); first.played.add('old'); source.next(first);
    expect(render().index.played.has('old')).toBe(true);
    const old = source;
    source = new Subject(); mockFilters = { ...mockFilters, minDuration: 2 };
    expect(render().ready).toBe(false); expect(old.observed).toBe(false);
    const current = emptyLibraryFilterIndex(); current.played.add('new'); source.next(current);
    expect(render().index.played.has('new')).toBe(true);
    mockFilters = { ...EMPTY_SECTION_FILTERS };
    expect(render().ready).toBe(true); expect(source.observed).toBe(false);
  });

  it('allows retrying a database failure', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(); source.error(new Error('read failed'));
    const failed = render(); expect(failed.error).toBe(true);
    source = new Subject(); failed.retry();
    expect(render().ready).toBe(false);
    source.next(emptyLibraryFilterIndex());
    expect(render().error).toBe(false);
    expect(render().ready).toBe(true);
  });
});
