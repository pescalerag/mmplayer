import { openPlaylistSelector } from '@/store/useUIStore';
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
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
import { database } from '../database';
import Track from '../database/models/Track';
import { getActiveTabName, navigationRef } from '../navigation/navigationRef';
import { useSheetProps } from '@/hooks/useSheetProps';
import { usePlayerStore } from '../store/usePlayerStore';

import { useToastStore } from '../store/useToastStore';

export default function ArtistMenuSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { props: { artist: selectedArtist, callbacks: navCallbacks }, close: closeMenu } = useSheetProps<{ artist: any; callbacks: any }>('artist-menu');
  const addMultipleToQueueNext = usePlayerStore(state => state.addMultipleToQueueNext);
  const addMultipleToQueueEnd = usePlayerStore(state => state.addMultipleToQueueEnd);
  const [tracks, setTracks] = useState<Track[]>([]);

  // Load artist tracks
  useEffect(() => {
    if (!selectedArtist) {
      setTracks([]);
      return;
    }

    const loadTracks = async () => {
      try {
        const tracksList = await database.collections.get<Track>('tracks')
          .query(Q.on('track_collaborators', 'artist_id', selectedArtist.id))
          .fetch();
        setTracks(tracksList);
      } catch (error) {
        console.error('Error al cargar tracks de ArtistMenuSheet:', error);
      }
    };
    loadTracks();
  }, [selectedArtist]);

  if (!selectedArtist) return null;

  return (
    <>
      {/* Menu Header */}
      <View style={styles.header}>
        {selectedArtist.imageUrl ? (
          <Image
            source={{ uri: selectedArtist.imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholder]}>
            <Ionicons name="person" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{selectedArtist.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{t('library.artist_singular')}</Text>
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
              await selectedArtist.update((a: any) => {
                a.isPinned = !a.isPinned;
              });
            });
            closeMenu();
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={selectedArtist.isPinned ? "pin" : "pin-outline"} size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{selectedArtist.isPinned ? t('actions.unpin_library') : t('actions.pin_library')}</Text>
        </TouchableOpacity>

        {/* OPTION: Play Next */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              addMultipleToQueueNext(tracks);
              useToastStore.getState().showToast(t('toasts.artist_next'), 'return-down-forward');
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
              useToastStore.getState().showToast(t('toasts.artist_queued'), 'list');
              closeMenu();
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="list" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_queue')}</Text>
        </TouchableOpacity>

        {/* OPTION: Add to Playlist */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length === 0) {
              useToastStore.getState().showToast('El artista no tiene canciones', 'close-circle', '#EF4444');
              closeMenu();
              return;
            }
            closeMenu();
            openPlaylistSelector(tracks);
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_playlist') || 'Añadir a playlist'}</Text>
        </TouchableOpacity>

        {/* OPTION: Go to Artist Details */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            closeMenu();
            const artistId = selectedArtist.id;
            if (navCallbacks.detail) {
              navCallbacks.detail(artistId);
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
    borderRadius: 28, // Circular for artists
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
});
