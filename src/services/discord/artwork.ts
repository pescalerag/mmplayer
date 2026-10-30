import { DiscordSong, publicArtworkUrl } from './activity';
// Catalogs often add colons, hyphens or different spacing to local tags.
// Keep every letter/number so sequels and distinct album editions stay distinct.
const normalize = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const cache = new Map<string, Promise<string | null>>();
/** Discord cannot read file:// or mmplayer-media://. Resolve a matching public album image instead. */
export function resolveDiscordArtwork(song: DiscordSong): Promise<string | null> {
    const direct = publicArtworkUrl(song.coverUrl);
    if (direct) return Promise.resolve(direct);
    if (!song.album.trim() || !song.primaryArtist.trim()) return Promise.resolve(null);
    const key = normalize(song.primaryArtist) + '\n' + normalize(song.album);
    const existing = cache.get(key);
    if (existing) return existing;
    const result = (async () => {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(song.primaryArtist + ' ' + song.album)}&limit=25`, { signal: controller.signal });
            if (!response.ok) throw Error('Artwork lookup failed');
            const json = await response.json();
            const album = Array.isArray(json.data) && json.data.find((item: any) => normalize(item.title || '') === normalize(song.album) && normalize(item.artist?.name || '') === normalize(song.primaryArtist));
            const url = publicArtworkUrl(album?.cover_xl || album?.cover_big);
            // A failed search must not permanently suppress artwork for the session.
            if (!url) cache.delete(key);
            return url;
        } catch { cache.delete(key); return null; }
        finally { clearTimeout(timeout); }
    })();
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
}
