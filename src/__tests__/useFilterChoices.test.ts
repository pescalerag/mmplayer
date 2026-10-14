import React from 'react';
import { useFilterChoices } from '../hooks/useFilterChoices';
import { database } from '../database';

describe('filter choices load and retry', () => {
  let states: any[], cursor: number;
  let effect: { deps?: React.DependencyList; cleanup?: () => void } | undefined;
  let pending: (() => void)[];
  const fetch = jest.fn();
  const render = function useChoicesRender(enabled = true) {
    cursor = 0; pending = [];
    const result = useFilterChoices(enabled); pending.forEach(callback => callback()); return result;
  };
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
  beforeEach(() => {
    states = []; cursor = 0; effect = undefined; pending = [];
    fetch.mockReset();
    (database.get as jest.Mock).mockReturnValue({ query: () => ({ fetch }) });
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

  it('only loads enabled choices, deduplicates and sorts genres and formats', async () => {
    render(false); expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue([
      { genre: ' Rock ', fileUrl: 'file:///a.MP3' }, { genre: 'Jazz', fileUrl: 'file:///b.flac' },
      { genre: 'Rock', fileUrl: 'file:///c.mp3' }, { genre: null, fileUrl: 'file:///no-extension' }, { genre: '', fileUrl: 'file:///e.wav' },
    ]);
    render(); await flush();
    expect(render()).toMatchObject({ genres: ['Jazz', 'Rock'], formats: ['flac', 'mp3', 'wav'], error: false });
  });

  it('retries failed reads and clears the error after a successful retry', async () => {
    fetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    render(); await flush();
    const failed = render(); expect(failed.error).toBe(true);
    failed.retry(); render(); await flush();
    expect(render()).toMatchObject({ error: false, genres: [], formats: [] });
  });

  it('discards a pending response when the component is disabled or unmounted', async () => {
    let resolve!: (tracks: any[]) => void;
    fetch.mockImplementation(() => new Promise(done => { resolve = done; }));
    render(); render(false);
    resolve([{ genre: 'Old', fileUrl: 'file:///old.mp3' }]); await flush();
    expect(render(false).genres).toEqual([]);
  });

  it('discards failures from an obsolete read', async () => {
    let reject!: (error: Error) => void;
    fetch.mockImplementation(() => new Promise((_done, fail) => { reject = fail; }));
    render(); effect?.cleanup?.();
    reject(new Error('late error')); await flush();
    expect(states[0].error).toBe(false);
  });
});
