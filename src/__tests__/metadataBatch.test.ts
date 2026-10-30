import { buildMetadataBatch } from '../utils/metadataBatch';

describe('shared metadata edit planning', () => {
  it('avoids file writes when no fields changed', () => {
    expect(buildMetadataBatch([{ fileUrl: 'file:///Music/Song.mp3' }], {}, false)).toEqual([]);
  });
  it('keeps single-track title, track and disc edits in the file payload', () => {
    const [item] = buildMetadataBatch([{ fileUrl: 'file:///Music/Song.flac' }], { title: 'New title', trackNumber: '4', discNumber: '2', year: '2026' }, false);
    expect(item.filePath).toBe('file:///Music/Song.flac');
    expect(item.metadata).toMatchObject({ title: 'New title', trackNumber: 4, discNumber: 2, year: 2026 });
  });
  it('applies batch fields without copying a title to every song, and numbers files across discs correctly', () => {
    const items = buildMetadataBatch([
      { fileUrl: 'file:///Music/1-02%20Song.mp3' },
      { fileUrl: 'file:///Music/2-03%20Other.flac' },
      { fileUrl: 'file:///Music/No-number.wav' },
    ], { title: 'Do not reuse', artist: 'Artist', genre: 'Rock' }, true, true);
    expect(items.map(item => item.metadata.trackNumber)).toEqual([2, 3, 3]);
    expect(items.every(item => item.metadata.title === null && item.metadata.artist === 'Artist' && item.metadata.genre === 'Rock')).toBe(true);
  });
});
