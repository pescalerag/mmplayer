import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    BackHandler,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import Track from '../database/models/Track';
import { database } from '../database';
import { useTagMenuStore } from '../store/useTagMenuStore';
import { useTagFormStore } from '../store/useTagFormStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { TagService } from '../services/tagService';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TagMenuSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { isVisible, selectedTag, closeMenu } = useTagMenuStore();
    const { openForEdit } = useTagFormStore();

    const [tracks, setTracks] = useState<Track[]>([]);

    // Animated values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Animation on visibility change
    useEffect(() => {
        if (isVisible) {
            if (Platform.OS === 'android') {
                NavigationBar.setBackgroundColorAsync('#121212').catch(() => {});
            }
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    // Android hardware back button
    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => {
            closeMenu();
            return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeMenu]);

    // Load tracks for the selected tag
    useEffect(() => {
        if (!selectedTag) return;
        const loadTracks = async () => {
            try {
                const tagTracks = await database.collections
                    .get<Track>('tracks')
                    .query(
                        Q.experimentalJoinTables(['track_tags']),
                        Q.on('track_tags', 'tag_id', selectedTag.id),
                        Q.sortBy('title', Q.asc),
                    )
                    .fetch();
                setTracks(tagTracks);
            } catch (error) {
                console.error('Error loading tracks for TagMenuSheet:', error);
                setTracks([]);
            }
        };
        loadTracks();
    }, [selectedTag]);

    // Delay unmount until animation finishes
    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender && !isVisible) return null;

    const handleEdit = () => {
        if (!selectedTag) return;
        closeMenu();
        openForEdit(selectedTag);
    };

    const handleAddToPlaylist = () => {
        if (tracks.length === 0) return;
        closeMenu();
        usePlaylistSelectorStore.getState().openSelector(tracks);
    };

    const handleDelete = () => {
        if (!selectedTag) return;
        Alert.alert(
            t('tags.delete_tag_title'),
            t('tags.delete_tag_confirm', { name: selectedTag.name }),
            [
                { text: t('actions.cancel'), style: 'cancel' },
                {
                    text: t('actions.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        closeMenu();
                        await TagService.deleteTag(selectedTag.id);
                    },
                },
            ],
        );
    };

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            {/* Backdrop */}
            <TouchableWithoutFeedback onPress={closeMenu}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            {/* Sheet */}
            <Animated.View
                style={[
                    styles.sheetContainer,
                    {
                        paddingBottom: insets.bottom + 20,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {/* Drag indicator */}
                <View style={styles.dragIndicator} />

                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.tagColorDot, { backgroundColor: selectedTag?.color || '#8B5CF6' }]} />
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>
                            {selectedTag?.name}
                        </Text>
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {tracks.length} {tracks.length === 1 ? t('library.song_singular') : t('library.song_plural')}
                        </Text>
                    </View>
                </View>

                {/* OPTION: Edit */}
                <TouchableOpacity style={styles.optionRow} onPress={handleEdit}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="pencil-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('tags.edit')}</Text>
                </TouchableOpacity>

                {/* OPTION: Add to playlist */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={handleAddToPlaylist}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="add-circle-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.add_to_playlist')}</Text>
                </TouchableOpacity>

                {/* Separator */}
                <View style={styles.separator} />

                {/* OPTION: Delete */}
                <TouchableOpacity style={styles.optionRow} onPress={handleDelete}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="trash-outline" size={24} color={colors.heartIcon} />
                    </View>
                    <Text style={[styles.optionText, { color: colors.heartIcon }]}>
                        {t('tags.delete_tag_title')}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) =>
    StyleSheet.create({
        overlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.7)',
        },
        sheetContainer: {
            backgroundColor: '#121212',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            position: 'absolute',
            bottom: 0,
            width: '100%',
            borderTopWidth: 1,
            borderColor: colors.cardBackground,
        },
        dragIndicator: {
            width: 36,
            height: 4,
            backgroundColor: '#333',
            borderRadius: 2,
            alignSelf: 'center',
            marginBottom: 24,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
            borderBottomWidth: 1,
            borderBottomColor: colors.cardBackground,
            paddingBottom: 20,
        },
        tagColorDot: {
            width: 48,
            height: 48,
            borderRadius: 12,
            marginRight: 16,
            justifyContent: 'center',
            alignItems: 'center',
        },
        headerText: {
            flex: 1,
        },
        title: {
            color: colors.text,
            fontSize: 18,
            fontFamily: fonts.regular,
            fontWeight: '800',
        },
        subtitle: {
            color: colors.textSecondary,
            fontSize: 14,
            fontFamily: fonts.regular,
            fontWeight: '700',
            marginTop: 4,
        },
        optionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
        },
        iconContainer: {
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        optionText: {
            color: colors.text,
            fontSize: 16,
            fontFamily: fonts.regular,
            fontWeight: '700',
        },
        separator: {
            height: 1,
            backgroundColor: colors.cardBackground,
            marginVertical: 8,
        },
    });
