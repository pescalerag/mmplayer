import { openLyricsMenu } from '@/store/useUIStore';
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import Artist from '../../database/models/Artist';
import Track from '../../database/models/Track';
import { useSyncedLyrics } from '../../hooks/useSyncedLyrics';
import { LyricsService } from '../../services/LyricsService';

import { usePlayerStore } from '../../store/usePlayerStore';

interface LyricsViewUIProps {
    track: Track;
    artist: Artist;
    artists: Artist[];
    isVisible: boolean;
    setVisible: (visible: boolean) => void;
}

const LyricsViewUI = ({ track, artist, artists, isVisible, setVisible }: LyricsViewUIProps) => {
    const { colors, fonts } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts), [colors, fonts]);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    const flatListRef = useRef<FlatList>(null);
    const progress = useProgress();
    const currentTime = progress.position;

    const { parsedLyrics, activeIndex, isLoading, isSynced, lyricsText } = useSyncedLyrics(track, currentTime);

    // Resolve artist name from observed models
    const artistName = useMemo(() => {
        if (artists && artists.length > 0) {
            return artists.map(a => a.name).join(', ');
        }
        return artist?.name || '';
    }, [artist, artists]);

    const isInitialScrollRef = useRef(true);

    useEffect(() => {
        isInitialScrollRef.current = true;
    }, [track.id]);

    // Auto-Scroll to active lyric line in FlatList
    useEffect(() => {
        if (isSynced && activeIndex !== -1 && flatListRef.current) {
            const isInitial = isInitialScrollRef.current;
            flatListRef.current.scrollToIndex({
                index: activeIndex,
                viewPosition: 0.3, // Centers the line in the top-middle third
                animated: !isInitial,
            });
            if (isInitial) {
                isInitialScrollRef.current = false;
            }
        }
    }, [activeIndex, isSynced]);

    const handleImportLRC = async () => {
        try {
            const importedContent = await LyricsService.importCustomLyrics(track);
            if (importedContent) {
                Alert.alert(t('actions.success') || 'Éxito', 'Letras importadas correctamente.');
            }
        } catch (error) {
            console.error("[LyricsView] Import failed:", error);
            Alert.alert(t('actions.error') || 'Error', 'No se pudo leer el archivo de letras.');
        }
    };

    const renderBodyContent = () => {
        if (isLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>{t('audio_effects.lyrics_searching') || 'Buscando letras...'}</Text>
                </View>
            );
        }

        if (!lyricsText) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 16 }} />
                    <Text style={styles.emptyText}>{t('audio_effects.lyrics_not_found') || 'No se encontraron letras'}</Text>
                    <TouchableOpacity
                        onPress={handleImportLRC}
                        style={styles.importButton}
                    >
                        <Text style={styles.importButtonText}>{t('audio_effects.lyrics_import') || 'Importar archivo .LRC'}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (isSynced) {
            return (
                /* Synced Lyrics List */
                <FlatList
                    ref={flatListRef}
                    data={parsedLyrics}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item, index }) => {
                        const isActive = index === activeIndex;
                        return (
                            <TouchableOpacity
                                onPress={() => TrackPlayer.seekTo(item.time)}
                                activeOpacity={0.7}
                                style={styles.lyricLineContainer}
                            >
                                <Text style={[
                                    styles.lyricText,
                                    isActive ? styles.lyricTextActive : styles.lyricTextInactive
                                ]}>
                                    {item.text}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                    contentContainerStyle={[
                        styles.lyricsListContent,
                        { paddingBottom: insets.bottom + 100 }
                    ]}
                    getItemLayout={(data, index) => (
                        { length: 70, offset: 70 * index, index }
                    )}
                    onScrollToIndexFailed={(info) => {
                        flatListRef.current?.scrollToOffset({
                            offset: info.highestMeasuredFrameIndex * 70,
                            animated: false
                        });
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                />
            );
        }

        return (
            /* Plain Text Lyrics Fallback */
            <ScrollView
                contentContainerStyle={[
                    styles.plainTextContainer,
                    { paddingBottom: insets.bottom + 40 }
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.plainLyricsText}>{lyricsText}</Text>
            </ScrollView>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={false}
            visible={isVisible}
            onRequestClose={() => setVisible(false)}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => setVisible(false)}
                        style={styles.closeButton}
                    >
                        <Ionicons name="chevron-down" size={28} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleContainer}>
                        <Text numberOfLines={1} style={styles.headerTrackTitle}>{track.title}</Text>
                        <Text numberOfLines={1} style={styles.headerTrackArtist}>{artistName}</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => openLyricsMenu(track, () => { })}
                        style={styles.menuButton}
                    >
                        <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Body Content */}
                {renderBodyContent()}
            </View>
        </Modal>
    );
};

const ObservableLyricsViewUI = withObservables(['trackModel'], ({ trackModel }) => ({
    track: trackModel.observe(),
    artist: trackModel.artist.observe(),
    artists: trackModel.queryCollaborators.observe(),
}))(LyricsViewUI);

export default function LyricsView() {
    const isVisible = usePlayerStore(state => state.isLyricsVisible);
    const setVisible = usePlayerStore(state => state.setLyricsVisible);
    const activeTrackModel = usePlayerStore(state => state.activeTrack);

    if (!isVisible || !activeTrackModel) return null;

    return (
        <ObservableLyricsViewUI
            trackModel={activeTrackModel}
            isVisible={isVisible}
            setVisible={setVisible}
        />
    );
}

const getStyles = (colors: any, fonts: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0E0E0E',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#1C1C1E',
    },
    closeButton: {
        padding: 4,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 16,
    },
    headerTrackTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        fontFamily: fonts.regular,
        textAlign: 'center',
    },
    headerTrackArtist: {
        color: colors.textSecondary,
        fontSize: 13,
        fontFamily: fonts.regular,
        textAlign: 'center',
        marginTop: 2,
    },
    menuButton: {
        padding: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: colors.textSecondary,
        fontSize: 14,
        marginTop: 12,
        fontFamily: fonts.regular,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 16,
        fontFamily: fonts.regular,
        textAlign: 'center',
        marginBottom: 24,
    },
    importButton: {
        backgroundColor: colors.accent,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
    },
    importButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        fontFamily: fonts.regular,
    },
    lyricLineContainer: {
        minHeight: 60,
        justifyContent: 'center',
        paddingVertical: 10,
        marginVertical: 4,
    },
    lyricText: {
        fontSize: 20,
        fontFamily: fonts.regular,
        textAlign: 'left',
        lineHeight: 28,
    },
    lyricTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 24,
        lineHeight: 34,
    },
    lyricTextInactive: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontWeight: '500',
    },
    lyricsListContent: {
        paddingTop: 40,
        paddingHorizontal: 24,
    },
    plainTextContainer: {
        paddingTop: 32,
        paddingHorizontal: 24,
    },
    plainLyricsText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 18,
        lineHeight: 28,
        fontFamily: fonts.regular,
        textAlign: 'center',
    },
});
