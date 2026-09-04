import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { TagService } from '../../services/tagService';
import { useSheetProps } from '@/hooks/useSheetProps';
import { openTagForm, openPlaylistSelector } from '@/store/useUIStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BaseMenuSheet, MenuOption, MenuSeparator } from '@/components/sheets/BaseMenuSheet';

export default function TagMenuSheet() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { props: { tag: selectedTag }, close: closeMenu } = useSheetProps<{ tag: any; callbacks?: any }>('tag-menu');
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
    openTagForm(selectedTag);
  };

  const handleAddToPlaylist = () => {
    if (tracks.length === 0) return;
    closeMenu();
    openPlaylistSelector(tracks);
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
    <BaseMenuSheet
      title={selectedTag.name}
      subtitle={`${tracks.length} ${tracks.length === 1 ? t('library.song_singular') : t('library.song_plural')}`}
      headerLeft={
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          backgroundColor: selectedTag.color || colors.accent
        }} />
      }
    >
      {/* OPTION: Edit */}
      <MenuOption
        icon="pencil-outline"
        text={t('tags.edit')}
        onPress={handleEdit}
      />

      {/* OPTION: Add to playlist */}
      <MenuOption
        icon="add-circle-outline"
        text={t('actions.add_to_playlist')}
        onPress={handleAddToPlaylist}
      />

      {/* Separator */}
      <MenuSeparator />

      {/* OPTION: Delete */}
      <MenuOption
        icon="trash-outline"
        text={t('tags.delete_tag_title')}
        iconColor={colors.heartIcon}
        textStyle={{ color: colors.heartIcon }}
        onPress={handleDelete}
      />
    </BaseMenuSheet>
  );
}
