import TrackPlayer, { RepeatMode } from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';
import { ShuffleService } from '../services/ShuffleService';
import { database } from '../database';
import Track from '../database/models/Track';
import Album from '../database/models/Album';

// Helper para crear instancias simuladas de Track compatibles con WatermelonDB y usePlayerStore
const createMockTrack = (
  id: string,
  title: string,
  overrides: Partial<any> = {}
): Track => {
  const albumId = overrides.albumId || 'album-default';
  const mockAlbum = {
    id: albumId,
    title: overrides.albumTitle || 'Álbum Test',
    coverUrl: overrides.coverUrl || 'file:///cover.jpg',
    isExcludedFromShuffle: overrides.isAlbumExcluded ?? false,
    toggleExcludeFromShuffle: jest.fn().mockImplementation(async function (this: any) {
      this.isExcludedFromShuffle = !this.isExcludedFromShuffle;
    }),
    setExcludeFromShuffle: jest.fn().mockImplementation(async function (this: any, val: boolean) {
      this.isExcludedFromShuffle = val;
    }),
    observe: jest.fn(() => ({
      pipe: jest.fn(() => ({ subscribe: jest.fn() })),
    })),
  };

  const track: any = {
    id,
    title,
    fileUrl: overrides.fileUrl || `file:///music/${id}.mp3`,
    duration: overrides.duration ?? 200,
    isExcludedFromShuffle: overrides.isExcludedFromShuffle ?? false,
    albumId,
    _raw: { album_id: albumId },
    album: {
      id: albumId,
      fetch: jest.fn().mockResolvedValue(mockAlbum),
      observe: jest.fn(() => ({
        pipe: jest.fn(() => ({ subscribe: jest.fn() })),
      })),
    },
    artist: {
      fetch: jest.fn().mockResolvedValue({ id: 'artist-1', name: overrides.artistName || 'Artista Test' }),
    },
    queryCollaborators: {
      fetch: jest.fn().mockResolvedValue([]),
      observe: jest.fn(() => ({ subscribe: jest.fn() })),
    },
    observe: jest.fn(() => ({ subscribe: jest.fn() })),
    toggleExcludeFromShuffle: jest.fn().mockImplementation(async function (this: any) {
      this.isExcludedFromShuffle = !this.isExcludedFromShuffle;
    }),
    setExcludeFromShuffle: jest.fn().mockImplementation(async function (this: any, val: boolean) {
      this.isExcludedFromShuffle = val;
    }),
    update: jest.fn().mockImplementation(async function (this: any, cb: (t: any) => void) {
      cb(this);
    }),
    ...overrides,
  };

  return track as Track;
};

// Helper para crear un álbum simulado
const createMockAlbum = (id: string, title: string, isExcludedFromShuffle = false): Album => {
  const album: any = {
    id,
    title,
    isExcludedFromShuffle,
    toggleExcludeFromShuffle: jest.fn().mockImplementation(async function (this: any) {
      this.isExcludedFromShuffle = !this.isExcludedFromShuffle;
    }),
    setExcludeFromShuffle: jest.fn().mockImplementation(async function (this: any, val: boolean) {
      this.isExcludedFromShuffle = val;
    }),
  };
  return album as Album;
};

describe('Player & Shuffle Comprehensive Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Zustand stores
    usePlayerStore.setState({
      activeTrack: null,
      activeTrackInstanceId: null,
      prevTrack: null,
      nextTrack: null,
      playbackContext: null,
      hasNext: false,
      hasPrevious: false,
      isShuffleEnabled: false,
      shuffleOriginalQueue: [],
      userQueueSize: 0,
      isQueueLoading: false,
      playbackSpeed: 1.0,
      playbackPitch: 1.0,
      isVinylModeEnabled: false,
    });

    useSettingsStore.setState({
      shuffleOnQueueEnd: false,
      excludedSongs: [],
      queueAddBehavior: 'context_queue',
    });

    (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Off);
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
  });

  describe('1. Inicio de Reproducción (Playback Initiation)', () => {
    it('debe iniciar la reproducción cargando la cola, reseteando el reproductor y seteando el track activo', async () => {
      const track1 = createMockTrack('t1', 'Track 1');
      const track2 = createMockTrack('t2', 'Track 2');
      const track3 = createMockTrack('t3', 'Track 3');
      const tracks = [track1, track2, track3];

      // Iniciar reproducción desde el índice 0 en un contexto específico
      await usePlayerStore.getState().loadQueue(tracks, 0, 'album-detail-ctx');

      // Verificaciones en TrackPlayer
      expect(TrackPlayer.reset).toHaveBeenCalled();
      expect(TrackPlayer.add).toHaveBeenCalled();
      expect(TrackPlayer.play).toHaveBeenCalled();

      // Verificaciones en usePlayerStore
      const state = usePlayerStore.getState();
      expect(state.activeTrack?.id).toBe('t1');
      expect(state.playbackContext).toBe('album-detail-ctx');
      expect(state.isShuffleEnabled).toBe(false);
      expect(state.shuffleOriginalQueue).toEqual([]);
      expect(state.isQueueLoading).toBe(false);
    });

    it('debe iniciar la reproducción de un único track (playSingleTrack)', async () => {
      const singleTrack = createMockTrack('single-1', 'Single Song');

      await usePlayerStore.getState().playSingleTrack(singleTrack, 'direct-play');

      expect(TrackPlayer.reset).toHaveBeenCalled();
      expect(TrackPlayer.add).toHaveBeenCalled();
      expect(TrackPlayer.play).toHaveBeenCalled();

      const state = usePlayerStore.getState();
      expect(state.activeTrack?.id).toBe('single-1');
      expect(state.playbackContext).toBe('direct-play');
      expect(state.isShuffleEnabled).toBe(false);
    });
  });

  describe('2. Aleatorio: Activar y Desactivar (Toggle Shuffle Mode)', () => {
    it('al activar el modo aleatorio, debe guardar la cola original y mezclar las pistas restantes manteniendo la actual', async () => {
      const tpTracks = [
        { id: 't1-inst1', url: 'file:///t1.mp3', title: 'Song 1', artist: 'Artist', album: 'Album', duration: 180 },
        { id: 't2-inst2', url: 'file:///t2.mp3', title: 'Song 2', artist: 'Artist', album: 'Album', duration: 200 },
        { id: 't3-inst3', url: 'file:///t3.mp3', title: 'Song 3', artist: 'Artist', album: 'Album', duration: 210 },
        { id: 't4-inst4', url: 'file:///t4.mp3', title: 'Song 4', artist: 'Artist', album: 'Album', duration: 220 },
      ];

      // Simulamos que el reproductor está en la pista con índice 1 (Song 2)
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(tpTracks);
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(1);

      usePlayerStore.setState({
        isShuffleEnabled: false,
        shuffleOriginalQueue: [],
      });

      await usePlayerStore.getState().toggleShuffle();

      const state = usePlayerStore.getState();
      expect(state.isShuffleEnabled).toBe(true);
      // Debe haber respaldado la cola original completa
      expect(state.shuffleOriginalQueue).toEqual(tpTracks);

      // Debe haber limpiado las siguientes y las anteriores para dejar la actual en posición 0
      expect(TrackPlayer.removeUpcomingTracks).toHaveBeenCalled();
      expect(TrackPlayer.remove).toHaveBeenCalledWith([0]); // Remueve índice 0 (pistas anteriores)

      // Debe haber agregado las demás pistas mezcladas (3 pistas restantes)
      expect(TrackPlayer.add).toHaveBeenCalled();
      const addedTracks = (TrackPlayer.add as jest.Mock).mock.calls.slice(-1)[0][0];
      expect(addedTracks).toHaveLength(3);
      // Ninguna de las añadidas debe ser la activa (Song 2)
      const addedIds = addedTracks.map((t: any) => t.id);
      expect(addedIds).not.toContain('t2-inst2');
      expect(addedIds).toContain('t1-inst1');
      expect(addedIds).toContain('t3-inst3');
      expect(addedIds).toContain('t4-inst4');
    });

    it('al desactivar el modo aleatorio, debe restaurar el orden de la cola original a partir de la pista actual', async () => {
      const originalQueue = [
        { id: 't1-inst1', url: 'file:///t1.mp3', title: 'Song 1', artist: 'Artist', album: 'Album', duration: 180 },
        { id: 't2-inst2', url: 'file:///t2.mp3', title: 'Song 2', artist: 'Artist', album: 'Album', duration: 200 },
        { id: 't3-inst3', url: 'file:///t3.mp3', title: 'Song 3', artist: 'Artist', album: 'Album', duration: 210 },
        { id: 't4-inst4', url: 'file:///t4.mp3', title: 'Song 4', artist: 'Artist', album: 'Album', duration: 220 },
      ];

      // En el estado actual mezclado, la pista activa es t2 (índice 0 tras el shuffle)
      const shuffledQueueCurrent = [
        { id: 't2-inst2', url: 'file:///t2.mp3', title: 'Song 2', artist: 'Artist', album: 'Album', duration: 200 },
        { id: 't4-inst4', url: 'file:///t4.mp3', title: 'Song 4', artist: 'Artist', album: 'Album', duration: 220 },
        { id: 't1-inst1', url: 'file:///t1.mp3', title: 'Song 1', artist: 'Artist', album: 'Album', duration: 180 },
        { id: 't3-inst3', url: 'file:///t3.mp3', title: 'Song 3', artist: 'Artist', album: 'Album', duration: 210 },
      ];

      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(shuffledQueueCurrent);
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);

      usePlayerStore.setState({
        isShuffleEnabled: true,
        shuffleOriginalQueue: originalQueue,
      });

      await usePlayerStore.getState().toggleShuffle();

      const state = usePlayerStore.getState();
      expect(state.isShuffleEnabled).toBe(false);
      expect(state.shuffleOriginalQueue).toEqual([]);

      // Debe haber limpiado las pistas próximas
      expect(TrackPlayer.removeUpcomingTracks).toHaveBeenCalled();

      // Debe haber reañadido las pistas restauradas según el orden original relativo a t2:
      // Próximas originales tras t2: [t3, t4], Anteriores originales: [t1] => [t3, t4, t1]
      expect(TrackPlayer.add).toHaveBeenCalled();
      const restoredTracks = (TrackPlayer.add as jest.Mock).mock.calls.slice(-1)[0][0];
      const restoredIds = restoredTracks.map((t: any) => t.id);
      expect(restoredIds).toEqual(['t3-inst3', 't4-inst4', 't1-inst1']);
    });
  });

  describe('3. Aleatorio al Finalizar la Cola (Random Autoplay on Queue End)', () => {
    it('debe disparar reproducción aleatoria automática al llegar al final de la cola con shuffleOnQueueEnd activado', async () => {
      useSettingsStore.setState({ shuffleOnQueueEnd: true });
      (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Off);

      const queue = [
        { id: 'q1', url: 'file:///q1.mp3' },
        { id: 'q2', url: 'file:///q2.mp3' },
      ];
      // Estamos en la última pista (índice 1 de longitud 2)
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(queue);
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(1);

      const eligibleTrackA = createMockTrack('el-1', 'Eligible 1');
      const eligibleTrackB = createMockTrack('el-2', 'Eligible 2');

      const getEligibleSpy = jest
        .spyOn(ShuffleService, 'getEligibleShuffleTracks')
        .mockResolvedValue([eligibleTrackA, eligibleTrackB]);

      const toastSpy = jest.spyOn(useToastStore.getState(), 'showToast');

      // Al pulsar skipToNext en la última pista
      await usePlayerStore.getState().skipToNext();

      expect(getEligibleSpy).toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith(expect.any(String), 'shuffle');

      // Verifica que inició la reproducción en modo aleatorio y con el contexto correspondiente
      const state = usePlayerStore.getState();
      expect(state.isShuffleEnabled).toBe(true);
      expect(state.playbackContext).toBe('random_queue_end');

      getEligibleSpy.mockRestore();
    });

    it('no debe disparar reproducción aleatoria si shuffleOnQueueEnd está desactivado', async () => {
      useSettingsStore.setState({ shuffleOnQueueEnd: false });
      (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Off);

      const queue = [{ id: 'q1' }, { id: 'q2' }];
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(queue);
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(1);

      const getEligibleSpy = jest.spyOn(ShuffleService, 'getEligibleShuffleTracks');

      await usePlayerStore.getState().skipToNext();

      expect(getEligibleSpy).not.toHaveBeenCalled();
      expect(TrackPlayer.skipToNext).not.toHaveBeenCalled();

      getEligibleSpy.mockRestore();
    });

    it('no debe disparar reproducción aleatoria si la repetición está activada (RepeatMode !== Off)', async () => {
      useSettingsStore.setState({ shuffleOnQueueEnd: true });
      (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Queue);

      const queue = [{ id: 'q1' }, { id: 'q2' }];
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(queue);
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(1);

      const getEligibleSpy = jest.spyOn(ShuffleService, 'getEligibleShuffleTracks');

      await usePlayerStore.getState().skipToNext();

      expect(getEligibleSpy).not.toHaveBeenCalled();
      // Con repetición de cola, avanza normalmente a través de TrackPlayer
      expect(TrackPlayer.skipToNext).toHaveBeenCalled();

      getEligibleSpy.mockRestore();
    });
  });

  describe('4. Aleatorio con Canciones Excluidas (Shuffle Exclusion Filtering)', () => {
    it('debe filtrar y excluir canciones marcadas individualmente, canciones de álbumes excluidos y canciones en lista negra', async () => {
      // 1. Canción normal apta
      const normalTrack = createMockTrack('t-normal', 'Normal Song', {
        albumId: 'alb-normal',
        isExcludedFromShuffle: false,
        fileUrl: 'file:///normal.mp3',
      });

      // 2. Canción excluida individualmente
      const excludedTrack = createMockTrack('t-excluded', 'Excluded Song', {
        albumId: 'alb-normal',
        isExcludedFromShuffle: true,
        fileUrl: 'file:///excluded.mp3',
      });

      // 3. Canción cuyo álbum está excluido
      const trackFromExcludedAlbum = createMockTrack('t-album-exc', 'Album Excluded Song', {
        albumId: 'alb-excluded',
        isExcludedFromShuffle: false,
        fileUrl: 'file:///album-exc.mp3',
      });

      // 4. Canción incluida en excludedSongs de settings (blacklist)
      const blacklistedTrack = createMockTrack('t-blacklisted', 'Blacklisted Song', {
        albumId: 'alb-normal',
        isExcludedFromShuffle: false,
        fileUrl: 'file:///blacklisted.mp3',
      });

      const allTracks = [normalTrack, excludedTrack, trackFromExcludedAlbum, blacklistedTrack];
      const excludedAlbum = createMockAlbum('alb-excluded', 'Álbum Excluido', true);

      // Mock database queries
      const tracksQuery = {
        fetch: jest.fn().mockResolvedValue(allTracks),
      };
      const albumsQuery = {
        fetch: jest.fn().mockResolvedValue([excludedAlbum]),
      };

      (database.collections.get as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'tracks') {
          return { query: () => tracksQuery };
        }
        if (tableName === 'albums') {
          return { query: () => albumsQuery };
        }
        return { query: () => ({ fetch: jest.fn().mockResolvedValue([]) }) };
      });

      useSettingsStore.setState({
        excludedSongs: ['file:///blacklisted.mp3'],
      });

      // Obtener pistas elegibles para aleatorio
      const eligibleTracks = await ShuffleService.getEligibleShuffleTracks();

      // Debe incluir ÚNICAMENTE la canción normal
      expect(eligibleTracks).toHaveLength(1);
      expect(eligibleTracks[0].id).toBe('t-normal');

      // Las otras 3 deben haber sido descartadas
      const eligibleIds = eligibleTracks.map((t) => t.id);
      expect(eligibleIds).not.toContain('t-excluded');
      expect(eligibleIds).not.toContain('t-album-exc');
      expect(eligibleIds).not.toContain('t-blacklisted');
    });

    it('debe permitir conmutar la exclusión de una canción y de un álbum con ShuffleService', async () => {
      const track = createMockTrack('t-toggle', 'Toggle Song', { isExcludedFromShuffle: false });
      const album = createMockAlbum('alb-toggle', 'Toggle Album', false);

      const trackResult = await ShuffleService.toggleTrackExclusion(track);
      expect(trackResult).toBe(true);
      expect(track.toggleExcludeFromShuffle).toHaveBeenCalled();

      const albumResult = await ShuffleService.toggleAlbumExclusion(album);
      expect(albumResult).toBe(true);
      expect(album.toggleExcludeFromShuffle).toHaveBeenCalled();

      await ShuffleService.includeTrack(track);
      expect(track.setExcludeFromShuffle).toHaveBeenCalledWith(false);

      await ShuffleService.includeAlbum(album);
      expect(album.setExcludeFromShuffle).toHaveBeenCalledWith(false);
    });
  });

  describe('5. Pestaña de Canciones de la Biblioteca: Reproducir Todo Incluye Exclusiones', () => {
    it('el botón de reproducir todo en la biblioteca debe ignorar las exclusiones y reproducir todas las canciones (incluidas las excluidas del aleatorio)', async () => {
      // Creamos una lista con canciones normales y canciones excluidas del aleatorio
      const songA = createMockTrack('lib-1', 'A normal song', { isExcludedFromShuffle: false });
      const songB = createMockTrack('lib-2', 'B excluded song', { isExcludedFromShuffle: true });
      const songC = createMockTrack('lib-3', 'C album-excluded song', {
        albumId: 'alb-exc',
        isAlbumExcluded: true,
        isExcludedFromShuffle: false,
      });

      const libraryTracks = [songA, songB, songC];

      // Simulamos la acción del botón "Reproducir Todo" en la pestaña de canciones de LibraryScreen:
      // const handlePlayPress = () => usePlayerStore.getState().loadQueue(sortedTracks, 0, 'library-all-tracks');
      const libraryContextId = 'library-all-tracks';
      await usePlayerStore.getState().loadQueue(libraryTracks, 0, libraryContextId);

      // Verificamos que se ejecutó la carga con la lista completa sin filtrar
      expect(TrackPlayer.reset).toHaveBeenCalled();
      expect(TrackPlayer.play).toHaveBeenCalled();

      const state = usePlayerStore.getState();
      expect(state.activeTrack?.id).toBe('lib-1');
      expect(state.playbackContext).toBe(libraryContextId);
      // El modo aleatorio está apagado por defecto en "Reproducir Todo"
      expect(state.isShuffleEnabled).toBe(false);

      // Verificamos que TrackPlayer recibió las pistas incluyendo las excluidas de aleatorio
      const addedToPlayer = (TrackPlayer.add as jest.Mock).mock.calls[0][0];
      const addedTrackIds = addedToPlayer.map((tp: any) => tp.id);

      // Todas las pistas deben estar en la cola del reproductor
      expect(addedTrackIds.some((id: string) => id.startsWith('lib-1'))).toBe(true);
      expect(addedTrackIds.some((id: string) => id.startsWith('lib-2'))).toBe(true);
      expect(addedTrackIds.some((id: string) => id.startsWith('lib-3'))).toBe(true);
      expect(addedTrackIds).toHaveLength(3);
    });
  });
});
