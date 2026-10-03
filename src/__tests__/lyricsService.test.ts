import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LyricsService } from '../services/LyricsService';
import Track from '../database/models/Track';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('LyricsService.exportLyrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false if track has no lyrics or only whitespace', async () => {
    const trackNoLyrics = { id: 't1', lyricsLRC: null } as unknown as Track;
    expect(await LyricsService.exportLyrics(trackNoLyrics)).toBe(false);

    const trackEmptyLyrics = { id: 't2', lyricsLRC: '   ' } as unknown as Track;
    expect(await LyricsService.exportLyrics(trackEmptyLyrics)).toBe(false);
  });

  it('exports lyrics with artist string and shares file', async () => {
    const track = {
      id: 't1',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      lyricsLRC: '[00:10.00] Is this the real life?',
    } as unknown as Track;

    const result = await LyricsService.exportLyrics(track);
    expect(result).toBe(true);

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('Queen - Bohemian Rhapsody.lrc'),
      '[00:10.00] Is this the real life?',
      { encoding: 'utf8' }
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('Queen - Bohemian Rhapsody.lrc'),
      expect.objectContaining({
        dialogTitle: 'Queen - Bohemian Rhapsody.lrc',
        mimeType: 'text/plain',
      })
    );
  });

  it('exports lyrics with artist.fetch() method', async () => {
    const track = {
      id: 't2',
      title: 'Imagine',
      artist: {
        fetch: jest.fn().mockResolvedValue({ name: 'John Lennon' }),
      },
      lyricsLRC: '[00:05.00] Imagine all the people',
    } as unknown as Track;

    const result = await LyricsService.exportLyrics(track);
    expect(result).toBe(true);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('John Lennon - Imagine.lrc'),
      '[00:05.00] Imagine all the people',
      { encoding: 'utf8' }
    );
  });

  it('exports lyrics with artist.name property directly', async () => {
    const track = {
      id: 't3',
      title: 'Yesterday',
      artist: { name: 'The Beatles' },
      lyricsLRC: '[00:01.00] Yesterday',
    } as unknown as Track;

    const result = await LyricsService.exportLyrics(track);
    expect(result).toBe(true);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('The Beatles - Yesterday.lrc'),
      '[00:01.00] Yesterday',
      { encoding: 'utf8' }
    );
  });

  it('exports lyrics without artist if artist is not available or throws', async () => {
    const track = {
      id: 't4',
      title: 'Unknown Track / Special: Name?',
      artist: {
        fetch: jest.fn().mockRejectedValue(new Error('Fetch failed')),
      },
      lyricsLRC: '[00:01.00] Instrumental',
    } as unknown as Track;

    const result = await LyricsService.exportLyrics(track);
    expect(result).toBe(true);
    // Sanitize replaces /:? with _
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('Unknown Track _ Special_ Name_.lrc'),
      '[00:01.00] Instrumental',
      { encoding: 'utf8' }
    );
  });

  it('throws error when sharing is not available on device', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

    const track = {
      id: 't5',
      title: 'Track Title',
      artist: 'Artist',
      lyricsLRC: '[00:01.00] Some lyrics',
    } as unknown as Track;

    await expect(LyricsService.exportLyrics(track)).rejects.toThrow('Sharing is not available on this device');
  });
});
