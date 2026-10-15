import i18n from '../constants/i18n';

// Stable database identities, independent of the selected interface language.
export const UNKNOWN_ARTIST = 'Unknown Artist';
export const VARIOUS_ARTISTS = 'Various Artists';
export const UNKNOWN_ALBUM = 'Unknown Album';

const artistAliases = new Map([
    ['unknown artist', UNKNOWN_ARTIST],
    ['artista desconocido', UNKNOWN_ARTIST],
    ['artista desconhecido', UNKNOWN_ARTIST],
    ['various artists', VARIOUS_ARTISTS],
    ['varios artistas', VARIOUS_ARTISTS],
    ['vários artistas', VARIOUS_ARTISTS],
]);
const albumAliases = new Set(['unknown album', 'álbum desconocido', 'album desconocido', 'álbum desconhecido', 'album desconhecido']);

export function getArtistStorageName(name: string): string {
    return artistAliases.get(name.trim().toLowerCase()) ?? name;
}

export function getAlbumStorageTitle(title: string): string {
    return albumAliases.has(title.trim().toLowerCase()) ? UNKNOWN_ALBUM : title;
}

export function isVariousArtists(name: string): boolean {
    return getArtistStorageName(name) === VARIOUS_ARTISTS;
}

export function isUnknownArtist(name: string): boolean {
    return getArtistStorageName(name) === UNKNOWN_ARTIST;
}

export function getArtistDisplayName(name: string): string {
    const identity = getArtistStorageName(name);
    if (identity === UNKNOWN_ARTIST) return i18n.t('metadata.unknown_artist');
    if (identity === VARIOUS_ARTISTS) return i18n.t('metadata.various_artists');
    return name;
}

export function getAlbumDisplayTitle(title: string): string {
    return getAlbumStorageTitle(title) === UNKNOWN_ALBUM ? i18n.t('metadata.unknown_album') : title;
}

export function getMediaDisplayTitle(type: string, title: string): string {
    if (type === 'artist') return getArtistDisplayName(title);
    if (type === 'album') return getAlbumDisplayTitle(title);
    return title;
}

// Include existing records in searches for their translated display labels.
export function getMetadataSearchAliases(query: string, type: 'artist' | 'album'): string[] {
    const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matches = (label: string) => normalize(label).includes(normalize(query));
    if (type === 'album') {
        return matches(i18n.t('metadata.unknown_album')) ? [UNKNOWN_ALBUM, ...albumAliases] : [];
    }
    return [UNKNOWN_ARTIST, VARIOUS_ARTISTS, ...artistAliases.keys()]
        .filter(name => matches(getArtistDisplayName(name)));
}
