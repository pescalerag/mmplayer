import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Track from '../database/models/Track';
import Artist from '../database/models/Artist';
import { useLyricsSyncStore } from '../store/useLyricsSyncStore';

const INITIAL_DELAY_MS = 200;
const BACKOFF_INCREMENT_MS = 2000;
const RECOVERY_DECREMENT_MS = 100;
const PREFETCH_LOOKAHEAD = 3;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function resolveArtistName(track: Track): Promise<string> {
    try {
        const collaborators = (await track.queryCollaborators.fetch()) as Artist[];
        if (collaborators.length > 0) return collaborators[0].name;
        const primary = await (track.artist as any).fetch?.();
        return primary?.name ?? '';
    } catch {
        return '';
    }
}

async function fetchAndPersistLyrics(track: Track): Promise<'ok' | 'not_found' | 'rate_limited' | 'network_error'> {
    try {
        const title = encodeURIComponent(track.title);
        const artist = encodeURIComponent(await resolveArtistName(track));
        const url = `https://lrclib.net/api/get?track_name=${title}&artist_name=${artist}`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'MMPlayer V2.1.0 (https://github.com/pescalerag/mmplayer)' }
        });

        if (response.status === 429) return 'rate_limited';

        if (response.ok) {
            const data = await response.json();
            const foundLyrics: string | null = data.syncedLyrics || data.plainLyrics || null;
            await database.write(async () => {
                await track.update(t => {
                    if (foundLyrics) t.lyricsLRC = foundLyrics;
                    else t.lyricsFetchFailed = true;
                });
            });
            return foundLyrics ? 'ok' : 'not_found';
        }

        await database.write(async () => {
            await track.update(t => { t.lyricsFetchFailed = true; });
        });
        return 'not_found';

    } catch {
        return 'network_error';
    }
}

export const LyricsSyncService = {

    async startMassiveFetch(): Promise<void> {
        const store = useLyricsSyncStore.getState();
        if (store.isSyncing) return;

        try {
            const tracksToFetch = await database
                .get<Track>('tracks')
                .query(
                    Q.where('lyrics_lrc', null),
                    Q.or(
                        Q.where('lyrics_fetch_failed', false),
                        Q.where('lyrics_fetch_failed', null)
                    )
                )
                .fetch();

            if (tracksToFetch.length === 0) return;

            store.startSync(tracksToFetch.length);

            let dynamicDelay = INITIAL_DELAY_MS;
            let i = 0;

            while (i < tracksToFetch.length) {
                if (!useLyricsSyncStore.getState().isSyncing) break;

                const track = tracksToFetch[i];
                const result = await fetchAndPersistLyrics(track);

                if (result === 'rate_limited') {
                    dynamicDelay += BACKOFF_INCREMENT_MS;
                    await sleep(dynamicDelay);
                    continue;
                }

                if (result === 'ok') {
                    dynamicDelay = Math.max(INITIAL_DELAY_MS, dynamicDelay - RECOVERY_DECREMENT_MS);
                }

                store.updateProgress(i + 1);
                await sleep(dynamicDelay);
                i++;
            }

        } catch (error) {
            console.error('[LyricsSyncService] Error crítico:', error);
        } finally {
            useLyricsSyncStore.getState().stopSync();
        }
    },

    async prefetchForQueue(currentIndex: number, queueIds: string[]): Promise<void> {
        const slice = queueIds.slice(currentIndex, currentIndex + PREFETCH_LOOKAHEAD);
        for (const rawId of slice) {
            try {
                const cleanId = rawId.toString().split('-')[0];
                const track = await database.get<Track>('tracks').find(cleanId);
                if (!track.lyricsLRC && !track.lyricsFetchFailed) {
                    await fetchAndPersistLyrics(track);
                }
            } catch { }
        }
    },

    cancelSync(): void {
        useLyricsSyncStore.getState().stopSync();
    },
};
