import { ALBUM_EASTER_EGGS, getAlbumEasterEgg } from '../easterEggs/albumEasterEggs';

jest.mock('../easterEggs/albumEasterEggAssets', () => ({
    yspsfagsilScrubber: { uri: 'bundled-scrubber.png', width: 36, height: 36 },
}));

const title = 'you seem pretty sad for a girl so in love';

it('selects the bundled scrubber and exact requested colour for the matching album and artist', () => {
    expect(getAlbumEasterEgg(title, 'Olivia Rodrigo')).toBe(ALBUM_EASTER_EGGS[0]);
    expect(getAlbumEasterEgg(title, 'Olivia Rodrigo')?.progress).toEqual({
        color: '#F75E91', thumbImage: { uri: 'bundled-scrubber.png', width: 36, height: 36 },
    });
});

it('ignores case and extra whitespace without accepting other editions', () => {
    expect(getAlbumEasterEgg(`  ${title.toUpperCase().replaceAll(' ', '  ')}\n`, ' OLIVIA\tRODRIGO ')).toBe(ALBUM_EASTER_EGGS[0]);
    expect(getAlbumEasterEgg(`${title} (Deluxe)`, 'Olivia Rodrigo')).toBeUndefined();
});

it.each([
    [title, 'Another artist'], ['SOUR', 'Olivia Rodrigo'],
    [null, 'Olivia Rodrigo'], [title, null], [undefined, undefined],
])('does not activate with different or incomplete metadata: %s / %s', (album, artist) => {
    expect(getAlbumEasterEgg(album, artist)).toBeUndefined();
});

it('returns to default immediately when leaving the matching album', () => {
    expect(getAlbumEasterEgg(title, 'Olivia Rodrigo')).toBeDefined();
    expect(getAlbumEasterEgg('GUTS', 'Olivia Rodrigo')).toBeUndefined();
    expect(getAlbumEasterEgg(title, 'Olivia Rodrigo')).toBe(ALBUM_EASTER_EGGS[0]);
});
