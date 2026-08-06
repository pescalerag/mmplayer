import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSheetProps } from '@/hooks/useSheetProps';
import { database } from '../../database';
import Tag from '../../database/models/Tag';

interface AdvancedTagSearchProps {
  onSearch: (filters: { includes: string[]; excludes: string[]; matchAll: boolean; noPlaylists: boolean }) => void;
  initialIncludes?: string[];
  initialExcludes?: string[];
  initialMatchAll?: boolean;
  initialNoPlaylists?: boolean;
}

export default function AdvancedTagSearchSheet() {
  const { colors, fonts, layout, radii } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout, radii), [colors, fonts, layout, radii]);
  const { t } = useTranslation();

  const { props, close: closeSheet } = useSheetProps<AdvancedTagSearchProps>('advanced-tag-search');
  const [allTags, setAllTags] = useState<Tag[]>([]);
  
  const [includes, setIncludes] = useState<string[]>(props.initialIncludes || []);
  const [excludes, setExcludes] = useState<string[]>(props.initialExcludes || []);
  const [matchAll, setMatchAll] = useState<boolean>(props.initialMatchAll ?? false);
  const [noPlaylists, setNoPlaylists] = useState<boolean>(props.initialNoPlaylists ?? false);

  useEffect(() => {
    database.collections.get<Tag>('tags').query().fetch().then(setAllTags);
  }, [props]);

  const handleTagPress = (tagId: string) => {
    if (includes.includes(tagId)) {
      // Move from Include to Exclude
      setIncludes(prev => prev.filter(id => id !== tagId));
      setExcludes(prev => [...prev, tagId]);
    } else if (excludes.includes(tagId)) {
      // Move from Exclude to Neutral
      setExcludes(prev => prev.filter(id => id !== tagId));
    } else {
      // Move from Neutral to Include
      setIncludes(prev => [...prev, tagId]);
    }
  };

  const handleClearAll = () => {
    setIncludes([]);
    setExcludes([]);
    setMatchAll(false);
    setNoPlaylists(false);
  };

  const handleSearchSubmit = () => {
    props.onSearch?.({ includes, excludes, matchAll, noPlaylists });
    closeSheet();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>{t('actions.clear_all') || "Limpiar"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('search.advanced_tag_search_title') || "Búsqueda avanzada de etiquetas"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionInstruction}>
          {t('search.advanced_tag_instruction') || "Pulsa en las etiquetas para incluirlas (+), excluirlas (-) o dejarlas neutrales."}
        </Text>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendPill, styles.pillInclude]}>
              <Ionicons name="add-circle" size={14} color="#FFF" />
              <Text style={styles.legendText}>{t('search.include') || "Incluir"}</Text>
            </View>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendPill, styles.pillExclude]}>
              <Ionicons name="remove-circle" size={14} color="#FFF" />
              <Text style={styles.legendText}>{t('search.exclude') || "Excluir"}</Text>
            </View>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendPill, styles.pillNeutral]}>
              <Text style={[styles.legendText, { color: '#888' }]}>{t('search.neutral') || "Neutral"}</Text>
            </View>
          </View>
        </View>

        {/* Match all switch */}
        <View style={styles.switchContainer}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchTitle}>
              {t('search.match_all_tags') || "Coincidir con todas las etiquetas"}
            </Text>
            <Text style={styles.switchSubtitle}>
              {matchAll 
                ? (t('search.match_all_desc') || "Las canciones deben tener TODAS las etiquetas incluidas.")
                : (t('search.match_any_desc') || "Las canciones pueden tener CUALQUIERA de las etiquetas incluidas.")
              }
            </Text>
          </View>
          <Switch
            value={matchAll}
            onValueChange={setMatchAll}
            trackColor={{ false: '#282828', true: '#8B5CF6' }}
            thumbColor={matchAll ? '#FFFFFF' : '#888888'}
            ios_backgroundColor="#282828"
          />
        </View>

        {/* No playlists switch */}
        <View style={[styles.switchContainer, { marginTop: 0 }]}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchTitle}>
              {t('search.no_playlists_only') || "Canciones sin playlist"}
            </Text>
            <Text style={styles.switchSubtitle}>
              {t('search.no_playlists_desc') || "Solo ver canciones que no pertenecen a ninguna lista de reproducción."}
            </Text>
          </View>
          <Switch
            value={noPlaylists}
            onValueChange={setNoPlaylists}
            trackColor={{ false: '#282828', true: '#8B5CF6' }}
            thumbColor={noPlaylists ? '#FFFFFF' : '#888888'}
            ios_backgroundColor="#282828"
          />
        </View>

        {/* Tags Container */}
        <View style={styles.tagsContainer}>
          {allTags.length === 0 ? (
            <Text style={styles.noTagsText}>{t('search.no_tags') || "No hay etiquetas disponibles"}</Text>
          ) : (
            allTags.map((tag) => {
              const isIncluded = includes.includes(tag.id);
              const isExcluded = excludes.includes(tag.id);

              let pillStyle = styles.tagPillNeutral;
              let textStyle = styles.tagTextNeutral;
              let iconName: keyof typeof Ionicons.glyphMap | null = null;
              let iconColor = '#FFFFFF';

              if (isIncluded) {
                pillStyle = styles.tagPillInclude;
                textStyle = styles.tagTextInclude;
                iconName = 'add-circle';
              } else if (isExcluded) {
                pillStyle = styles.tagPillExclude;
                textStyle = styles.tagTextExclude;
                iconName = 'remove-circle';
              }

              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.tagPill, pillStyle]}
                  onPress={() => handleTagPress(tag.id)}
                  activeOpacity={0.8}
                >
                  {iconName && (
                    <Ionicons name={iconName} size={15} color={iconColor} style={styles.tagIcon} />
                  )}
                  <Text style={[styles.tagText, textStyle]}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={closeSheet}>
          <Text style={styles.cancelButtonText}>{t('common.cancel') || "Cancelar"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit}>
          <Ionicons name="search" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.searchButtonText}>{t('actions.search') || "Buscar"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any, radii: any) => StyleSheet.create({
  container: {
    width: '100%',
    maxHeight: 550,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: fonts.regular,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  clearBtnText: {
    color: '#B3B3B3',
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionInstruction: {
    color: '#888888',
    fontSize: 13,
    fontFamily: fonts.regular,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  legendItem: {
    alignItems: 'center',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pillInclude: {
    backgroundColor: '#10B981',
  },
  pillExclude: {
    backgroundColor: '#EF4444',
  },
  pillNeutral: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  legendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    marginBottom: 20,
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  switchTitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  switchSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    fontWeight: '600',
    color: '#888888',
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  noTagsText: {
    color: '#666',
    fontSize: 15,
    fontFamily: fonts.regular,
    fontWeight: '600',
    width: '100%',
    textAlign: 'center',
    marginVertical: 20,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagPillNeutral: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333333',
  },
  tagPillInclude: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  tagPillExclude: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  tagIcon: {
    marginRight: 6,
  },
  tagText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  tagTextNeutral: {
    color: '#B3B3B3',
  },
  tagTextInclude: {
    color: '#FFFFFF',
  },
  tagTextExclude: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    gap: 12,
    backgroundColor: '#121212',
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  searchButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
});
