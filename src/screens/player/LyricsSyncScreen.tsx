import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    Alert
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import TrackPlayer, { State, useProgress } from 'react-native-track-player';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from "@/hooks/useAppTheme";
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import { LyricsService } from '../../services/LyricsService';
import { formatTrackTime } from '../../utils/time';

import { useLyricsDocument } from '../../hooks/useLyricsDocument';
import { useUnsavedDocument } from '../../hooks/useUnsavedDocument';
import { PlayerStackParamList } from '../../navigation/types';
import Track from '../../database/models/Track';
import { InvisibleScreenContent } from '../../components/layouts/InvisibleScreenContent';

interface SyncLine {
    text: string;
    time: number | null;
}

// Offset applied to compensate for human reaction time when tapping "Next phrase"
const REACTION_OFFSET_MS = 0.20; // 200ms

const formatLRCTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    // Use Math.round + 3 decimal digits for maximum LRC precision
    const ms = Math.round((seconds % 1) * 1000);

    const minsStr = mins.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');
    // LRC standard allows 2–3 decimal digits; we use 2 (hundredths) for compatibility
    const msStr = Math.min(ms, 999).toString().padStart(3, '0').slice(0, 2);

    return `[${minsStr}:${secsStr}.${msStr}]`;
};

const SyncLyricRow = React.memo(({
    text,
    time,
    index,
    currentIndex,
    colors,
    fonts,
    fontWeights
}: {
    text: string;
    time: number | null;
    index: number;
    currentIndex: number;
    colors: any;
    fonts: any;
    fontWeights: any;
}) => {
    const isPassed = index < currentIndex;
    const isActive = index === currentIndex;
    const isUpcoming = index > currentIndex;

    let textColor = colors.textSecondary;
    let fontSize = 16;
    let fontWeight = fontWeights.bold;

    if (isActive) {
        textColor = colors.accentLight;
        fontSize = 20;
    } else if (isPassed) {
        textColor = colors.text;
    } else if (isUpcoming) {
        textColor = 'rgba(255,255,255,0.25)';
    }

    return (
        <View style={[styles.lyricRow, { borderBottomColor: colors.overlayAlpha05 }]}>
            <View style={styles.lyricTextContainer}>
                <Text style={{
                    color: textColor,
                    fontSize,
                    fontFamily: fonts.regular,
                    fontWeight,
                    lineHeight: 28,
                    textAlign: 'center'
                }}>
                    {text}
                </Text>
            </View>
            {time !== null && (
                <Text style={[styles.timeLabel, { color: colors.accent, fontFamily: fonts.regular }]}>
                    {formatTrackTime(time)}
                </Text>
            )}
        </View>
    );
});
SyncLyricRow.displayName = 'SyncLyricRow';

const SyncInstructions = React.memo(({ colors, fonts, t }: { colors: any; fonts: any; t: any }) => {
    return (
        <View style={[styles.instructionCard, { backgroundColor: colors.overlayAlpha05, borderColor: colors.overlayAlpha10 }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.accentLight} />
            <Text style={[styles.instructionText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
                {t('lyrics.sync_instructions')}
            </Text>
        </View>
    );
});
SyncInstructions.displayName = 'SyncInstructions';

export default function LyricsSyncScreen() {
    const { trackId } = useRoute<RouteProp<PlayerStackParamList, 'LyricsSync'>>().params;
    const { document, missing } = useLyricsDocument(trackId);
    const navigation = useNavigation();
    const { t } = useTranslation();
    if (!document) return <InvisibleScreenContent ready={missing}>{missing && <TouchableOpacity style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => navigation.goBack()}><Text style={{ color: '#FFFFFF', textAlign: 'center' }}>{t('timestamps.load_error')}</Text></TouchableOpacity>}</InvisibleScreenContent>;
    return <LyricsSyncDocument key={trackId} track={document.track} initialLyrics={document.text} />;
}

function LyricsSyncDocument({ track, initialLyrics }: { track: Track; initialLyrics: string }) {
    const { colors, fonts, fontWeights } = useAppTheme({ ignoreTheme: true });
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { t } = useTranslation();

    const activeId = usePlayerStore(state => state.activeTrack?.id);
    const canControl = activeId === track.id;
    const playbackState = usePlaybackState();
    const { position, duration } = useProgress(50);
    const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;

    // Keep a ref always pointing to the latest position so handleNextPhrase
    // can read it synchronously (0ms bridge latency) instead of awaiting
    // the native getProgress() call which has variable latency (10–80ms).
    const positionRef = useRef(0);
    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    // Auto-pause when song is about to end to prevent skipping to next track.
    // Use a small threshold (0.15s) instead of 0.4s to avoid prematurely
    // cutting audio on songs that have vocals until the very last second.
    useEffect(() => {
        if (canControl && duration > 0 && position >= duration - 0.15 && isPlaying) {
            TrackPlayer.pause();
        }
    }, [position, duration, isPlaying, canControl]);

    // Suspend automatic skips only while controlling the document's song.
    useEffect(() => {
        usePlayerStore.getState().setIsSyncingLyrics(canControl);
        return () => {
            usePlayerStore.getState().setIsSyncingLyrics(false);
        };
    }, [canControl]);

    // References
    const flatListRef = useRef<FlatList>(null);

    // Initial Lyrics parsing
    const originalLrcText = initialLyrics;

    // Split headers from actual lyric lines
    const { headers, initialSyncLines } = useMemo(() => {
        const lines = originalLrcText ? originalLrcText.split(/\r?\n/) : [];
        const timeRegex = /^\[\d{2}:\d{2}(?:\.\d{2,3})?\]/;
        const headerRegex = /^\[[a-zA-Z]+:.*\]/;

        const headersList: string[] = [];
        const syncList: SyncLine[] = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            if (trimmed.match(headerRegex) && !trimmed.match(timeRegex)) {
                headersList.push(trimmed);
            } else {
                // Strip existing timestamp if any
                // Remove ALL chained LRC timestamps (e.g. [01:10.00][02:20.00]text)
                // The ^ anchor is intentionally removed so the global flag strips every tag.
                const cleanText = trimmed.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
                if (!cleanText) return;
                
                syncList.push({
                    text: cleanText,
                    time: null
                });
            }
        });

        return { headers: headersList, initialSyncLines: syncList };
    }, [originalLrcText]);

    const [syncLines, setSyncLines] = useState<SyncLine[]>(initialSyncLines);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useUnsavedDocument(hasUnsavedChanges);

    // Synchronize play/pause
    const togglePlayback = async () => {
        if (usePlayerStore.getState().activeTrack?.id !== track.id) return;
        if (isPlaying) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    };

    // Record timestamp for current line and advance.
    // positionRef.current holds the latest position from useProgress and is
    // read synchronously (no async round-trip), giving consistent latency
    // across all taps. We then subtract the reaction-time offset.
    const handleNextPhrase = () => {
        if (usePlayerStore.getState().activeTrack?.id !== track.id || currentIndex >= syncLines.length) return;

        // Synchronous read — no bridge latency, no variability
        const compensated = Math.max(0, positionRef.current - REACTION_OFFSET_MS);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const updated = [...syncLines];
        updated[currentIndex] = {
            ...updated[currentIndex],
            time: compensated
        };

        setSyncLines(updated);
        setHasUnsavedChanges(true);

        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);

        // Scroll list to center next phrase
        if (nextIdx < updated.length) {
            flatListRef.current?.scrollToIndex({
                index: nextIdx,
                viewPosition: 0.3,
                animated: true
            });
        }
    };

    // Revert last recorded timestamp
    const handleUndo = () => {
        if (currentIndex === 0) return;
        const prevIdx = currentIndex - 1;
        const updated = [...syncLines];
        updated[prevIdx] = {
            ...updated[prevIdx],
            time: null
        };
        setSyncLines(updated);
        setCurrentIndex(prevIdx);

        flatListRef.current?.scrollToIndex({
            index: prevIdx,
            viewPosition: 0.3,
            animated: true
        });
    };

    // Restart all timestamps
    const handleReset = () => {
        Alert.alert(
            t('actions.warning') || 'Atención',
            t('lyrics.reset_confirm') || '¿Estás seguro de que quieres borrar todos los tiempos y empezar de nuevo?',
            [
                { text: t('actions.cancel') || 'Cancelar', style: 'cancel' },
                {
                    text: t('actions.confirm') || 'Confirmar',
                    style: 'destructive',
                    onPress: () => {
                        const reseted = syncLines.map(l => ({ ...l, time: null }));
                        setSyncLines(reseted);
                        setCurrentIndex(0);
                        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                    }
                }
            ]
        );
    };

    const handleSave = async () => {
        if (track._raw._status === 'deleted') return;
        try {
            const finalLines: string[] = [...headers];
            syncLines.forEach(line => {
                if (line.time !== null) {
                    finalLines.push(`${formatLRCTimestamp(line.time)}${line.text}`);
                } else {
                    finalLines.push(line.text);
                }
            });

            await LyricsService.saveLyrics(track, finalLines.join('\n'));
            setHasUnsavedChanges(false);
            Alert.alert(t('actions.success') || 'Éxito', t('lyrics.sync_save_success') || 'Tiempos sincronizados correctamente.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (e) {
            console.error('Error saving synced lyrics:', e);
            Alert.alert(t('actions.error') || 'Error', t('lyrics.save_error') || 'No se pudieron guardar los cambios.');
        }
    };

    const handleBack = () => navigation.goBack();

    // Auto-scroll safety key extractor/index tracker
    const renderItem = useCallback(({ item, index }: { item: SyncLine; index: number }) => {
        return (
            <SyncLyricRow
                text={item.text}
                time={item.time}
                index={index}
                currentIndex={currentIndex}
                colors={colors}
                fonts={fonts}
                fontWeights={fontWeights}
            />
        );
    }, [currentIndex, colors, fonts, fontWeights]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.overlayAlpha10 }]}>
                <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.accent} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.regular, fontWeight: fontWeights.bold }]}>
                    {t('lyrics.sync_title') || 'Sincronizar letras'}
                </Text>
                <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                    <Text style={[styles.saveText, { color: colors.accent, fontFamily: fonts.regular, fontWeight: fontWeights.bold }]}>
                        {t('actions.save') || 'Guardar'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Lyrics List */}
            <FlatList
                ref={flatListRef}
                data={syncLines}
                renderItem={renderItem}
                keyExtractor={(_, index) => index.toString()}
                ListHeaderComponent={<SyncInstructions colors={colors} fonts={fonts} t={t} />}
                contentContainerStyle={{
                    paddingTop: 20,
                    paddingHorizontal: 24,
                    paddingBottom: 240
                }}
                showsVerticalScrollIndicator={false}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({
                            index: info.index,
                            animated: true,
                            viewPosition: 0.3
                        });
                    }, 100);
                }}
            />

            {/* Bottom Controls Panel */}
            <View style={[styles.controlsCard, {
                backgroundColor: 'rgba(25, 25, 25, 0.95)',
                borderTopColor: colors.overlayAlpha10,
                paddingBottom: insets.bottom + 16
            }]}>
                {!canControl && <Text style={{ color: colors.text, textAlign: 'center' }}>{t('lyrics.sync_different_track')}</Text>}
                {/* Slider bar */}
                <View style={styles.progressRow}>
                    <Text style={[styles.progressTime, { color: colors.textSecondary }]}>
                        {formatTrackTime(canControl ? position : 0)}
                    </Text>
                    <Slider
                        disabled={!canControl}
                        value={canControl ? position : 0}
                        minimumValue={0}
                        maximumValue={duration || 100}
                        onSlidingComplete={async (val) => {
                            if (usePlayerStore.getState().activeTrack?.id === track.id) await TrackPlayer.seekTo(val);
                        }}
                        style={styles.progressBar}
                        minimumTrackTintColor={colors.accent}
                        maximumTrackTintColor="#282828"
                        thumbTintColor="#FFFFFF"
                    />
                    <Text style={[styles.progressTime, { color: colors.textSecondary }]}>
                        {formatTrackTime(canControl ? duration : track.duration)}
                    </Text>
                </View>

                {/* Big Button Controls */}
                <View style={styles.actionsContainer}>
                    {/* Reset Button */}
                    <TouchableOpacity onPress={handleReset} style={[styles.secondaryActionBtn, { backgroundColor: colors.overlayAlpha10 }]}>
                        <Ionicons name="refresh-outline" size={22} color={colors.text} />
                    </TouchableOpacity>

                    {/* Giant Next Phrase Button */}
                    <TouchableOpacity
                        onPress={handleNextPhrase}
                        disabled={!canControl || currentIndex >= syncLines.length}
                        style={[styles.giantTapBtn, {
                            backgroundColor: colors.accent,
                            opacity: !canControl || currentIndex >= syncLines.length ? 0.4 : 1
                        }]}
                    >
                        <Ionicons name="play-forward" size={24} color="#FFFFFF" />
                        <Text style={[styles.giantTapLabel, { fontFamily: fonts.regular, fontWeight: fontWeights.bold }]}>
                            {t('lyrics.next_phrase') || 'Siguiente frase'}
                        </Text>
                    </TouchableOpacity>

                    {/* Undo Button */}
                    <TouchableOpacity
                        onPress={handleUndo}
                        disabled={currentIndex === 0}
                        style={[styles.secondaryActionBtn, {
                            backgroundColor: colors.overlayAlpha10,
                            opacity: currentIndex === 0 ? 0.4 : 1
                        }]}
                    >
                        <Ionicons name="arrow-undo-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Play/Pause controls overlay */}
                <View style={styles.playPauseRow}>
                    <TouchableOpacity disabled={!canControl} onPress={togglePlayback} style={[styles.playPauseBtn, { backgroundColor: colors.accent }]}>
                        <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    headerBtn: {
        padding: 6,
        minWidth: 60,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        textAlign: 'center',
    },
    saveText: {
        fontSize: 16,
        textAlign: 'right',
    },
    lyricRow: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 0.5,
    },
    lyricTextContainer: {
        minHeight: 40,
        justifyContent: 'center',
    },
    timeLabel: {
        fontSize: 11,
        marginTop: 4,
        opacity: 0.8,
    },
    controlsCard: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    progressBar: {
        flex: 1,
        height: 30,
        marginHorizontal: 8,
    },
    progressTime: {
        fontSize: 12,
        minWidth: 40,
        textAlign: 'center',
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    giantTapBtn: {
        flex: 1,
        height: 60,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    giantTapLabel: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    secondaryActionBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPauseRow: {
        alignItems: 'center',
        marginTop: 14,
    },
    playPauseBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    instructionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 20,
        gap: 10,
    },
    instructionText: {
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
    }
});
