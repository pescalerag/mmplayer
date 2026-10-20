import { Subject } from 'rxjs';
import { database } from '../database';
import { useLyricsDocument } from '../hooks/useLyricsDocument';
import { createHookHarness } from './helpers/hookHarness';

it('keeps a fixed document and original text even when that model changes, and detaches on document change', () => {
    const a = new Subject<any>(), b = new Subject<any>();
    const find = jest.fn((id: string) => id === 'a' ? a : b);
    (database.get as jest.Mock).mockReturnValue({ findAndObserve: find });
    const harness = createHookHarness();
    try {
        const render = (id = 'a') => harness.render(() => useLyricsDocument(id));
        render();
        const track = { id: 'a', lyricsLRC: 'Original' };
        a.next(track);
        expect(render().document).toEqual({ track, text: 'Original' });
        track.lyricsLRC = 'Changed externally'; a.next(track);
        expect(render().document?.text).toBe('Original');
        expect(find).toHaveBeenCalledTimes(1);
        render('b'); expect(a.observed).toBe(false);
        b.next({ id: 'b', lyricsLRC: 'Second' });
        expect(render('b').document?.track.id).toBe('b');
        b.complete(); expect(render('b').missing).toBe(true);
        expect(render('b').document).toBeNull();
    } finally { harness.dispose(); jest.restoreAllMocks(); }
});
