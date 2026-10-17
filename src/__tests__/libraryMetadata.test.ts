import i18n from '../constants/i18n';
import Artist from '../database/models/Artist';
import Album from '../database/models/Album';
import {
    UNKNOWN_ARTIST, UNKNOWN_ALBUM, VARIOUS_ARTISTS,
    getArtistStorageName, getAlbumStorageTitle,
    getArtistDisplayName, getAlbumDisplayTitle,
    isUnknownArtist, isVariousArtists, getMetadataSearchAliases, getMediaDisplayTitle,
} from '../utils/libraryMetadata';

afterEach(async () => { await i18n.changeLanguage('en'); });

it.each([
    ['en', 'Unknown artist', 'Various artists', 'Unknown album'],
    ['es', 'Artista desconocido', 'Varios artistas', 'Álbum desconocido'],
    ['pt', 'Artista desconhecido', 'Vários artistas', 'Álbum desconhecido'],
])('renders legacy database names in %s without changing their stored values', async (language, unknown, various, unknownAlbum) => {
    const artist = Object.create(Artist.prototype) as Artist;
    const compilation = Object.create(Artist.prototype) as Artist;
    const album = Object.create(Album.prototype) as Album;
    artist.storedName = 'Artista Desconocido';
    compilation.storedName = 'Varios Artistas';
    album.storedTitle = 'Álbum Desconocido';
    await i18n.changeLanguage(language);
    expect(artist.name).toBe(unknown);
    expect(compilation.name).toBe(various);
    expect(album.title).toBe(unknownAlbum);
    expect([artist.storedName, compilation.storedName, album.storedTitle])
        .toEqual(['Artista Desconocido', 'Varios Artistas', 'Álbum Desconocido']);
});

it('updates already loaded models when the language changes, without rewriting records', async () => {
    const artist = Object.create(Artist.prototype) as Artist;
    artist.name = UNKNOWN_ARTIST;
    await i18n.changeLanguage('en'); expect(artist.name).toBe('Unknown artist');
    await i18n.changeLanguage('pt'); expect(artist.name).toBe('Artista desconhecido');
    await i18n.changeLanguage('es'); expect(artist.name).toBe('Artista desconocido');
    expect(artist.storedName).toBe(UNKNOWN_ARTIST);
});

it.each(['Daft Punk', 'Beyoncé', 'Unknown Pleasures', 'Various Artists Orchestra'])('preserves real metadata: %s', name => {
    expect(getArtistDisplayName(name)).toBe(name);
    expect(getAlbumDisplayTitle(name)).toBe(name);
    expect(getArtistStorageName(name)).toBe(name);
    expect(getAlbumStorageTitle(name)).toBe(name);
    expect(isVariousArtists(name)).toBe(false);
    expect(isUnknownArtist(name)).toBe(false);
});

it.each(['Artista Desconocido', 'Artista desconhecido', 'Unknown Artist', 'artista desconocido'])('maps %s to the same unknown-artist identity', name => {
    expect(getArtistStorageName(name)).toBe(UNKNOWN_ARTIST);
    expect(isUnknownArtist(name)).toBe(true);
});

it.each(['Varios Artistas', 'Vários Artistas', 'Various Artists'])('recognizes compilations in any language: %s', name => {
    expect(getArtistStorageName(name)).toBe(VARIOUS_ARTISTS);
    expect(isVariousArtists(name)).toBe(true);
});

it.each(['Álbum Desconocido', 'Álbum desconhecido', 'Unknown Album', 'Album Desconocido'])('maps %s to the same unknown-album identity', title => {
    expect(getAlbumStorageTitle(title)).toBe(UNKNOWN_ALBUM);
});

it('keeps normal model assignments writable and preserves the actual tag text', () => {
    const artist = Object.create(Artist.prototype) as Artist;
    const album = Object.create(Album.prototype) as Album;
    artist.name = 'Beyoncé'; album.title = 'Renaissance';
    expect(artist.storedName).toBe('Beyoncé'); expect(artist.name).toBe('Beyoncé');
    expect(album.storedTitle).toBe('Renaissance'); expect(album.title).toBe('Renaissance');
});

it('translates saved recent items without treating song or playlist titles as placeholders', async () => {
    await i18n.changeLanguage('en');
    expect(getMediaDisplayTitle('album', 'Álbum Desconocido')).toBe('Unknown album');
    expect(getMediaDisplayTitle('artist', 'Varios Artistas')).toBe('Various artists');
    expect(getMediaDisplayTitle('track', 'Varios Artistas')).toBe('Varios Artistas');
    expect(getMediaDisplayTitle('playlist', 'Álbum Desconocido')).toBe('Álbum Desconocido');
});

it('finds legacy Spanish records by partial English and Portuguese placeholder labels', async () => {
    await i18n.changeLanguage('en');
    expect(getMetadataSearchAliases('various', 'artist')).toContain('varios artistas');
    expect(getMetadataSearchAliases('unknown', 'artist')).toContain('artista desconocido');
    expect(getMetadataSearchAliases('unknown', 'album')).toContain('álbum desconocido');
    expect(getMetadataSearchAliases('Daft Punk', 'artist')).toEqual([]);
    expect(getMetadataSearchAliases('Discovery', 'album')).toEqual([]);
    await i18n.changeLanguage('pt');
    expect(getMetadataSearchAliases('varios', 'artist')).toContain('varios artistas');
    expect(getMetadataSearchAliases('desconhecido', 'album')).toContain(UNKNOWN_ALBUM);
});

it.each(['en', 'es', 'pt'])('translates the reported labels and pluralized dialogs in %s', async language => {
    await i18n.changeLanguage(language);
    const keys = ['search.album_by', 'search.song_by', 'tags.batch_tags', 'scanner.cleaning_empty_albums',
        'scanner.cleaning_empty_artists', 'actions.share_zip_error', 'actions.exclude_songs_confirm', 'library.song_count'];
    for (const key of keys) {
        const label = i18n.t(key, { artist: 'Daft Punk', count: 2 });
        expect(label).not.toBe(key); expect(label).not.toContain('{{');
    }
    if (language === 'en') {
        expect(i18n.t('search.song_by', { artist: 'Daft Punk' })).toBe('Song • Daft Punk');
        expect(i18n.t('library.song_count', { count: 1 })).toBe('1 song');
        expect(i18n.t('library.song_count', { count: 2 })).toBe('2 songs');
    }
});
