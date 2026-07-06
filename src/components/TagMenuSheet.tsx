import { useAppTheme } from '@/hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { database } from '../database';
import Track from '../database/models/Track';
import { TagService } from '../services/tagService';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useTagFormStore } from '../store/useTagFormStore';
import { useTagMenuStore } from '../store/useTagMenuStore';

export default function TagMenuSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { selectedTag, closeMenu } = useTagMenuStore();
  const { openForEdit } = useTagFormStore();

  const [tracks, setTracks] = useState<Track[]>([]);

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

  if (!selectedTag) return null;

  const handleEdit = () => {
    closeMenu();
    openForEdit(selectedTag);
  };

  const handleAddToPlaylist = () => {
    if (tracks.length === 0) return;
    closeMenu();
    usePlaylistSelectorStore.getState().openSelector(tracks);
  };

  const handleDelete = () => {
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
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.tagColorDot, { backgroundColor: selectedTag.color || '#8B5CF6' }]} />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {selectedTag.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {tracks.length} {tracks.length === 1 ? t('library.song_singular') : t('library.song_plural')}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
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
      </ScrollView>
    </>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
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
    scrollContent: {
      paddingBottom: 20,
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
