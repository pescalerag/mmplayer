import { database } from '../database';
import Track from '../database/models/Track';
import { Q } from '@nozbe/watermelondb';
import { of } from 'rxjs';
import { navigationRef } from '../navigation/navigationRef';
import { usePlayerStore } from '../store/usePlayerStore';
import { useToastStore } from '../store/useToastStore';
import {
  resolveAudioUriInfo,
  clearLaunchAudioUri,
  addAudioFileOpenedListener,
  ResolvedAudioInfo,
} from '../../modules/native-audio-scanner';

const AUDIO_EXTENSIONS_REGEX = /\.(mp3|flac|wav|m4a|aac|ogg|opus|wma|alac|aiff|mid|midi)(\?.*)?$/i;

const normalizeText = (text: string) =>
  (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

let lastHandledUrl: string | null = null;
let lastHandledTimestamp = 0;
let isHandlingAudio = false;

async function waitForNavigationReady(maxWaitMs: number = 8000): Promise<boolean> {
  const startTime = Date.now();
  while (!navigationRef.isReady() && Date.now() - startTime < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return navigationRef.isReady();
}

export const EXTERNAL_AUDIO_UNSAVED_MSG = 'Archivo externo no guardado en la biblioteca';

/**
 * Creates an in-memory Track representation for external audio (content:// or external files)
 * without persisting anything into WatermelonDB.
 */
export function createExternalTrack(info: ResolvedAudioInfo): Track {
  const trackId = `ext_${Date.now()}`;
  const title = info.title || 'Audio';
  const artistName = info.artist || 'Artista desconocido';
  const albumTitle = info.album || 'Álbum desconocido';
  const coverUrl = info.coverUrl || null;
  const duration = info.duration || 0;

  const albumObj = {
    id: `ext_album_${Date.now()}`,
    title: albumTitle,
    normalizedTitle: normalizeText(albumTitle),
    coverUrl: coverUrl,
    year: info.year || null,
    isPinned: false,
    isExcludedFromShuffle: false,
    fetch: async () => albumObj,
    observe: () => of(albumObj),
  };

  const artistObj = {
    id: `ext_artist_${Date.now()}`,
    name: artistName,
    normalizedName: normalizeText(artistName),
    imageUrl: null,
    isPinned: false,
    fetch: async () => artistObj,
    observe: () => of(artistObj),
  };

  const artistsList = [artistObj];

  const externalTrack = {
    id: trackId,
    title: title,
    normalizedTitle: normalizeText(title),
    fileUrl: info.fileUrl,
    duration: duration,
    size: info.size || 0,
    isFavorite: false,
    trackNumber: info.trackNumber || 1,
    discNumber: info.discNumber || 1,
    lastModified: info.lastModified || Date.now(),
    replayGain: null,
    lyricsLRC: null,
    lyricsFetchFailed: true,
    bgVideo: null,
    rating: null,
    genre: info.genre || null,
    isExcludedFromShuffle: true,
    isExternal: true,

    // Fast-access references for UI components
    albumObj,
    artistObj,
    artistsList,
    artistName,
    albumTitle,
    coverUrl,

    // WatermelonDB relation-like properties
    album: {
      fetch: async () => albumObj,
      observe: () => of(albumObj),
      set: () => {
        /* In-memory external track relation no-op */
      },
    },
    artist: {
      fetch: async () => artistObj,
      observe: () => of(artistObj),
      set: () => {
        /* In-memory external track relation no-op */
      },
    },
    queryCollaborators: {
      fetch: async () => artistsList,
      observe: () => of(artistsList),
    },
    queryTags: {
      fetch: async () => [],
      observe: () => of([]),
    },

    // Method to observe the track itself (compat with withObservables)
    observe: () => of(externalTrack as unknown as Track),

    // In-memory dummy implementations of Track methods
    toggleLike: async () => {
      useToastStore.getState().showToast(EXTERNAL_AUDIO_UNSAVED_MSG, 'information-circle');
    },
    updateRating: async () => {
      /* In-memory external track no-op */
    },
    updateBgVideo: async () => {
      /* In-memory external track no-op */
    },
    toggleExcludeFromShuffle: async () => {
      /* In-memory external track no-op */
    },
    setExcludeFromShuffle: async () => {
      /* In-memory external track no-op */
    },
  };

  return externalTrack as unknown as Track;
}

export const ExternalAudioService = {
  isAudioUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;

    // Ignore widget URLs, notification clicks, and deep links
    if (url.includes('widget')) return false;
    if (url.startsWith('mmplayer://')) return false;
    if (url.includes('notification.click') || url.startsWith('trackplayer://')) return false;

    // Content URIs from Android file managers/apps are typically audio files when sent to this intent filter
    if (url.startsWith('content://')) return true;

    // File URIs or local file paths matching audio extensions
    if (url.startsWith('file://') || url.startsWith('/')) {
      return AUDIO_EXTENSIONS_REGEX.test(url);
    }

    return false;
  },

  async handleOpenedAudioUrl(rawUrl: string): Promise<boolean> {
    if (!rawUrl || isHandlingAudio) return false;

    // Deduplication within 1500ms
    const now = Date.now();
    if (lastHandledUrl === rawUrl && now - lastHandledTimestamp < 1500) {
      return false;
    }
    lastHandledUrl = rawUrl;
    lastHandledTimestamp = now;
    isHandlingAudio = true;

    try {
      console.log('[ExternalAudioService] Handling opened audio URL:', rawUrl);

      // 1. Resolve metadata from native side
      const info: ResolvedAudioInfo | null = await resolveAudioUriInfo(rawUrl);
      if (!info) {
        console.warn('[ExternalAudioService] Could not resolve audio info for URL:', rawUrl);
        return false;
      }

      // 2. Check if track already exists in database
      const tracksCollection = database.collections.get<Track>('tracks');
      const candidates = [
        info.fileUrl,
        info.fileUrl.replaceAll('#', '%23'),
        info.fileUrl.replaceAll('%23', '#'),
        info.originalUri,
      ];
      if (info.resolvedPath) {
        candidates.push(
          'file://' + info.resolvedPath,
          'file://' + info.resolvedPath.replaceAll('#', '%23'),
          info.resolvedPath,
        );
      }

      const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));
      const existingTracks = await tracksCollection
        .query(Q.where('file_url', Q.oneOf(uniqueCandidates)))
        .fetch();

      let targetTrack: Track | null = null;

      if (existingTracks.length > 0) {
        // Track exists in DB: simply associate and play
        console.log('[ExternalAudioService] Associated with existing track in DB:', existingTracks[0].id);
        targetTrack = existingTracks[0];
      } else {
        // Track does NOT exist in DB: play directly with read metadata without adding to DB!
        console.log('[ExternalAudioService] Playing external audio without adding to DB:', info.title);
        targetTrack = createExternalTrack(info);
      }

      if (!targetTrack) {
        console.warn('[ExternalAudioService] Failed to get Track representation');
        return false;
      }

      // 3. Play the track immediately
      await usePlayerStore.getState().playSingleTrack(targetTrack, 'external_file');

      // 4. Open PlayerScreen directly
      const isReady = await waitForNavigationReady();
      if (isReady) {
        navigationRef.navigate('Player');
      }

      // 5. Clear native launch intent so it doesn't re-trigger
      clearLaunchAudioUri();

      return true;
    } catch (error) {
      console.error('[ExternalAudioService] Error handling external audio:', error);
      return false;
    } finally {
      isHandlingAudio = false;
    }
  },

  subscribeToAudioFileOpened(callback: (uri: string) => void) {
    try {
      const subscription = addAudioFileOpenedListener((event: { uri: string }) => {
        if (event?.uri) {
          callback(event.uri);
        }
      });
      return subscription;
    } catch (e) {
      console.warn('[ExternalAudioService] Could not subscribe to onAudioFileOpened:', e);
      return {
        remove: () => {
          /* No-op subscription removal */
        },
      };
    }
  },
};
