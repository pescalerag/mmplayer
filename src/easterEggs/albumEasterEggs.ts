import type { ImageURISource } from 'react-native';
import { yspsfagsilScrubber } from './albumEasterEggAssets';

export interface AlbumEasterEgg {
    readonly id: string;
    readonly albumTitle: string;
    readonly artistName: string;
    readonly progress: {
        readonly color: string;
        readonly thumbImage: ImageURISource;
    };
}

// Add future album surprises here; playback and DB code do not need to change.
export const ALBUM_EASTER_EGGS: readonly AlbumEasterEgg[] = [
    {
        id: 'olivia-rodrigo-yspsfagsil',
        albumTitle: 'you seem pretty sad for a girl so in love',
        artistName: 'Olivia Rodrigo',
        progress: { color: '#F75E91', thumbImage: yspsfagsilScrubber },
    },
];

function normalize(value: string) {
    return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function key(albumTitle: string, artistName: string) {
    return JSON.stringify([normalize(albumTitle), normalize(artistName)]);
}

const byAlbumAndArtist = new Map(ALBUM_EASTER_EGGS.map(egg => [
    key(egg.albumTitle, egg.artistName), egg,
]));

export function getAlbumEasterEgg(albumTitle?: string | null, artistName?: string | null) {
    if (!albumTitle || !artistName) return undefined;
    return byAlbumAndArtist.get(key(albumTitle, artistName));
}
