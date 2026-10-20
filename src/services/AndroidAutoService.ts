import { Platform } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import { requireNativeModule } from 'expo-modules-core';
import { AndroidAutoCatalog, autoTracks } from './AndroidAutoCatalog';
import { splitAutoId } from '../utils/androidAuto';
import { ensurePlaybackReady } from './playerBootstrap';
import { usePlayerStore } from '../store/usePlayerStore';
import { useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { useCastStore } from '../store/useCastStore';
import { MultipleQueuesService } from './MultipleQueuesService';
import { QueueActionsService } from './QueueActionsService';
import { readPlaybackSnapshot } from './playbackSnapshot';
import i18n from '../constants/i18n';
import { database } from '../database';

interface AutoRequest { id: string; kind: string; mediaId?: string; query?: string; index?: number; position?: number; extras?: Record<string, string>; }
let started = false;
let commands = Promise.resolve();

function checkTransport() {
    const cast = useCastStore.getState();
    if (cast.isServerRunning || cast.isLocalCastActive || cast.isChromecastConnected) throw new Error(i18n.t('android_auto.cast_active'));
    if (useMultipleQueuesStore.getState().isSwitching || usePlayerStore.getState().isSyncingLyrics) throw new Error(i18n.t('android_auto.busy'));
}

async function prepare(request: AutoRequest, assertPending: () => Promise<void>) {
    checkTransport();
    await QueueActionsService.waitForPendingActions();
    await assertPending();
    checkTransport();
    const queueId = useMultipleQueuesStore.getState().activeId;
    let id = request.mediaId || 'continue';
    if (request.query || ['title', 'album', 'artist', 'playlist', 'genre'].some(key => request.extras?.[`android.intent.extra.${key}`])) {
        const results = await AndroidAutoCatalog.search(request.query || '', request.extras);
        if (!results.length) throw new Error(i18n.t('android_auto.no_results'));
        id = results[0].id;
    }
    const [kind, value] = splitAutoId(id);
    if (kind === 'queue') {
        await assertPending();
        await MultipleQueuesService.switchQueue(Number(value));
        return { suppressPlay: true };
    }
    if (id !== 'continue' && !['entry', 'track', 'album', 'artist', 'playlist', 'tag', 'smart', 'folder', 'genre'].includes(kind)) {
        const saved = await readPlaybackSnapshot();
        const savedIndex = saved.queue.findIndex(track => String(track.id) === id);
        if (savedIndex >= 0) {
            await assertPending();
            checkTransport();
            usePlayerStore.setState({ isPreparingExternal: true });
            await (TrackPlayer.pause as (bypassFade?: boolean) => Promise<void>)(true);
            await TrackPlayer.skip(savedIndex, Math.max(0, request.position || 0));
            return {};
        }
    }
    if (id !== 'continue') {
        let parent = id, trackId: string | undefined, instance: string | undefined;
        if (kind === 'entry') [parent, trackId, instance] = JSON.parse(value);
        const context = await autoTracks(parent);
        const index = trackId ? context.tracks.findIndex((track, offset) => track.id === trackId && (!instance || context.instances?.[offset] === instance)) : 0;
        if (index < 0 || !context.tracks.length) throw new Error(i18n.t('android_auto.no_results'));
        await assertPending();
        checkTransport();
        if (useMultipleQueuesStore.getState().activeId !== queueId) throw new Error(i18n.t('android_auto.busy'));
        await usePlayerStore.getState().loadQueue(context.tracks, index, parent, context.instances, false);
        if ((request.position ?? 0) > 0) await TrackPlayer.seekTo(request.position!);
    }
    if (!await TrackPlayer.getActiveTrack()) throw new Error(i18n.t('android_auto.empty_queue'));
    if (id !== 'continue') await usePlayerStore.getState().savePlaybackState();
    return {};
}

export async function handleAutoRequest(request: AutoRequest, assertPending: () => Promise<void> = async () => {}) {
    await ensurePlaybackReady();
    if (request.kind === 'children') return { items: await AndroidAutoCatalog.children(request.mediaId || 'root') };
    if (request.kind === 'search') return { items: await AndroidAutoCatalog.search(request.query || '', request.extras) };
    if (request.kind === 'item') {
        const item = await AndroidAutoCatalog.item(request.mediaId || '');
        if (item) return { items: [item] };
        const snapshot = await readPlaybackSnapshot();
        const queued = snapshot.queue.find(track => String(track.id) === request.mediaId);
        return { items: queued ? [{ id: String(queued.id), title: queued.title || '', subtitle: queued.artist, playable: true }] : [] };
    }
    checkTransport();
    await assertPending();
    if (request.kind === 'select') {
        const snapshot = await readPlaybackSnapshot();
        const track = request.mediaId ? snapshot.queue.find(track => String(track.id) === request.mediaId) : snapshot.queue[request.index ?? -1];
        if (!track) throw new Error(i18n.t('android_auto.no_results'));
        await QueueActionsService.play(track);
        if ((request.position ?? 0) > 0) await TrackPlayer.seekTo(request.position!);
        return {};
    }
    if (request.kind === 'shuffle') { await usePlayerStore.getState().toggleShuffle(); return {}; }
    if (request.kind === 'repeat') {
        await TrackPlayer.setRepeatMode(((await TrackPlayer.getRepeatMode()) + 1) % 3);
        await usePlayerStore.getState().updateQueueStatus();
        await usePlayerStore.getState().savePlaybackState();
        return {};
    }
    if (request.kind !== 'prepare') throw new Error('Unknown Android Auto command');
    const result = await prepare(request, assertPending);
    // Native already owns this queue: avoid copying thousands of entries across the bridge to resume.
    return { ...result, nativeSnapshot: true };
}

export function startAndroidAutoService() {
    if (Platform.OS !== 'android' || started) return;
    started = true;
    const native = requireNativeModule('NativeEqualizer');
    native.addListener('androidAutoRequest', (request: AutoRequest) => {
        const execute = async () => {
            // A timed-out request must never start playback later when initialization finally completes.
            try {
                await ensurePlaybackReady();
                if (!await native.isAndroidAutoRequestPending(request.id)) return;
                const result = await handleAutoRequest(request, async () => {
                    if (!await native.isAndroidAutoRequestPending(request.id)) throw new Error('Android Auto request expired');
                });
                await native.completeAndroidAutoRequest(request.id, JSON.stringify(result));
            } catch (error) {
                await native.completeAndroidAutoRequest(request.id, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
            }
        };
        if (['children', 'search', 'item'].includes(request.kind)) void execute();
        else { commands = commands.then(execute, execute); }
    });
    let lastState = '';
    let stateRevision = 0;
    const publishState = async () => {
        const revision = ++stateRevision;
        const repeat = await TrackPlayer.getRepeatMode();
        if (revision !== stateRevision) return;
        const cast = useCastStore.getState();
        const state = { shuffle: usePlayerStore.getState().isShuffleEnabled, repeat,
            casting: cast.isServerRunning || cast.isLocalCastActive || cast.isChromecastConnected,
            shuffleLabel: i18n.t('android_auto.shuffle'), repeatLabel: i18n.t('android_auto.repeat') };
        const json = JSON.stringify(state);
        if (json !== lastState) { await native.updateAndroidAutoState(json); lastState = json; }
    };
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
        if (refresh) clearTimeout(refresh);
        refresh = setTimeout(() => { void native.invalidateAndroidAuto().catch(console.error); }, 500);
    };
    database.withChangesForTables(['tracks', 'albums', 'artists', 'playlists', 'playlist_tracks', 'tags', 'track_tags', 'album_tags']).subscribe(invalidate);
    useMultipleQueuesStore.subscribe((state, previous) => {
        if (state.activeId !== previous.activeId || state.slots.some((slot, index) => slot.name !== previous.slots[index]?.name)) invalidate();
    });
    usePlayerStore.subscribe((state, previous) => {
        if (state.queueVersion !== previous.queueVersion || state.isShuffleEnabled !== previous.isShuffleEnabled) {
            invalidate(); void publishState().catch(console.error);
        }
    });
    useCastStore.subscribe((state, previous) => {
        if (state.isServerRunning !== previous.isServerRunning || state.isLocalCastActive !== previous.isLocalCastActive || state.isChromecastConnected !== previous.isChromecastConnected) {
            void publishState().catch(console.error);
        }
    });
    i18n.on('languageChanged', () => { invalidate(); void publishState().catch(console.error); });
    void native.startAndroidAutoBridge().then(() => ensurePlaybackReady()).then(publishState).catch(console.error);
}
