import { database } from '../database';
import { TagService } from '../services/tagService';
import { LocalCastMetadataService } from '../services/LocalCastMetadataService';

jest.mock('../database', () => ({ database: { get: jest.fn(), withChangesForTables: jest.fn() } }));
jest.mock('../services/tagService', () => ({ TagService: { getAllTags: jest.fn(), getTagIdsForTrack: jest.fn(), toggleTrackTag: jest.fn() } }));

describe('LocalCast metadata persistence and cache', () => {
    const track = { rating: 3.5, updateRating: jest.fn().mockResolvedValue(undefined) };
    const find = jest.fn();
    const unsubscribe = jest.fn();
    let invalidate: () => void;
    beforeEach(() => {
        jest.clearAllMocks();
        track.rating = 3.5;
        find.mockResolvedValue(track);
        (database.get as jest.Mock).mockReturnValue({ find });
        (database.withChangesForTables as jest.Mock).mockReturnValue({ subscribe: (callback: () => void) => { invalidate = callback; return { unsubscribe }; } });
        (TagService.getAllTags as jest.Mock).mockResolvedValue([{ id: 'tag', name: 'Game music', color: '#12ABCD' }]);
        (TagService.getTagIdsForTrack as jest.Mock).mockResolvedValue(['tag']);
        LocalCastMetadataService.start();
    });
    afterEach(() => LocalCastMetadataService.stop());

    it('sends metadata once, shares concurrent reads and refreshes after phone edits', async () => {
        const [first, concurrent] = await Promise.all([LocalCastMetadataService.read('song', null), LocalCastMetadataService.read('song', null)]);
        expect(first).toEqual(concurrent);
        expect(first).toMatchObject({ trackMetadata: { trackId: 'song', rating: 3.5, tagIds: ['tag'], availableTags: [{ id: 'tag', name: 'Game music', color: '#12ABCD' }] } });
        expect(find).toHaveBeenCalledTimes(1);
        expect(await LocalCastMetadataService.read('song', first.metadataVersion!)).toEqual({ metadataVersion: first.metadataVersion });
        expect(TagService.getAllTags).toHaveBeenCalledTimes(1);
        track.rating = 5; invalidate();
        expect(await LocalCastMetadataService.read('song', first.metadataVersion!)).toMatchObject({ trackMetadata: { rating: 5 } });
        await LocalCastMetadataService.read('other', null);
        expect(find).toHaveBeenLastCalledWith('other');
    });

    it('does not acknowledge failed reads and retries without breaking audio state', async () => {
        find.mockRejectedValueOnce(new Error('Missing track'));
        expect(await LocalCastMetadataService.read('song', null)).toEqual({});
        expect(await LocalCastMetadataService.read('song', null)).toHaveProperty('trackMetadata');
    });

    it.each(['0.5', '3.5', '5', '0'])('saves rating %s through the existing track model', async rating => {
        const result = await LocalCastMetadataService.edit(new URLSearchParams({ trackId: 'song', action: 'rating', rating }));
        expect(result).toBe(true);
        expect(track.updateRating).toHaveBeenCalledWith(rating === '0' ? null : Number(rating));
    });
    it.each(['', '-1', '5.5', '3.1', 'NaN', 'Infinity'])('rejects invalid rating %s', async rating => {
        expect(await LocalCastMetadataService.edit(new URLSearchParams({ trackId: 'song', action: 'rating', rating }))).toBe(false);
        expect(track.updateRating).not.toHaveBeenCalled();
    });
    it.each(['true', 'false'])('uses explicit association %s so retries do not toggle tags twice', async associated => {
        expect(await LocalCastMetadataService.edit(new URLSearchParams({ trackId: 'song', action: 'tag', tagId: 'tag', associated }))).toBe(true);
        expect(TagService.toggleTrackTag).toHaveBeenCalledWith('song', 'tag', associated === 'true');
    });
    it('validates the request and existing records before modifying associations', async () => {
        for (const params of [new URLSearchParams(), new URLSearchParams({ trackId: 'song', action: 'unknown' }), new URLSearchParams({ trackId: 'song', action: 'rating' }), new URLSearchParams({ trackId: 'song', action: 'tag', tagId: 'tag', associated: 'maybe' })]) {
            expect(await LocalCastMetadataService.edit(params)).toBe(false);
        }
        find.mockRejectedValueOnce(new Error('Deleted tag'));
        await expect(LocalCastMetadataService.edit(new URLSearchParams({ trackId: 'song', action: 'tag', tagId: 'tag', associated: 'true' }))).rejects.toThrow('Deleted tag');
        expect(TagService.toggleTrackTag).not.toHaveBeenCalled();
    });
    it('releases observers at the end of a session', () => {
        LocalCastMetadataService.stop();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
