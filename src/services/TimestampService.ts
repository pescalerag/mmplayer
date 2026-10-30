import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import TrackPlayer from 'react-native-track-player';
import { database } from '../database';
import Track from '../database/models/Track';
import { useTimestampStore } from '../store/useTimestampStore';
import { useABRepeatStore } from '../store/useABRepeatStore';
import { useCastStore } from '../store/useCastStore';
import { EMPTY_SKIP_CONFIG, hasAudibleABRange, normalizeSkipSegments, parseSkipConfig, SkipConfig } from '../utils/trackTimestamps';

let started = false;
let observedId: string | null = null;
let generation = 0;
let stopObserving: (() => void) | undefined;
let lastPolicy = '';

const native = () => Platform.OS === 'android' ? requireNativeModule('NativeEqualizer') : null;

export const TimestampService = {
    async initialize() {
        if (started) return;
        started = true;
        const { usePlayerStore } = await import('../store/usePlayerStore');
        const configure = () => {
            const state = useTimestampStore.getState();
            const cast = useCastStore.getState();
            const ab = useABRepeatStore.getState();
            const preview = state.previewTrackId === state.trackId;
            const config = preview ? state.previewConfig ?? { enabled: false, segments: [] } : state.config;
            const blocked = cast.isServerRunning || cast.isLocalCastActive || cast.isChromecastConnected
                || usePlayerStore.getState().isSyncingLyrics || (preview && !state.previewConfig);
            const policy = JSON.stringify({ trackId: state.trackId, config, blocked,
                pointA: preview ? -1 : ab.pointA ?? -1, pointB: preview ? -1 : ab.pointB ?? -1 });
            if (lastPolicy === policy) return;
            lastPolicy = policy;
            if (cast.isChromecastConnected && state.trackId) {
                void import('./ChromecastService').then(({ ChromecastService }) => ChromecastService.updateTimestamps(config, state.trackId!))
                    .catch(console.error);
            }
            void native()?.configureTimestamps?.(policy).catch((error: unknown) => {
                lastPolicy = ''; console.error('[Timestamps] Native configuration failed:', error);
            });
        };
        const observe = async (id: string | null) => {
            if (observedId === id) return;
            observedId = id;
            const revision = ++generation;
            stopObserving?.(); stopObserving = undefined;
            const track = usePlayerStore.getState().activeTrack;
            const config = track?.id === id ? parseSkipConfig(track?.skipSegments, (track?.duration || 0) * 1000) : EMPTY_SKIP_CONFIG;
            useTimestampStore.setState({ trackId: id, config });
            if (!id) return;
            const model = await database.get<Track>('tracks').find(id).catch(() => null);
            if (!model || revision !== generation) return;
            const subscription = model.observe().subscribe(record => {
                if (revision !== generation) return;
                const config = parseSkipConfig(record.skipSegments, record.duration * 1000);
                if (JSON.stringify(config) !== JSON.stringify(useTimestampStore.getState().config)) {
                    useTimestampStore.setState({ config });
                }
            });
            stopObserving = () => subscription.unsubscribe();
        };
        useTimestampStore.subscribe(configure);
        useABRepeatStore.subscribe(configure);
        useCastStore.subscribe(configure);
        usePlayerStore.subscribe((state, previous) => {
            if (state.activeTrack?.id !== previous.activeTrack?.id) void observe(state.activeTrack?.id ?? null);
            if (state.isSyncingLyrics !== previous.isSyncingLyrics) configure();
        });
        await observe(usePlayerStore.getState().activeTrack?.id ?? null);
        configure();
    },
    async save(track: Track, config: SkipConfig) {
        const segments = normalizeSkipSegments(config.segments, track.duration * 1000);
        const ab = useABRepeatStore.getState();
        if (useTimestampStore.getState().trackId === track.id && ab.pointA !== null && ab.pointB !== null
            && !hasAudibleABRange(ab.pointA, ab.pointB, { ...config, segments })) throw new Error('ab_range');
        await database.write(() => track.update(record => { record.skipSegments = JSON.stringify({ ...config, segments }); }));
        const { getQueueSession, useMultipleQueuesStore } = await import('../store/useMultipleQueuesStore');
        const queues = useMultipleQueuesStore.getState();
        for (const slot of queues.slots) {
            const session = getQueueSession(slot.id);
            if (!session) continue;
            const update = (item: import('react-native-track-player').Track) => String(item.id).split('-')[0] === track.id
                ? { ...item, skipSegments: track.skipSegments } : item;
            const queue = session.queue.map(update);
            const shuffleOriginalQueue = session.shuffleOriginalQueue.map(update);
            if (queue.some((item, index) => item !== session.queue[index]) || shuffleOriginalQueue.some((item, index) => item !== session.shuffleOriginalQueue[index])) {
                queues.saveSession(slot.id, { ...session, queue, shuffleOriginalQueue });
            }
        }
        const { usePlayerStore } = await import('../store/usePlayerStore');
        await usePlayerStore.getState().updateTrackMetadata(track.id);
    },
    async markSeek(position: number, automatic = false) { await native()?.markTimestampSeek?.(!automatic, position); },
    async finishSeek() { await native()?.finishTimestampSeek?.(); },
    async seekAutomatically(position: number) {
        await (TrackPlayer.seekTo as (position: number, automatic?: boolean) => Promise<void>)(position, true);
    },
    nativeHandlesAB() {
        const { trackId, config, previewTrackId } = useTimestampStore.getState();
        return Platform.OS === 'android' && trackId !== previewTrackId && config.enabled && config.segments.length > 0
            && typeof native()?.configureTimestamps === 'function';
    },
    async prepareEditorTrack(track: Track) {
        const active = await TrackPlayer.getActiveTrack();
        if (String(active?.id || '').split('-')[0] !== track.id) {
            const { usePlayerStore } = await import('../store/usePlayerStore');
            await usePlayerStore.getState().loadQueue([track], 0, `timestamps:${track.id}`, undefined, false);
        }
    },
};
