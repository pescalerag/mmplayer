import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSheetProps } from '@/hooks/useSheetProps';
import { openTrackMenu } from '@/store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { LyricsService, parseLRC } from '../../services/LyricsService';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BaseMenuSheet, MenuOption } from '@/components/sheets/BaseMenuSheet';

export default function LyricsMenuSheet() {
  const { colors } = useAppTheme();
  const { props: { track, onImportSuccess }, close: closeMenu } = useSheetProps<{ track: any; onImportSuccess: (lyrics: string) => void }>('lyrics-menu');
  const hasLyrics = !!track?.lyricsLRC?.trim();
  const isFetchingLyrics = usePlayerStore(state => state.isFetchingLyrics);
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  if (!track) return null;

  const handleMorePress = () => {
    closeMenu();
    openTrackMenu(track, {
      album: (albumId: any) => navigation.navigate('AlbumDetail', { albumId }),
      artist: (artistId: any) => navigation.navigate('ArtistDetail', { artistId }),
    });
  };

  const handleShareLyrics = async () => {
    closeMenu();
    try {
      const album = await track.album?.fetch();
      const artist = await track.artist?.fetch();
      const collaborators = await track.queryCollaborators?.fetch();
      const artistName = collaborators && collaborators.length > 0
        ? collaborators.map((c: any) => c.name).join(', ')
        : (artist?.name || '');

      const parsed = track.lyricsLRC ? parseLRC(track.lyricsLRC) : [];
      const lines = parsed.length > 0
        ? parsed.map(p => ({ time: p.time, text: p.text }))
        : (track.lyricsLRC || '')
            .split(/\r?\n/)
            .map((l: string) => ({ text: l.trim() }))
            .filter((l: any) => l.text.length > 0);

      navigation.navigate('ShareLyrics', {
        trackId: track.id,
        title: track.title,
        artist: artistName,
        album: album?.title || '',
        coverUrl: album?.coverUrl || null,
        lyricsLines: lines,
        initialIndex: 0,
      });
    } catch (e) {
      console.error('[LyricsMenuSheet] Error preparing lyrics share:', e);
    }
  };

  const handleImportLRC = async () => {
    closeMenu();
    try {
      const imported = await LyricsService.importCustomLyrics(track);
      if (imported) {
        onImportSuccess(imported);
        Alert.alert(t('actions.success') || 'Éxito', t('lyrics.import_success') || 'Letras importadas correctamente.');
      }
    } catch {
      Alert.alert(t('actions.error') || 'Error', t('lyrics.read_error') || 'No se pudo leer el archivo de letras.');
    }
  };

  const handleSearchLyrics = async () => {
    if (LyricsService.isFetching()) {
      Alert.alert(
        t('actions.warning') || 'Atención',
        t('lyrics.search_in_progress') || 'Ya hay una búsqueda de letras en curso en este momento.'
      );
      return;
    }

    closeMenu();
    try {
      const lyrics = await LyricsService.fetchLyrics(track, true);
      if (lyrics) {
        onImportSuccess(lyrics);
        Alert.alert(t('actions.success') || 'Éxito', t('lyrics.search_success') || 'Letras encontradas e importadas correctamente.');
      } else {
        Alert.alert(t('actions.error') || 'Error', t('lyrics.search_not_found') || 'No se encontraron letras para esta canción en internet.');
      }
    } catch (e) {
      console.error('Error searching lyrics online:', e);
      Alert.alert(t('actions.error') || 'Error', t('lyrics.search_error') || 'Ocurrió un error al buscar las letras.');
    }
  };

  const handleDeleteLyrics = async () => {
    Alert.alert(
      t('actions.warning') || 'Atención',
      t('lyrics.delete_confirm') || '¿Estás seguro de que quieres eliminar las letras de esta canción?',
      [
        { text: t('actions.cancel') || 'Cancelar', style: 'cancel' },
        {
          text: t('actions.confirm') || 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            try {
              await LyricsService.saveLyrics(track, '');
              onImportSuccess('');
              closeMenu();
              Alert.alert(t('actions.success') || 'Éxito', t('lyrics.delete_success') || 'Letras eliminadas correctamente.');
            } catch (e) {
              console.error('Error deleting lyrics:', e);
              Alert.alert(t('actions.error') || 'Error', t('lyrics.delete_error') || 'No se pudieron eliminar las letras.');
            }
          }
        }
      ]
    );
  };

  return (
    <BaseMenuSheet>
      <MenuOption
        icon="information-circle-outline"
        text={t('actions.more_info') || 'Más info'}
        onPress={handleMorePress}
      />

      <MenuOption
        icon="share-social-outline"
        text={t('lyrics.share_lyrics') || 'Compartir letras'}
        disabled={!hasLyrics || isFetchingLyrics}
        containerStyle={(!hasLyrics || isFetchingLyrics) ? { opacity: 0.4 } : undefined}
        onPress={handleShareLyrics}
      />

      <MenuOption
        icon="cloud-upload-outline"
        text={t('audio_effects.lyrics_import') || 'Importar archivo .LRC'}
        disabled={isFetchingLyrics}
        containerStyle={isFetchingLyrics ? { opacity: 0.4 } : undefined}
        onPress={handleImportLRC}
      />

      <MenuOption
        icon="search-outline"
        text={t('lyrics.search_lyrics') || 'Buscar letras en internet'}
        disabled={isFetchingLyrics}
        containerStyle={isFetchingLyrics ? { opacity: 0.4 } : undefined}
        onPress={handleSearchLyrics}
      />

      <MenuOption
        icon="create-outline"
        text={t('lyrics.edit') || 'Editar letras'}
        disabled={isFetchingLyrics}
        containerStyle={isFetchingLyrics ? { opacity: 0.4 } : undefined}
        onPress={() => { closeMenu(); navigation.navigate('LyricsEditor'); }}
      />

      <MenuOption
        icon="time-outline"
        text={t('lyrics.sync') || 'Sincronizar letras'}
        disabled={!hasLyrics || isFetchingLyrics}
        containerStyle={(!hasLyrics || isFetchingLyrics) ? { opacity: 0.4 } : undefined}
        onPress={() => { closeMenu(); navigation.navigate('LyricsSync'); }}
      />

      <MenuOption
        icon="trash-outline"
        text={t('lyrics.delete_lyrics') || 'Eliminar letras'}
        iconColor={colors.heartIcon}
        textStyle={{ color: colors.heartIcon }}
        disabled={!hasLyrics || isFetchingLyrics}
        containerStyle={(!hasLyrics || isFetchingLyrics) ? { opacity: 0.4 } : undefined}
        onPress={handleDeleteLyrics}
      />
    </BaseMenuSheet>
  );
}
