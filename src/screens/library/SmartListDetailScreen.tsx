import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, { State } from 'react-native-track-player';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import DetailHeaderLayout from '@/components/layouts/DetailHeaderLayout';
import SectionHeader from '@/components/common/SectionHeader';
import TrackRow from '@/components/player/TrackRow';
import { database } from '../../database';
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import Track from '../../database/models/Track';
import { HistoryService } from '../../services/HistoryService';
import { SmartListService } from '../../services/SmartListService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { Layout } from '../../theme/theme';
import PlaylistCover from '@/components/player/PlaylistCover';
import { formatAlbumDuration } from '../../utils/time';

const { width } = Dimensions.get('window');

// ─── SMART LIST TRACK ROW COMPONENT ───
const SmartTrackRow = withObservables(['track'], ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe().pipe(catchError(() => of(null))),
    artists: track.queryCollaborators.observe() as any,
}))(function SmartTrackRow({
    track,
    album,
    artists,
    smartListId,
    index,
    onPress,
}: {
    track: Track;
    album: Album | null;
    artists: Artist[];
    smartListId: string;
    index: number;
    onPress: (trackId: string) => void;
}) {
    const { t } = useTranslation();
    const artistNames = artists.length > 0
        ? artists.map(a => a.name).join(', ')
        : t('actions.unknown');
    return (
        <TrackRow
            track={track}
            contextId={`smart-list-${smartListId}`}
            index={index}
            coverUrl={album?.coverUrl}
            artistName={artistNames}
            onPress={onPress}
            preventAutoHistory={true}
        />
    );
});

// ─── MAIN SMART LIST CONTENT ───
interface SmartListDetailProps {
    smartListId: string;
    tracks: Track[];
    loading?: boolean;
}

function SmartListDetailContent({ smartListId, tracks, loading }: Readonly<SmartListDetailProps>) {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    const lists = SmartListService.getSmartLists();
    const listDef = lists.find(l => l.id === smartListId);

    // Player States
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;
    const playbackContext = usePlayerStore(state => state.playbackContext);

    const isCurrentContext = playbackContext === `smart-list-${smartListId}`;
    const isCurrentContextPlaying = isCurrentContext && isPlaying;

    const totalDuration = tracks.reduce((sum: number, t: Track) => sum + (t.duration || 0), 0);

    const handleBack = () => {
        navigation.goBack();
    };

    const handleTrackPress = useCallback((trackId: string) => {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            HistoryService.updateUIRecents({
                id: `smart-list-${smartListId}`,
                type: 'playlist',
                context: 'manual',
                title: listDef?.name || 'Lista inteligente',
                subtitle: t('actions.special'),
                imageUrl: null,
            });
            usePlayerStore.getState().loadQueue(tracks, trackIndex, `smart-list-${smartListId}`);
        }
    }, [tracks, smartListId, listDef, t]);

    const handleFabPress = async () => {
        if (isCurrentContext) {
            if (isPlaying) {
                await TrackPlayer.pause();
            } else {
                await TrackPlayer.play();
            }
        } else if (tracks.length > 0) {
            HistoryService.updateUIRecents({
                id: `smart-list-${smartListId}`,
                type: 'playlist',
                context: 'manual',
                title: listDef?.name || 'Lista inteligente',
                subtitle: t('actions.special'),
                imageUrl: null,
            });
            usePlayerStore.getState().loadQueue(tracks, 0, `smart-list-${smartListId}`);
        }
    };

    const handleShuffleFabPress = () => {
        if (tracks.length > 0) {
            HistoryService.updateUIRecents({
                id: `smart-list-${smartListId}`,
                type: 'playlist',
                context: 'manual',
                title: listDef?.name || 'Lista inteligente',
                subtitle: t('actions.special'),
                imageUrl: null,
            });
            usePlayerStore.getState().startShuffled(tracks, `smart-list-${smartListId}`);
        }
    };

    const listHeader = (
        <>
            <DetailHeaderLayout
                title={listDef?.name || 'Lista inteligente'}
                isFavorites={false}
                placeholderIcon={listDef?.placeholderIcon || 'musical-notes'}
                subtitle={listDef?.description || 'Lista inteligente'}
                metaInfo={`${tracks.length} ${tracks.length === 1 ? t('library.song_singular') : t('library.song_plural')} · ${formatAlbumDuration(totalDuration)}`}
                onBack={handleBack}
                renderCover={() => (
                    <PlaylistCover
                        playlistId={`smart-list-${smartListId}`}
                        width={width}
                        height={380}
                        borderRadius={0}
                    />
                )}
                renderExtra={() => (
                    tracks.length > 0 && (
                        <>
                            {/* Shuffle Button */}
                            <TouchableOpacity
                                style={styles.shuffleFab}
                                onPress={handleShuffleFabPress}
                            >
                                <Ionicons name="shuffle" size={22} color={colors.text} />
                            </TouchableOpacity>

                            {/* Play/Pause Button */}
                            <TouchableOpacity
                                style={styles.playFab}
                                onPress={handleFabPress}
                            >
                                <Ionicons
                                    name={isCurrentContextPlaying ? "pause" : "play"}
                                    size={28}
                                    color={colors.onAccent}
                                    style={isCurrentContextPlaying ? {} : { marginLeft: 4 }}
                                />
                            </TouchableOpacity>
                        </>
                    )
                )}
            />

            <View style={{ marginTop: 0, marginBottom: 4 }}>
                <SectionHeader title={t('library.songs')} />
                <View style={styles.divider} />
            </View>
        </>
    );

    const renderItem = useCallback((info: { item: Track; index: number }) => {
        const { item, index } = info;
        return (
            <View style={{ minHeight: 64, width: '100%' }}>
                <SmartTrackRow
                    track={item}
                    smartListId={smartListId}
                    index={index + 1}
                    onPress={handleTrackPress}
                />
            </View>
        );
    }, [handleTrackPress, smartListId]);

    return (
        <View style={styles.container}>
            <FlashList
                data={tracks}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="musical-notes-outline" size={60} color="#555" />
                        <Text style={styles.emptyText}>{t('actions.playlist_empty')}</Text>
                        <Text style={styles.emptySubtitle}>{t('actions.playlist_empty_desc')}</Text>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom }}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// ─── RATING OBSERVED COMPONENT ───
const getRatingQuery = (id: string) => {
    const coll = database.collections.get<Track>('tracks');
    if (id === 'rating_1_2') {
        return coll.query(Q.where('rating', Q.oneOf([1.0, 1.5, 2.0])));
    }
    if (id === 'rating_2_3') {
        return coll.query(Q.where('rating', Q.oneOf([2.0, 2.5, 3.0])));
    }
    if (id === 'rating_3_4') {
        return coll.query(Q.where('rating', Q.oneOf([3.0, 3.5, 4.0])));
    }
    if (id === 'rating_4_5') {
        return coll.query(Q.where('rating', Q.oneOf([4.0, 4.5, 5.0])));
    }
    if (id === 'rating_unrated') {
        return coll.query(
            Q.or(
                Q.where('rating', Q.eq(null as any)),
                Q.where('rating', 0)
            )
        );
    }
    if (id === 'rating_5') {
        return coll.query(Q.where('rating', 5.0));
    }
    if (id === 'rating_4') {
        return coll.query(Q.where('rating', Q.oneOf([4.0, 4.5])));
    }
    return coll.query(Q.where('rating', Q.oneOf([4.0, 4.5, 5.0])));
};

const ObservableRatingDetail = withObservables(['smartListId'], ({ smartListId }: { smartListId: string }) => ({
    tracks: getRatingQuery(smartListId).observe(),
}))(SmartListDetailContent);

// ─── HISTORY STATE-BASED COMPONENT ───
function HistorySmartListDetail({ smartListId }: { smartListId: string }) {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);

    const loadTracks = useCallback(async () => {
        setLoading(true);
        try {
            const lists = SmartListService.getSmartLists();
            const listDef = lists.find(l => l.id === smartListId);
            if (listDef) {
                const resolved = await listDef.getTracks();
                setTracks(resolved);
            }
        } catch (e) {
            console.error('Error loading history smart list:', e);
        } finally {
            setLoading(false);
        }
    }, [smartListId]);

    useFocusEffect(
        useCallback(() => {
            loadTracks();
        }, [loadTracks])
    );

    return (
        <SmartListDetailContent
            smartListId={smartListId}
            tracks={tracks}
            loading={loading}
        />
    );
}

// ─── MAIN EXPORT CHOOSE COMPONENT ───
export default function SmartListDetailScreen() {
    const route = useRoute<any>();
    const { smartListId } = route.params;

    if (smartListId.startsWith('rating_')) {
        return <ObservableRatingDetail smartListId={smartListId} />;
    }

    return <HistorySmartListDetail smartListId={smartListId} />;
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    divider: {
        height: 1,
        backgroundColor: colors.cardBackground,
        marginHorizontal: 20,
        marginBottom: 4,
    },
    playFab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    shuffleFab: {
        position: 'absolute',
        bottom: 20,
        right: 86,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 16,
    },
    emptySubtitle: {
        color: '#888',
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 8,
    },
});
