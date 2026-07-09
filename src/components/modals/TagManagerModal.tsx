import { useSheetProps } from '@/hooks/useSheetProps';
import { openTagForm } from '@/store/useUIStore';
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
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
import Tag from '../../database/models/Tag';
import { TagService } from '../../services/tagService';



export default function TagManagerModal() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { isVisible, props: { targetType, targetId, targetTitle } } = useSheetProps<{ targetType: 'track' | 'album' | null; targetId: string | null; targetTitle: string | null }>('tag-manager');
  

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Cargar tags y selecciones
  const reloadData = React.useCallback(async () => {
    if (!targetId || !targetType) return;
    try {
      const tags = await TagService.getAllTags();
      setAllTags(tags);

      let selectedIds: string[] = [];
      if (targetType === 'track') {
        selectedIds = await TagService.getTagIdsForTrack(targetId);
      } else {
        selectedIds = await TagService.getTagIdsForAlbum(targetId);
      }
      setSelectedTagIds(selectedIds);
    } catch (e) {
      console.error('Error cargando tags:', e);
    }
  }, [targetId, targetType]);

  useEffect(() => {
    if (isVisible) {
      reloadData();
    }
  }, [isVisible, targetId, targetType, reloadData]);

  const addTagToLocalSelection = (tagId: string) => {
    setSelectedTagIds(prev => [...prev, tagId]);
  };

  const removeTagFromLocalSelection = (tagId: string) => {
    setSelectedTagIds(prev => prev.filter(id => id !== tagId));
  };

  const toggleAlbum = async (targetId: string, tagId: string, shouldAssociate: boolean, isAssociated: boolean, propagate: boolean) => {
    try {
      await TagService.toggleAlbumTag(targetId, tagId, shouldAssociate, propagate);
      if (isAssociated) {
        removeTagFromLocalSelection(tagId);
      } else {
        addTagToLocalSelection(tagId);
      }
    } catch (e) {
      console.error('Error toggling album tag:', e);
    }
  };

  const handleAlbumTagToggle = (targetId: string, tagId: string, isAssociated: boolean) => {
    const shouldAssociate = !isAssociated;
    const tagName = allTags.find(t => t.id === tagId)?.name ?? '';
    const title = shouldAssociate ? t('tags.apply_tag') : t('tags.remove_tag');
    const message = shouldAssociate
      ? t('tags.apply_tag_album_songs', { name: tagName })
      : t('tags.remove_tag_album_songs', { name: tagName });

    Alert.alert(title, message, [
      { text: t('actions.cancel'), style: 'cancel' },
      { text: shouldAssociate ? t('tags.only_album') : t('tags.only_from_album'), onPress: () => toggleAlbum(targetId, tagId, shouldAssociate, isAssociated, false) },
      { text: t('tags.album_and_songs'), style: shouldAssociate ? 'default' : 'destructive', onPress: () => toggleAlbum(targetId, tagId, shouldAssociate, isAssociated, true) },
    ], { cancelable: true });
  };

  const handleToggleTag = async (tagId: string) => {
    if (!targetId || !targetType) return;
    const isAssociated = selectedTagIds.includes(tagId);

    if (targetType === 'track') {
      try {
        await TagService.toggleTrackTag(targetId, tagId, !isAssociated);
        if (isAssociated) {
          removeTagFromLocalSelection(tagId);
        } else {
          addTagToLocalSelection(tagId);
        }
      } catch (e) {
        console.error('Error toggling track tag:', e);
      }
    } else {
      handleAlbumTagToggle(targetId, tagId, isAssociated);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {targetType === 'track' ? t('tags.song_tags') : t('tags.album_tags')}
        </Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {targetTitle}
        </Text>
      </View>

      {/* Lista de etiquetas disponibles */}
      <Text style={styles.sectionTitle}>{t('tags.select')}</Text>
      <View style={styles.tagsContainer}>
        <ScrollView
          style={styles.tagsScrollView}
          contentContainerStyle={styles.tagsScrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {allTags.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetags-outline" size={32} color="#555" />
              <Text style={styles.emptyText}>{t('tags.empty_tags')}</Text>
            </View>
          ) : (
            allTags.map(tag => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagItem,
                    isSelected && { borderColor: tag.color, backgroundColor: `${tag.color}15` }
                  ]}
                  onPress={() => handleToggleTag(tag.id)}
                >
                  <View style={[styles.colorIndicator, { backgroundColor: tag.color }]} />
                  <Text style={styles.tagName}>{tag.name}</Text>
                  <View style={styles.checkboxContainer}>
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={22}
                      color={isSelected ? tag.color : colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Botón para crear nueva etiqueta usando el modal compartido */}
      <TouchableOpacity
        style={styles.createTagButtonGlobal}
        onPress={() => {
          openTagForm(null, reloadData);
        }}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.text} />
        <Text style={styles.createTagButtonGlobalText}>{t('tags.create')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBackground,
    paddingBottom: 15,
  },
  headerTitle: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.regular,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontFamily: fonts.regular,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  tagsContainer: {
    height: 180,
    marginBottom: 15,
  },
  tagsScrollView: {
    flex: 1,
  },
  tagsScrollContent: {
    paddingBottom: 10,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  tagName: {
    color: '#E0E0E0',
    fontSize: 15,
    fontFamily: fonts.regular,
    fontWeight: '700',
    flex: 1,
  },
  checkboxContainer: {
    paddingLeft: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  createTagButtonGlobal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    gap: 8,
  },
  createTagButtonGlobalText: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontWeight: '800',
    fontSize: 14,
  },
});
