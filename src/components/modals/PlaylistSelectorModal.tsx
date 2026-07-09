import { useSheetProps } from '@/hooks/useSheetProps';
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertButton,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Playlist from '../../database/models/Playlist';
import { PlaylistService } from '../../services/PlaylistService';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';

import { useToastStore } from '../../store/useToastStore';
import PlaylistCover from '@/components/player/PlaylistCover';

export default function PlaylistSelectorModal() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { isVisible, props: { tracksToAssociate = [], playlistToEdit, isCreatingDirectly }, close: closeSelector } = useSheetProps<{ tracksToAssociate: any[]; playlistToEdit: any; isCreatingDirectly: boolean }>('playlist-selector');

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [alreadyPresentPlaylists, setAlreadyPresentPlaylists] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');

  const loadPlaylists = React.useCallback(async () => {
    try {
      const list = await PlaylistService.getAllPlaylists();
      setPlaylists(list);

      if (tracksToAssociate.length > 0) {
        const trackIds = tracksToAssociate.map((t: any) => t.id);
        const associationMap: Record<string, boolean> = {};

        await Promise.all(list.map(async (pl) => {
          const existingTrackIds = await PlaylistService.getTrackIdsInPlaylist(pl.id);
          const allPresent = trackIds.every((id: any) => existingTrackIds.includes(id));
          associationMap[pl.id] = allPresent;
        }));
        setAlreadyPresentPlaylists(associationMap);
      } else {
        setAlreadyPresentPlaylists({});
      }
    } catch (e) {
      console.error('Error cargando playlists:', e);
    }
  }, [tracksToAssociate]);

  useEffect(() => {
    if (isVisible) {
      loadPlaylists();
      if (playlistToEdit) {
        setIsCreating(true);
        setPlaylistName(playlistToEdit.name || '');
        setPlaylistDesc(playlistToEdit.description || '');
      } else if (isCreatingDirectly) {
        setIsCreating(true);
        setPlaylistName('');
        setPlaylistDesc('');
      } else {
        setIsCreating(false);
        setPlaylistName('');
        setPlaylistDesc('');
      }
    }
  }, [isVisible, playlistToEdit, isCreatingDirectly, loadPlaylists]);

  const handleDuplicateTracks = (playlistId: string, existingTrackIds: string[], duplicateTracks: typeof tracksToAssociate) => {
    const showToast = (count: number) => {
      const msg = count === 1 ? t('toasts.added_to_playlist') : t('toasts.added_to_playlist_plural', { count });
      useToastStore.getState().showToast(msg, 'list-circle');
    };

    if (tracksToAssociate.length === 1) {
      const singleTrack = tracksToAssociate[0];
      Alert.alert(
        t('actions.duplicate_song_title'),
        t('actions.duplicate_song_confirm', { title: singleTrack.title }),
        [
          { text: t('actions.cancel'), style: "cancel" },
          { text: t('actions.add'), onPress: async () => { await PlaylistService.addMultipleTracksToPlaylist(playlistId, [singleTrack.id]); showToast(1); closeSelector(); useMultiSelectStore.getState().exitSelectionMode(); } }
        ]
      );
      return;
    }

    const newTracks = tracksToAssociate.filter(t => !existingTrackIds.includes(t.id));
    const buttons: AlertButton[] = [{ text: t('actions.cancel'), style: "cancel" }];

    if (newTracks.length > 0) {
      buttons.push({ text: t('actions.only_new'), onPress: async () => { await PlaylistService.addMultipleTracksToPlaylist(playlistId, newTracks.map((t: any) => t.id)); showToast(newTracks.length); closeSelector(); useMultiSelectStore.getState().exitSelectionMode(); } });
    }
    buttons.push({ text: t('actions.add_all'), onPress: async () => { await PlaylistService.addMultipleTracksToPlaylist(playlistId, tracksToAssociate.map((t: any) => t.id)); showToast(tracksToAssociate.length); closeSelector(); useMultiSelectStore.getState().exitSelectionMode(); } });

    const message = newTracks.length > 0
      ? t('actions.duplicate_songs_partial', { duplicateCount: duplicateTracks.length, totalCount: tracksToAssociate.length })
      : t('actions.duplicate_songs_all', { count: duplicateTracks.length });

    Alert.alert(t('actions.duplicate_songs_title'), message, buttons);
  };

  const handleSelectPlaylist = async (playlistId: string) => {
    if (tracksToAssociate.length === 0) return;
    try {
      const existingTrackIds = await PlaylistService.getTrackIdsInPlaylist(playlistId);
      const duplicateTracks = tracksToAssociate.filter(t => existingTrackIds.includes(t.id));

      if (duplicateTracks.length > 0) {
        handleDuplicateTracks(playlistId, existingTrackIds, duplicateTracks);
      } else {
        await PlaylistService.addMultipleTracksToPlaylist(playlistId, tracksToAssociate.map((t: any) => t.id));
        const msg = tracksToAssociate.length === 1 ? t('toasts.added_to_playlist') : t('toasts.added_to_playlist_plural', { count: tracksToAssociate.length });
        useToastStore.getState().showToast(msg, 'list-circle');
        closeSelector();
        useMultiSelectStore.getState().exitSelectionMode();
      }
    } catch (e) {
      console.error('Error añadiendo canciones a playlist:', e);
    }
  };

  const handleSavePlaylist = async () => {
    if (!playlistName.trim()) return;
    try {
      if (playlistToEdit) {
        await PlaylistService.updatePlaylist(playlistToEdit.id, playlistName, playlistDesc);
      } else {
        const playlist = await PlaylistService.createPlaylist(playlistName, playlistDesc);
        if (tracksToAssociate.length > 0) {
          const trackIds = tracksToAssociate.map((t: any) => t.id);
          await PlaylistService.addMultipleTracksToPlaylist(playlist.id, trackIds);
          const msg = tracksToAssociate.length === 1 ? t('toasts.added_to_new_playlist') : t('toasts.added_to_new_playlist_plural', { count: tracksToAssociate.length });
          useToastStore.getState().showToast(msg, 'list-circle');
          useMultiSelectStore.getState().exitSelectionMode();
        } else {
          useToastStore.getState().showToast(t('toasts.playlist_created'), 'list-circle');
        }
      }
      Keyboard.dismiss();
      closeSelector();
    } catch (e) {
      console.error('Error guardando playlist:', e);
    }
  };

  let saveButtonText = '';
  if (playlistToEdit) {
    saveButtonText = t('actions.save_changes');
  } else if (isCreatingDirectly) {
    saveButtonText = t('library.create_playlist');
  } else {
    saveButtonText = t('playlist.create_and_add');
  }

  const subtitleText = tracksToAssociate.length === 1
    ? t('actions.add_song_to', { title: tracksToAssociate[0].title })
    : t('actions.add_songs_to', { count: tracksToAssociate.length });

  return (
    <View style={styles.container}>
      {isCreating ? (
        <View>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {playlistToEdit ? t('playlist.edit') : t('playlist.new')}
            </Text>
            <Text style={styles.headerSubtitle}>
              {playlistToEdit ? t('playlist.modify_details') : t('playlist.personalize')}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>{t('playlist.name')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('playlist.placeholder_name')}
            placeholderTextColor={colors.textSecondary}
            value={playlistName}
            onChangeText={setPlaylistName}
            maxLength={30}
            autoFocus
            autoCorrect={false}
          />

          <Text style={styles.sectionTitle}>{t('playlist.description')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('playlist.placeholder_desc')}
            placeholderTextColor={colors.textSecondary}
            value={playlistDesc}
            onChangeText={setPlaylistDesc}
            maxLength={120}
            multiline
            numberOfLines={3}
          />

          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={() => {
                if (playlistToEdit || isCreatingDirectly) {
                  closeSelector();
                } else {
                  setIsCreating(false);
                }
              }}
            >
              <Text style={styles.btnCancelText}>{t('actions.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnConfirm,
                !playlistName.trim() && { opacity: 0.5 }
              ]}
              onPress={handleSavePlaylist}
              disabled={!playlistName.trim()}
            >
              <Text style={styles.btnConfirmText}>
                {saveButtonText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('actions.add_to_playlist')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitleText}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setIsCreating(true)}
          >
            <Ionicons name="add" size={20} color={colors.text} />
            <Text style={styles.createButtonText}>{t('playlist.create_new_playlist')}</Text>
          </TouchableOpacity>

          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {playlists.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-notes-outline" size={48} color="#444" />
                <Text style={styles.emptyText}>{t('library.empty_playlists')}</Text>
              </View>
            ) : (
              playlists.map(pl => {
                const isPresent = alreadyPresentPlaylists[pl.id];
                return (
                  <TouchableOpacity
                    key={pl.id}
                    style={[
                      styles.playlistItem,
                      isPresent && styles.playlistItemPresent
                    ]}
                    onPress={() => handleSelectPlaylist(pl.id)}
                  >
                    <PlaylistCover playlistId={pl.id} size={48} customCoverUrl={pl.coverCustomUrl} />
                    <View style={styles.playlistInfo}>
                      <Text style={styles.playlistName} numberOfLines={1}>{pl.name}</Text>
                      <Text style={styles.playlistDesc} numberOfLines={1}>
                        {pl.description || t('playlist.no_description')}
                      </Text>
                    </View>
                    {isPresent ? (
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#555" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </>
      )}
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 8,
  },
  createButtonText: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontWeight: '800',
    fontSize: 14,
  },
  listScroll: {
    maxHeight: 400,
  },
  listContent: {
    paddingBottom: 10,
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
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  playlistItemPresent: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistName: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  playlistDesc: {
    color: '#888',
    fontSize: 12,
    fontFamily: fonts.regular,
    fontWeight: '700',
    marginTop: 2,
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
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    height: 48,
    color: colors.text,
    fontFamily: fonts.regular,
    fontWeight: '600',
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: colors.overlayAlpha05,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  btnCancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontWeight: '700',
    fontSize: 14,
  },
  btnConfirm: {
    backgroundColor: colors.accent,
  },
  btnConfirmText: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontWeight: '800',
    fontSize: 14,
  },
});
