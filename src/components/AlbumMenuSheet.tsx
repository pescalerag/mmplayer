import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { getActiveTabName, navigationRef } from '../navigation/navigationRef';
import { useAlbumMenuStore } from '../store/useAlbumMenuStore';
import { useMultiSelectStore } from '../store/useMultiSelectStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useTagManagerStore } from '../store/useTagManagerStore';
import { useToastStore } from '../store/useToastStore';

export default function AlbumMenuSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { selectedAlbum, closeMenu, navCallbacks } = useAlbumMenuStore();
  const addMultipleToQueueNext = usePlayerStore(state => state.addMultipleToQueueNext);
  const addMultipleToQueueEnd = usePlayerStore(state => state.addMultipleToQueueEnd);

  const [artistName, setArtistName] = useState(t('actions.unknown'));
  const [artistId, setArtistId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);

  // Load metadata and tracks
  useEffect(() => {
    if (!selectedAlbum) return;

    const loadTracksAndMetadata = async () => {
      try {
        const [artistDoc, tracksList] = await Promise.all([
          selectedAlbum.artist.fetch() as Promise<Artist | null>,
          database.collections.get<Track>('tracks').query(
            Q.where('album_id', selectedAlbum.id),
            Q.sortBy('disc_number', Q.asc),
            Q.sortBy('track_number', Q.asc)
          ).fetch()
        ]);
        setArtistName(artistDoc?.name || t('actions.unknown'));
        setArtistId(artistDoc?.id || null);
        setTracks(tracksList);
      } catch (error) {
        console.error('Error al cargar tracks de AlbumMenuSheet:', error);
      }
    };
    loadTracksAndMetadata();
  }, [selectedAlbum, t]);

  if (!selectedAlbum) return null;

  return (
    <>
      {/* Menu Header */}
      <View style={styles.header}>
        {selectedAlbum.coverUrl ? (
          <Image
            source={{ uri: selectedAlbum.coverUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholder]}>
            <Ionicons name="albums" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{selectedAlbum.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{artistName}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* OPTION: Pin/Unpin */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={async () => {
            await database.write(async () => {
              await selectedAlbum.update((a) => {
                a.isPinned = !a.isPinned;
              });
            });
            closeMenu();
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={selectedAlbum.isPinned ? "pin" : "pin-outline"} size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{selectedAlbum.isPinned ? t('actions.unpin') : t('actions.pin')}</Text>
        </TouchableOpacity>

        {/* OPTION: Play Next */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              addMultipleToQueueNext(tracks);
              useToastStore.getState().showToast(t('toasts.album_next'), 'return-down-forward');
              closeMenu();
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="return-down-forward" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_next')}</Text>
        </TouchableOpacity>

        {/* OPTION: Add to Queue */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              addMultipleToQueueEnd(tracks);
              useToastStore.getState().showToast(t('toasts.album_queued'), 'list');
              closeMenu();
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="list" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_queue')}</Text>
        </TouchableOpacity>

        {/* OPTION: Manage Tags */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            closeMenu();
            useTagManagerStore.getState().openForAlbum(selectedAlbum);
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="pricetag-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('tags.manage')}</Text>
        </TouchableOpacity>

        {/* OPTION: Add to Playlist */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              closeMenu();
              usePlaylistSelectorStore.getState().openSelector(tracks);
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_playlist')}</Text>
        </TouchableOpacity>

        {/* OPTION: Select songs */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              closeMenu();
              useMultiSelectStore.getState().selectMultipleTracks(tracks);
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.select_all')}</Text>
        </TouchableOpacity>

        {/* separator */}
        <View style={styles.separator} />

        {/* OPTION: Go to Artist */}
        {artistId && artistName !== "Varios Artistas" && (
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => {
              closeMenu();
              if (navCallbacks.artist) {
                navCallbacks.artist(artistId);
              } else if (navigationRef.isReady()) {
                const rootState = navigationRef.getRootState();
                const activeRoute = rootState.routes[rootState.index];
                const isPlayerActive = activeRoute?.name === 'Player';

                let tabName = getActiveTabName();
                if (tabName !== 'Inicio' && tabName !== 'Biblioteca' && tabName !== 'Buscar') {
                  tabName = 'Biblioteca';
                }

                const currentTab = getActiveTabName();
                if (isPlayerActive || tabName === currentTab) {
                  navigationRef.navigate('ArtistDetail', { artistId });
                } else {
                  navigationRef.navigate('Main', {
                    screen: tabName,
                    params: { screen: 'ArtistDetail', params: { artistId } }
                  });
                }
              }
            }}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="person-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.optionText}>{t('actions.go_to_artist')}</Text>
          </TouchableOpacity>
        )}
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
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 16,
  },
  placeholder: {
    backgroundColor: colors.cardBackground,
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
