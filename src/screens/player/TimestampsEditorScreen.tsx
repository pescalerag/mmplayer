import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import TrackPlayer, { State } from 'react-native-track-player';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useTimestampStore } from '../../store/useTimestampStore';
import { TimestampService } from '../../services/TimestampService';
import { formatTimestampInput, normalizeSkipSegments, parseSkipConfig, parseTimestampInput, SkipSegment } from '../../utils/trackTimestamps';
import { TimestampPlaybackTimeline } from '../../components/player/TimestampPlaybackTimeline';

let segmentSequence = 0;

export default function TimestampsEditorScreen() {
    const { trackId } = useRoute<any>().params as { trackId: string };
    const navigation = useNavigation<any>();
    const { t } = useTranslation();
    const { colors, fonts, fontWeights } = useAppTheme({ ignoreTheme: true });
    const insets = useSafeAreaInsets();
    const [track, setTrack] = useState<Track | null>(null);
    const [segments, setSegments] = useState<SkipSegment[]>([]);
    const [enabled, setEnabled] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [start, setStart] = useState('0:00.000');
    const [end, setEnd] = useState('0:00.000');
    const [dirty, setDirty] = useState(false);
    const [draftDirty, setDraftDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [previewEnd, setPreviewEnd] = useState<number | null>(null);
    const allowLeave = useRef(false);
    const previewStarted = useRef(0);
    const currentPosition = useRef(0);
    const transportBusy = useRef(false);
    const activeId = usePlayerStore(state => state.activeTrack?.id);
    const playback = usePlaybackState();
    const duration = track?.duration || 0;
    const durationMs = Math.round(duration * 1000);

    useEffect(() => {
        let mounted = true;
        useTimestampStore.setState({ previewTrackId: trackId });
        void database.get<Track>('tracks').find(trackId).then(record => {
            if (!mounted) return;
            const config = parseSkipConfig(record.skipSegments);
            setTrack(record); setEnabled(config.enabled); setSegments(config.segments);
        }).catch(() => { if (mounted) { Alert.alert(t('common.error'), t('timestamps.load_error')); navigation.goBack(); } });
        return () => { mounted = false; useTimestampStore.setState({ previewTrackId: null, previewConfig: null }); };
    }, [trackId, navigation, t]);

    useEffect(() => navigation.addListener('beforeRemove', (event: any) => {
        if (!dirty || allowLeave.current) return;
        event.preventDefault();
        Alert.alert(t('timestamps.unsaved_title'), t('timestamps.unsaved_message'), [
            { text: t('actions.cancel'), style: 'cancel' },
            { text: t('timestamps.discard'), style: 'destructive', onPress: () => {
                allowLeave.current = true; navigation.dispatch(event.data.action);
            } },
        ]);
    }), [dirty, navigation, t]);

    const endPreview = useCallback(() => {
        setPreviewEnd(null);
        useTimestampStore.setState({ previewConfig: null });
    }, []);
    const updatePosition = useCallback((position: number) => { currentPosition.current = position; }, []);

    const showError = (error: unknown) => {
        const key = error instanceof Error ? error.message : 'range';
        Alert.alert(t('common.error'), t(`timestamps.${['duration', 'whole_song', 'ab_range'].includes(key) ? key : 'range'}`));
    };
    const draftSegments = () => {
        const startMs = parseTimestampInput(start), endMs = parseTimestampInput(end);
        if (startMs === null || endMs === null) throw new Error('range');
        const id = editingId || `segment-${Date.now()}-${++segmentSequence}`;
        return normalizeSkipSegments([...segments.filter(item => item.id !== editingId), { id, startMs, endMs }], durationMs);
    };
    const commitInterval = () => {
        try {
            setSegments(draftSegments());
            setDirty(true); setDraftDirty(false); setEditingId(null); setStart('0:00.000'); setEnd('0:00.000');
        } catch (error) { showError(error); }
    };
    const save = async () => {
        if (!track || saving) return;
        setSaving(true);
        try {
            await TimestampService.save(track, { enabled, segments: draftDirty ? draftSegments() : segments });
            allowLeave.current = true; navigation.goBack();
        } catch (error) { showError(error); }
        finally { setSaving(false); }
    };
    const togglePlayback = async () => {
        if (!track || transportBusy.current) return;
        transportBusy.current = true;
        const needsTrack = activeId !== trackId;
        if (needsTrack) setPreparing(true);
        try {
            if (!needsTrack && (playback.state === State.Playing || playback.state === State.Buffering)) {
                await (TrackPlayer.pause as (bypassFade?: boolean) => Promise<void>)(true);
            }
            else {
                if (needsTrack) await TimestampService.prepareEditorTrack(track);
                await (TrackPlayer.play as (bypassFade?: boolean) => Promise<void>)(true);
            }
        } catch { Alert.alert(t('common.error'), t('timestamps.playback_error')); }
        finally { transportBusy.current = false; if (needsTrack) setPreparing(false); }
    };
    const seek = useCallback(async (value: number) => {
        if (!track || transportBusy.current) return;
        transportBusy.current = true;
        const needsTrack = activeId !== trackId;
        if (needsTrack) setPreparing(true);
        try {
            endPreview();
            if (needsTrack) await TimestampService.prepareEditorTrack(track);
            await TrackPlayer.seekTo(value);
        }
        catch { Alert.alert(t('common.error'), t('timestamps.playback_error')); }
        finally { transportBusy.current = false; if (needsTrack) setPreparing(false); }
    }, [track, activeId, trackId, endPreview, t]);
    const preview = async (segment: SkipSegment) => {
        if (!track || transportBusy.current) return;
        transportBusy.current = true;
        const needsTrack = activeId !== trackId;
        if (needsTrack) setPreparing(true);
        try {
            if (needsTrack) await TimestampService.prepareEditorTrack(track);
            useTimestampStore.setState({ previewConfig: { enabled: true, segments } });
            await TimestampService.seekAutomatically(Math.max(0, segment.startMs / 1000 - 2));
            previewStarted.current = Date.now();
            setPreviewEnd(Math.min(duration, segment.endMs / 1000 + 2));
            await (TrackPlayer.play as (bypassFade?: boolean) => Promise<void>)(true);
        } catch { Alert.alert(t('common.error'), t('timestamps.playback_error')); }
        finally { transportBusy.current = false; if (needsTrack) setPreparing(false); }
    };
    const label = { color: colors.text, fontFamily: fonts.regular };
    return <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.overlayAlpha10 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton} accessibilityLabel={t('actions.back')}>
                <Ionicons name="chevron-back" size={24} color={colors.accent} />
            </TouchableOpacity>
            <Text style={[label, styles.title, { fontWeight: fontWeights.bold }]}>{t('timestamps.title')}</Text>
            <TouchableOpacity onPress={() => void save()} disabled={!track || saving} style={styles.headerButton}>
                <Text style={{ color: colors.accent, fontFamily: fonts.regular }}>{t('actions.save')}</Text>
            </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
            <Text style={[label, styles.song]}>{track?.title || ''}</Text>
            <View style={[styles.card, { backgroundColor: colors.overlayAlpha05, borderColor: colors.overlayAlpha10 }]}>
                <Ionicons name="information-circle-outline" size={22} color={colors.accentLight} />
                <Text style={[styles.description, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('timestamps.instructions')}</Text>
            </View>
            <View style={styles.row}>
                <Text style={[label, { flex: 1 }]}>{t('timestamps.enabled')}</Text>
                <Switch value={enabled} onValueChange={value => { setEnabled(value); setDirty(true); }} trackColor={{ false: '#282828', true: colors.accent }} thumbColor={enabled ? '#FFFFFF' : '#888888'} />
            </View>
            {segments.length === 0 && <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('timestamps.empty')}</Text>}
            {segments.map(segment => <View key={segment.id} style={[styles.card, { borderColor: colors.overlayAlpha10, backgroundColor: colors.overlayAlpha05 }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => {
                    setEditingId(segment.id); setDraftDirty(false); setStart(formatTimestampInput(segment.startMs)); setEnd(formatTimestampInput(segment.endMs));
                }} accessibilityLabel={t('timestamps.edit')}>
                    <Text style={label}>{formatTimestampInput(segment.startMs)} → {formatTimestampInput(segment.endMs)}</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={preparing} onPress={() => void preview(segment)} accessibilityLabel={t('timestamps.preview')}>
                    <Ionicons name="play-circle-outline" size={26} color={colors.accentLight} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setSegments(segments.filter(item => item.id !== segment.id)); setDirty(true); }} accessibilityLabel={t('timestamps.delete')}>
                    <Ionicons name="trash-outline" size={22} color={colors.accentLight} />
                </TouchableOpacity>
            </View>)}
            <View style={[styles.editor, { backgroundColor: colors.overlayAlpha05, borderColor: colors.overlayAlpha10 }]}>
                {([{ text: start, set: setStart, key: 'from' }, { text: end, set: setEnd, key: 'to' }]).map(field => <View key={field.key} style={{ gap: 8 }}>
                    <View style={styles.row}>
                        <Text style={[label, { flex: 1 }]}>{t(`timestamps.${field.key}`)}</Text>
                        <TextInput value={field.text} onChangeText={value => { field.set(value); setDraftDirty(true); setDirty(true); }} accessibilityLabel={t(`timestamps.${field.key}`)}
                            keyboardType="numbers-and-punctuation" style={[label, styles.input, { borderColor: colors.overlayAlpha20 }]} />
                    </View>
                    <Slider value={(parseTimestampInput(field.text) ?? 0) / 1000} minimumValue={0} maximumValue={duration || 1}
                        step={0.1} disabled={!track || duration <= 0} minimumTrackTintColor={colors.accent} thumbTintColor={colors.text}
                        onValueChange={value => { field.set(formatTimestampInput(value * 1000)); setDraftDirty(true); setDirty(true); }} />
                    <TouchableOpacity disabled={activeId !== trackId} onPress={() => { field.set(formatTimestampInput(currentPosition.current * 1000)); setDraftDirty(true); setDirty(true); }}>
                        <Text style={{ color: activeId === trackId ? colors.accentLight : colors.textSecondary, fontFamily: fonts.regular }}>{t('timestamps.use_position')}</Text>
                    </TouchableOpacity>
                </View>)}
                <TouchableOpacity onPress={commitInterval} disabled={!track} style={[styles.primary, { backgroundColor: colors.accent }]}>
                    <Ionicons name="play-forward-outline" size={22} color="#FFFFFF" />
                    <Text style={[styles.primaryText, { fontFamily: fonts.regular }]}>{t(editingId ? 'timestamps.update' : 'timestamps.add')}</Text>
                </TouchableOpacity>
                {editingId && <TouchableOpacity onPress={() => { setEditingId(null); setDraftDirty(false); setStart('0:00.000'); setEnd('0:00.000'); }}>
                    <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('actions.cancel')}</Text>
                </TouchableOpacity>}
            </View>
        </ScrollView>
        <View style={[styles.controls, { paddingBottom: insets.bottom + 16, backgroundColor: colors.cardBackground, borderColor: colors.overlayAlpha10 }]}>
            <TimestampPlaybackTimeline trackId={trackId} duration={duration} segments={segments} disabled={!track || preparing}
                onSeek={seek} onPosition={updatePosition} previewEnd={previewEnd} previewStarted={previewStarted} onPreviewEnd={endPreview} />
            <TouchableOpacity onPress={() => void togglePlayback()} disabled={!track || preparing} accessibilityLabel={t('timestamps.play_pause')}
                style={[styles.play, { backgroundColor: colors.accent, opacity: preparing ? 0.5 : 1 }]}>
                <Ionicons name={activeId === trackId && playback.state === State.Playing ? 'pause' : 'play'} size={24} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
    headerButton: { padding: 8, minWidth: 54 }, title: { flex: 1, fontSize: 18, textAlign: 'center' }, song: { fontSize: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    card: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1 }, description: { flex: 1, lineHeight: 21 },
    editor: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 20 }, input: { borderWidth: 1, borderRadius: 8, padding: 10, minWidth: 120, textAlign: 'center' },
    primary: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14 }, primaryText: { color: '#FFFFFF' },
    controls: { padding: 20, borderTopWidth: 1 }, play: { width: 50, height: 50, borderRadius: 25, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
