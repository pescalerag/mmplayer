import TrackPlayer, { Event, State } from 'react-native-track-player';
import { create } from 'zustand';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { DISCORD_APPLICATION_ID } from '../config/discord';
import { buildDiscordActivity, DiscordSong, DiscordStatus } from './discord/activity';
import { discordTransport } from './discord/transport';
import { resolveDiscordArtwork } from './discord/artwork';

export const useDiscordPresenceStatus = create<{ status: DiscordStatus }>(() => ({ status: 'disabled' }));
let started = false;
/** Shared lifecycle and metadata for desktop and mobile. The transport is platform-specific. */
export function startDiscordPresence() {
    if (started) return;
    started = true;
    let revision = 0, configuration = 0, enabled = false, configured = false, busy = false, requested = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSent = 0, lastSignature = '', lastPosition = 0;
    let cachedTrack: unknown, cachedVersion = '', cachedSong: DiscordSong | undefined;
    const status = (value: DiscordStatus) => useDiscordPresenceStatus.setState({ status: value });
    const run = async () => {
        if (!enabled || !configured || timer) return;
        if (busy) { requested = true; return; }
        busy = true;
        const current = revision;
        try {
            const { state } = await TrackPlayer.getPlaybackState();
            const track = usePlayerStore.getState().activeTrack;
            if (state !== State.Playing || !track) {
                if (revision !== current) return;
                if (lastSignature) await discordTransport.setActivity(null);
                lastSignature = '';return;
            }
            const progress = await TrackPlayer.getProgress();
            const rate = usePlayerStore.getState().playbackSpeed || 1;
            const version = JSON.stringify([track.id, track.title, track.lastModified]);
            if (cachedTrack !== track || cachedVersion !== version || !cachedSong) {
                const [artist, album, collaborators] = await Promise.all([
                    track.artist.fetch(), track.album.fetch(), track.queryCollaborators.fetch(),
                ]);
                cachedTrack = track;cachedVersion = version;
                cachedSong = { id: track.id, title: track.title, primaryArtist: artist?.name || '',
                    artists: collaborators.map((item: any) => item.name), album: album?.title || '', coverUrl: album?.coverUrl };
            }
            const song = cachedSong!;
            const signature = JSON.stringify([song, progress.duration, rate]);
            const now = Date.now();
            if (signature === lastSignature && Math.abs(progress.position - lastPosition - (now - lastSent) / 1000 * rate) < 2) return;
            if (lastSent && now - lastSent < 4500) {
                if (!timer) timer = setTimeout(() => { timer = undefined; void run(); }, 4500 - (now - lastSent));
                return;
            }
            // Send text first; public artwork lookup must not delay the current song.
            if (revision !== current || !enabled) return;
            await discordTransport.setActivity(buildDiscordActivity(song, progress.position, progress.duration, rate));
            lastSignature = signature;lastPosition = progress.position;lastSent = now;
            void resolveDiscordArtwork(song).then(artwork => {
                if (!artwork || artwork === song.coverUrl || revision !== current || !enabled) return;
                song.coverUrl = artwork;
                if (!timer) timer = setTimeout(() => { timer = undefined;void run(); }, Math.max(0, 4500 - (Date.now() - lastSent)));
            });
        } catch (error) { if (enabled) { status('error'); console.warn('Discord presence:', error); } }
        finally { busy = false; if (requested) { requested = false; void run(); } }
    };
    const changed = () => { revision++;if (timer) { clearTimeout(timer);timer = undefined; } void run(); };
    const configure = async () => {
        revision++;
        const current = ++configuration;
        enabled = useSettingsStore.getState().discordRichPresenceEnabled;
        configured = false;lastSignature = '';lastSent = 0;
        if (timer) { clearTimeout(timer);timer = undefined; }
        await discordTransport.disconnect();
        if (configuration !== current) return;
        if (!enabled) { status('disabled');return; }
        const result = await discordTransport.configure(DISCORD_APPLICATION_ID);
        if (configuration !== current || !enabled) return;
        status(result);configured = result === 'connected' || result === 'waiting_for_discord';
        if (configured) void run();
    };
    useSettingsStore.subscribe((next, previous) => {
        if (next.discordRichPresenceEnabled !== previous.discordRichPresenceEnabled) void configure().catch(() => status('error'));
    });
    usePlayerStore.subscribe((next, previous) => {
        if (next.activeTrack?.id !== previous.activeTrack?.id || next.playbackSpeed !== previous.playbackSpeed) changed();
    });
    TrackPlayer.addEventListener(Event.PlaybackState, changed);
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, () => { void run(); });
    void configure().catch(() => status('error'));
}
