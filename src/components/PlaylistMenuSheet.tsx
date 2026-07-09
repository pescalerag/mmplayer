import { openPlaylistSelector } from '@/store/useUIStore';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { database } from '../database';
import { useSheetProps } from '@/hooks/useSheetProps';

import { useToastStore } from '../store/useToastStore';
import { Q } from '@nozbe/watermelondb';
import { navigationRef, getActiveTabName } from '../navigation/navigationRef';
import PlaylistCover from './PlaylistCover';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from "@/hooks/useAppTheme";

export default function PlaylistMenuSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { props: { playlist: selectedPlaylist, callbacks: navCallbacks }, close: closeMenu } = useSheetProps<{ playlist: any; callbacks?: any }>('playlist-menu');

  const handleViewPlaylist = () => {
    if (!selectedPlaylist) return;
    closeMenu();
    const playlistId = selectedPlaylist.id;
    if (navCallbacks.detail) {
      navCallbacks.detail(playlistId);
      return;
    }

    if (!navigationRef.isReady()) return;

    const rootState = navigationRef.getRootState();
    const activeRoute = rootState.routes[rootState.index];
    const isPlayerActive = activeRoute?.name === 'Player';

    let tabName = getActiveTabName();
    if (tabName !== 'Inicio' && tabName !== 'Biblioteca' && tabName !== 'Buscar') {
      tabName = 'Biblioteca';
    }

    const currentTab = getActiveTabName();
    const isTargetTabActive = isPlayerActive || tabName === currentTab;

    if (playlistId === 'favorites' && isTargetTabActive) {
      navigationRef.navigate('FavoritesDetail');
    } else if (playlistId === 'favorites') {
      navigationRef.navigate('Main', {
        screen: tabName,
        params: { screen: 'FavoritesDetail' }
      });
    } else if (isTargetTabActive) {
      navigationRef.navigate('PlaylistDetail', { playlistId });
    } else {
      navigationRef.navigate('Main', {
        screen: tabName,
        params: { screen: 'PlaylistDetail', params: { playlistId } }
      });
    }
  };

  if (!selectedPlaylist) return null;

  return (
    <>
      {/* Menu Header */}
      <View style={styles.header}>
        <View style={{ marginRight: 16 }}>
          <PlaylistCover
            playlistId={selectedPlaylist.id}
            isFavorites={selectedPlaylist.id === 'favorites'}
            customCoverUrl={selectedPlaylist.coverCustomUrl}
            size={56}
            borderRadius={8}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{selectedPlaylist.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{t('library.playlist_singular')}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* OPTION: Pin/Unpin */}
        {selectedPlaylist.id !== 'favorites' && (
          <TouchableOpacity
            style={styles.optionRow}
            onPress={async () => {
              await database.write(async () => {
                await selectedPlaylist.update((p: any) => {
                  p.isPinned = !p.isPinned;
                });
              });
              closeMenu();
            }}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={selectedPlaylist.isPinned ? "pin" : "pin-outline"} size={24} color={colors.text} />
            </View>
            <Text style={styles.optionText}>{selectedPlaylist.isPinned ? t('actions.unpin_library') : t('actions.pin_library')}</Text>
          </TouchableOpacity>
        )}

        {/* OPTION: Add to Playlist */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={async () => {
            try {
              const playlistTracks = await database.collections.get('playlist_tracks')
                .query(Q.where('playlist_id', selectedPlaylist.id))
                .fetch();
              
              const trackIds = playlistTracks.map((pt: any) => pt.track.id);

              if (trackIds.length === 0) {
                useToastStore.getState().showToast('La Playlist no tiene canciones', 'close-circle', '#EF4444');
                closeMenu();
                return;
              }

              const validTracks = await database.collections.get<any>('tracks')
                .query(Q.where('id', Q.oneOf(trackIds)))
                .fetch();

              closeMenu();
              openPlaylistSelector(validTracks);
            } catch (e) {
              console.error('Error fetching playlist tracks', e);
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_playlist') || 'Añadir a playlist'}</Text>
        </TouchableOpacity>

        {/* OPTION: View Playlist */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={handleViewPlaylist}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="list-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('playlist.view')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
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
});
