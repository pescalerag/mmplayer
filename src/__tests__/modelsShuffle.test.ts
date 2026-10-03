import Album from '../database/models/Album';
import Track from '../database/models/Track';

jest.mock('@nozbe/watermelondb/decorators', () => ({
  field: () => () => { },
  text: () => () => { },
  relation: () => () => { },
  children: () => () => { },
  lazy: () => () => { },
  date: () => () => { },
  readonly: () => () => { },
  json: () => () => { },
}));

describe('Album & Track shuffle exclusion models', () => {
  const createModelInstance = (cls: any) => {
    const instance = Object.create(cls.prototype);
    instance.isExcludedFromShuffle = false;
    Object.defineProperty(instance, 'database', {
      value: {
        write: jest.fn().mockImplementation(async (cb: () => Promise<void>) => cb()),
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(instance, 'update', {
      value: jest.fn().mockImplementation(async (cb: (a: any) => void) => {
        cb(instance);
      }),
      configurable: true,
      writable: true,
    });
    return instance;
  };

  describe('Album', () => {
    it('should toggle isExcludedFromShuffle', async () => {
      const album = createModelInstance(Album);

      await album.toggleExcludeFromShuffle();
      expect(album.isExcludedFromShuffle).toBe(true);

      await album.toggleExcludeFromShuffle();
      expect(album.isExcludedFromShuffle).toBe(false);
    });

    it('should set isExcludedFromShuffle explicitly', async () => {
      const album = createModelInstance(Album);

      await album.setExcludeFromShuffle(true);
      expect(album.isExcludedFromShuffle).toBe(true);

      await album.setExcludeFromShuffle(false);
      expect(album.isExcludedFromShuffle).toBe(false);
    });
  });

  describe('Track', () => {
    it('should toggle isExcludedFromShuffle', async () => {
      const track = createModelInstance(Track);

      await track.toggleExcludeFromShuffle();
      expect(track.isExcludedFromShuffle).toBe(true);

      await track.toggleExcludeFromShuffle();
      expect(track.isExcludedFromShuffle).toBe(false);
    });

    it('should set isExcludedFromShuffle explicitly', async () => {
      const track = createModelInstance(Track);

      await track.setExcludeFromShuffle(true);
      expect(track.isExcludedFromShuffle).toBe(true);

      await track.setExcludeFromShuffle(false);
      expect(track.isExcludedFromShuffle).toBe(false);
    });
  });
});
