import { DISCORD_FALLBACK_ASSET, MMPLAYER_WEBSITE } from '../../config/discord';

export interface DiscordSong {
    id: string; title: string; primaryArtist: string; artists: string[];
    album: string; coverUrl?: string | null;
}
export interface DiscordActivity {
    name: string; type: 2; status_display_type: 0; details: string; state: string;
    details_url: string; state_url: string;
    assets: { large_image: string; large_text: string; large_url: string };
    timestamps?: { start: number; end: number };
    buttons: { label: string; url: string }[];
}
export type DiscordStatus = 'disabled' | 'needs_application_id' | 'native_unavailable' | 'waiting_for_discord' | 'connected' | 'error';
export const validApplicationId = (id: string) => /^\d{17,20}$/.test(id);
export function publicArtworkUrl(url?: string | null): string | null {
    try {
        const parsed = new URL(url || '');
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname.includes('.')
            || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname)) return null;
        return parsed.href;
    } catch { return null; }
}
const text = (value: string) => [...value.trim()].slice(0, 128).join('') || 'MMPlayer';
export function buildDiscordActivity(song: DiscordSong, position: number, duration: number, rate = 1, now = Date.now()): DiscordActivity {
    const artists = [...new Set([song.primaryArtist, ...song.artists].map(value => value.trim()).filter(Boolean))];
    const activity: DiscordActivity = {
        name: text(song.primaryArtist), type: 2, status_display_type: 0,
        details: text(song.title), state: text(artists.join(', ')), details_url: MMPLAYER_WEBSITE, state_url: MMPLAYER_WEBSITE,
        assets: { large_image: publicArtworkUrl(song.coverUrl) || DISCORD_FALLBACK_ASSET,
            large_text: text([song.album, artists.join(', ')].filter(Boolean).join(' · ')), large_url: MMPLAYER_WEBSITE },
        buttons: [{ label: 'MMPlayer', url: MMPLAYER_WEBSITE }],
    };
    if (Number.isFinite(position) && Number.isFinite(duration) && duration > 0 && Number.isFinite(rate) && rate > 0) {
        const at = Math.max(0, Math.min(position, duration));
        const start = Math.floor(now / 1000 - at / rate);
        activity.timestamps = { start, end: Math.max(start + 1, Math.ceil(now / 1000 + (duration - at) / rate)) };
    }
    return activity;
}
export interface DiscordTransport {
    configure(applicationId: string): Promise<DiscordStatus>;
    setActivity(activity: DiscordActivity | null): Promise<void>;
    disconnect(): Promise<void>;
}
