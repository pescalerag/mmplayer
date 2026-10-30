import type Album from '../database/models/Album';
import { mySchema } from '../database/schema';
import { myMigrations } from '../database/migrations';

const mockExtract = jest.fn();
const mockQuery = jest.fn();
const mockWrite = jest.fn(async (callback: () => any) => callback());
jest.mock('../../modules/native-equalizer', () => ({ extractColorFromImage: (...args: any[]) => mockExtract(...args) }));
jest.mock('../database', () => ({ database: {
    collections: { get: () => ({ query: () => ({ fetch: mockQuery }) }) },
    write: (callback: any) => mockWrite(callback),
} }));

type ColorModule = typeof import('../services/AlbumCoverColorService');
let service: ColorModule;
const freshService = () => jest.isolateModules(() => { service = jest.requireActual<ColorModule>('../services/AlbumCoverColorService'); });
const makeAlbum = (coverUrl = 'file:///cover.jpg?t=1', color?: string, source = coverUrl) => {
    const album = { coverUrl, coverColor: color ?? null, coverColorSource: color ? source : null,
        collection: {}, _raw: { _status: 'synced' }, update: jest.fn() };
    album.update.mockImplementation(async callback => callback(album));
    return album as unknown as Album;
};
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(finish => { resolve = finish; });
    return { resolve, promise };
};
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

beforeEach(() => {
    jest.clearAllMocks(); freshService();
    mockExtract.mockReset().mockResolvedValue('#123456');
    mockQuery.mockReset().mockResolvedValue([]);
    mockWrite.mockImplementation(async callback => callback());
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('migrates existing albums with optional fields without replacing any library data', () => {
    const migration = myMigrations.sortedMigrations.find(item => item.toVersion === 22)!;
    expect(migration.steps).toEqual([{ type: 'add_columns', table: 'albums', columns: [
        { name: 'cover_color', type: 'string', isOptional: true },
        { name: 'cover_color_source', type: 'string', isOptional: true },
    ] }]);
    expect(mySchema.version).toBeGreaterThanOrEqual(22);
    expect(mySchema.tables.albums.columns.cover_color.isOptional).toBe(true);
    expect(mySchema.tables.albums.columns.cover_color_source.isOptional).toBe(true);
    expect(mySchema.tables.albums.columns.cover_url).toBeDefined();
});

it('stores a successfully extracted color and reads it after a cold service restart', async () => {
    const album = makeAlbum();
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBe('#123456');
    expect(mockExtract).toHaveBeenCalledWith('file:///cover.jpg');
    expect(album.coverColorSource).toBe('file:///cover.jpg?t=1');
    freshService();
    expect(service.getStoredCoverColor(album.coverUrl, album)).toBe('#123456');
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBe('#123456');
    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(album.update).toHaveBeenCalledTimes(1);
});

it('shares a pending extraction and persists only once when several screens request the same album', async () => {
    const album = makeAlbum(); const work = deferred<string>();
    mockExtract.mockReturnValue(work.promise);
    const requests = Array.from({ length: 5 }, () => service.AlbumCoverColorService.getColor(album.coverUrl, album));
    await settle();
    expect(mockExtract).toHaveBeenCalledTimes(1);
    work.resolve('#abcdef');
    expect(await Promise.all(requests)).toEqual(Array(5).fill('#abcdef'));
    expect(album.update).toHaveBeenCalledTimes(1);
});

it('loads the saved album color for URL-only screens such as sharing, without decoding', async () => {
    const album = makeAlbum('content://albumart/10?t=5', '#abcd12');
    mockQuery.mockResolvedValue([album]);
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl)).toBe('#abcd12');
    expect(mockExtract).not.toHaveBeenCalled();
    expect(album.update).not.toHaveBeenCalled();
});

it('recalculates when the version changes even if the physical file path is unchanged', async () => {
    const album = makeAlbum();
    await service.AlbumCoverColorService.getColor(album.coverUrl, album);
    album.coverUrl = 'file:///cover.jpg?t=2';
    expect(service.getStoredCoverColor(album.coverUrl, album)).toBeNull();
    mockExtract.mockResolvedValue('#654321');
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBe('#654321');
    expect(mockExtract).toHaveBeenCalledTimes(2);
    expect(album.coverColorSource).toBe(album.coverUrl);
});

it('leaves the persisted color intact for metadata changes unrelated to the artwork', async () => {
    const album = makeAlbum(undefined, '#aabbcc');
    album.title = 'An edited title'; album.year = 2026;
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBe('#aabbcc');
    expect(mockExtract).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
});

it.each([
    ['content://albumart/10?t=1', 'content://albumart/10'],
    ['content://albumart/10?size=100&t=1', 'content://albumart/10?size=100'],
    ['content://albumart/10?t=1&size=100', 'content://albumart/10?size=100'],
    ['content://albumart/10?size=100', 'content://albumart/10?size=100'],
])('keeps the complete identity of %s but removes only our version before native reading', async (source, imageUri) => {
    const album = makeAlbum(source);
    await service.AlbumCoverColorService.getColor(source, album);
    expect(mockExtract).toHaveBeenCalledWith(imageUri);
    expect(album.coverColorSource).toBe(source);
});

it('does not overwrite a replacement cover with an extraction that finished late', async () => {
    const album = makeAlbum(); const work = deferred<string>();
    mockExtract.mockReturnValue(work.promise);
    const oldRequest = service.AlbumCoverColorService.getColor(album.coverUrl, album);
    await settle();
    album.coverUrl = 'file:///new.jpg?t=2';
    work.resolve('#112233'); await oldRequest;
    expect(album.update).not.toHaveBeenCalled();
    expect(service.getStoredCoverColor(album.coverUrl, album)).toBeNull();
    mockExtract.mockResolvedValue('#445566');
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBe('#445566');
});

it('does not update an album deleted while decoding', async () => {
    const album = makeAlbum(); const work = deferred<string>();
    mockExtract.mockReturnValue(work.promise);
    const request = service.AlbumCoverColorService.getColor(album.coverUrl, album);
    await settle(); album._raw._status = 'deleted';
    work.resolve('#112233'); await request;
    expect(album.update).not.toHaveBeenCalled();
});

it('shares decoding across albums with the same artwork while saving the color in each record', async () => {
    const first = makeAlbum(); const second = makeAlbum();
    await Promise.all([first, second].map(album => service.AlbumCoverColorService.getColor(album.coverUrl, album)));
    expect(mockExtract).toHaveBeenCalledTimes(1);
    expect(first.coverColor).toBe('#123456'); expect(second.coverColor).toBe('#123456');
});

it('processes different artwork sequentially to limit peak image memory', async () => {
    const work = deferred<string>(); mockExtract.mockReturnValueOnce(work.promise);
    const first = service.AlbumCoverColorService.getColor('file:///one.jpg');
    const second = service.AlbumCoverColorService.getColor('file:///two.jpg');
    await settle(); expect(mockExtract).toHaveBeenCalledTimes(1);
    work.resolve('#aabbcc'); await Promise.all([first, second]);
    expect(mockExtract).toHaveBeenCalledTimes(2);
});

it.each([null, 'invalid', '#fff'])('does not save unavailable or invalid colors (%s) and retries later', async color => {
    const album = makeAlbum(); mockExtract.mockResolvedValueOnce(color);
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBeNull();
    expect(album.update).not.toHaveBeenCalled();
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBe('#123456');
    expect(mockExtract).toHaveBeenCalledTimes(2);
});

it('recovers from a native failure without preventing later extractions', async () => {
    mockExtract.mockRejectedValueOnce(new Error('unreadable file'));
    expect(await service.AlbumCoverColorService.getColor('file:///one.jpg')).toBeNull();
    expect(await service.AlbumCoverColorService.getColor('file:///two.jpg')).toBe('#123456');
});

it('retries persistence after a database write fails without decoding the same image again', async () => {
    const album = makeAlbum(); mockWrite.mockRejectedValueOnce(new Error('write failed'));
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBeNull();
    expect(album.coverColor).toBeNull();
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBe('#123456');
    expect(mockExtract).toHaveBeenCalledTimes(1);
});

it('handles absent artwork and ignores invalid or mismatched persisted colors', async () => {
    expect(await service.AlbumCoverColorService.getColor(null)).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(service.getStoredCoverColor('file:///cover.jpg', makeAlbum(undefined, '#aabbcc'))).toBeNull();
    const album = makeAlbum(undefined, 'invalid');
    expect(service.getStoredCoverColor(album.coverUrl, album)).toBeNull();
    expect(await service.AlbumCoverColorService.getColor(album.coverUrl, album)).toBe('#123456');
});
