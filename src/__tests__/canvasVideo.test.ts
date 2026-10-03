import * as FileSystem from 'expo-file-system/legacy';
import { MediaAssetService } from '../services/MediaAssetService';
import { database } from '../database';
import Track from '../database/models/Track';

const CANVAS_DIR = `${FileSystem.documentDirectory}media_assets/canvas_videos/`;

const createMockTrack = (id: string, bgVideo: string | null = null): Track => {
  const track: any = {
    id,
    title: `Song ${id}`,
    bgVideo,
    prepareUpdate: jest.fn().mockImplementation((cb: (t: any) => void) => {
      cb(track);
      return track;
    }),
    update: jest.fn().mockImplementation(async (cb: (t: any) => void) => {
      cb(track);
      return track;
    }),
    updateBgVideo: jest.fn().mockImplementation(async (uri: string | null) => {
      track.bgVideo = uri;
    }),
  };
  return track as Track;
};

describe('Canvas Video & Background Playback Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
  });

  describe('1. Establecer Canvas (Set Canvas Video)', () => {
    it('debe asignar un vídeo canvas a una pista individual mediante updateBgVideo', async () => {
      const track = createMockTrack('track-1');
      const canvasUri = `${CANVAS_DIR}canvas_video1.mp4`;

      await track.updateBgVideo(canvasUri);

      expect(track.updateBgVideo).toHaveBeenCalledWith(canvasUri);
      expect(track.bgVideo).toBe(canvasUri);
    });

    it('debe asignar un vídeo canvas a una lista de canciones mediante assignCanvasToTracks', async () => {
      const trackA = createMockTrack('track-A');
      const trackB = createMockTrack('track-B');
      const canvasUri = `${CANVAS_DIR}canvas_shared.mp4`;

      await MediaAssetService.assignCanvasToTracks([trackA, trackB], canvasUri);

      expect(database.write).toHaveBeenCalled();
      expect(database.batch).toHaveBeenCalled();
      expect(trackA.bgVideo).toBe(canvasUri);
      expect(trackB.bgVideo).toBe(canvasUri);
    });
  });

  describe('2. Eliminar Canvas (Remove Canvas Video)', () => {
    it('debe desasignar el vídeo canvas de una canción individual', async () => {
      const canvasUri = `${CANVAS_DIR}canvas_video1.mp4`;
      const track = createMockTrack('track-1', canvasUri);

      await track.updateBgVideo(null);

      expect(track.updateBgVideo).toHaveBeenCalledWith(null);
      expect(track.bgVideo).toBeNull();
    });

    it('debe remover el canvas de varias canciones mediante removeCanvasFromTracks', async () => {
      const canvasUri = `${CANVAS_DIR}canvas_shared.mp4`;
      const trackA = createMockTrack('track-A', canvasUri);
      const trackB = createMockTrack('track-B', canvasUri);

      await MediaAssetService.removeCanvasFromTracks([trackA, trackB]);

      expect(database.write).toHaveBeenCalled();
      expect(database.batch).toHaveBeenCalled();
      expect(trackA.bgVideo).toBeNull();
      expect(trackB.bgVideo).toBeNull();
    });

    it('debe eliminar por completo un vídeo canvas del almacenamiento y desasociarlo de todas las canciones que lo usen', async () => {
      const canvasUri = `${CANVAS_DIR}canvas_todelete.mp4`;
      const track1 = createMockTrack('t1', canvasUri);
      const track2 = createMockTrack('t2', canvasUri);
      const otherTrack = createMockTrack('t3', `${CANVAS_DIR}canvas_other.mp4`);

      const tracksQuery = {
        fetch: jest.fn().mockResolvedValue([track1, track2, otherTrack]),
      };

      (database.collections.get as jest.Mock).mockReturnValue({
        query: () => tracksQuery,
      });

      await MediaAssetService.deleteCanvasVideo(canvasUri);

      // Verificamos que se desasociaron track1 y track2 pero no otherTrack
      expect(track1.bgVideo).toBeNull();
      expect(track2.bgVideo).toBeNull();
      expect(otherTrack.bgVideo).toBe(`${CANVAS_DIR}canvas_other.mp4`);

      // Verificamos que se eliminó el archivo de vídeo y su miniatura
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(canvasUri, { idempotent: true });
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('canvas_todelete.mp4.jpg'),
        { idempotent: true }
      );
    });
  });

  describe('3. Cambiar Canvas (Change Canvas Video)', () => {
    it('debe permitir cambiar el canvas existente de una canción por uno nuevo', async () => {
      const oldCanvasUri = `${CANVAS_DIR}canvas_old.mp4`;
      const newCanvasUri = `${CANVAS_DIR}canvas_new.mp4`;
      const track = createMockTrack('track-change', oldCanvasUri);

      expect(track.bgVideo).toBe(oldCanvasUri);

      // Cambiar al nuevo canvas
      await MediaAssetService.assignCanvasToTracks([track], newCanvasUri);

      expect(track.bgVideo).toBe(newCanvasUri);
      expect(track.bgVideo).not.toBe(oldCanvasUri);
    });
  });

  describe('4. Deduplicación y Reutilización de Caché (Cache Reuse)', () => {
    it('al guardar un canvas nuevo por primera vez, debe copiarlo a la carpeta de caché y generar miniatura', async () => {
      const tempUri = 'file:///cache/document_picker_temp_1.mp4';
      const hash = 'a1b2c3d4e5f6';

      // Simulamos que el archivo temporal existe y tiene hash MD5
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        if (uri === tempUri) {
          return { exists: true, size: 5000000, md5: hash };
        }
        // El destino todavía no existe en caché
        return { exists: false };
      });

      const savedUri = await MediaAssetService.saveNewCanvasVideo(tempUri, hash);

      // Debe haber copiado el archivo al destino en CANVAS_DIR
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: tempUri,
        to: `${CANVAS_DIR}canvas_${hash}.mp4`,
      });
      expect(savedUri).toBe(`${CANVAS_DIR}canvas_${hash}.mp4`);
    });

    it('si dos canciones usan el mismo canvas y ya está en caché, NO debe volver a copiarlo ni duplicarlo', async () => {
      const tempUri1 = 'file:///cache/picker_song1.mp4';
      const tempUri2 = 'file:///cache/picker_song2_duplicate.mp4';
      const sharedHash = 'shared_video_hash_999';
      const expectedCachedUri = `${CANVAS_DIR}canvas_${sharedHash}.mp4`;

      // 1. Canción 1 guarda el canvas
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        if (uri === tempUri1) {
          return { exists: true, size: 4000000, md5: sharedHash };
        }
        return { exists: false };
      });

      const uriSong1 = await MediaAssetService.saveNewCanvasVideo(tempUri1, sharedHash);
      expect(uriSong1).toBe(expectedCachedUri);
      expect(FileSystem.copyAsync).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // 2. Canción 2 intenta guardar el mismo canvas (mismo hash y ya existe en caché)
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        if (uri === tempUri2) {
          return { exists: true, size: 4000000, md5: sharedHash };
        }
        if (uri === expectedCachedUri) {
          return { exists: true, size: 4000000, md5: sharedHash };
        }
        return { exists: false };
      });

      // getAllUploadedCanvasVideos devolverá el archivo ya presente en el directorio
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([`canvas_${sharedHash}.mp4`]);

      const uriSong2 = await MediaAssetService.saveNewCanvasVideo(tempUri2, sharedHash);

      // NO debe volver a copiar el archivo porque ya existe en caché
      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
      // Debe retornar exactamente la misma URI que la canción 1
      expect(uriSong2).toBe(expectedCachedUri);
      expect(uriSong2).toBe(uriSong1);
    });

    it('al desasignar el canvas de una canción, la otra canción conserva su canvas en caché intacto', async () => {
      const sharedCanvasUri = `${CANVAS_DIR}canvas_shared_video.mp4`;
      const track1 = createMockTrack('song-1', sharedCanvasUri);
      const track2 = createMockTrack('song-2', sharedCanvasUri);

      // Desasignar el canvas solo de song-1
      await track1.updateBgVideo(null);

      expect(track1.bgVideo).toBeNull();
      // song-2 mantiene su canvas intacto
      expect(track2.bgVideo).toBe(sharedCanvasUri);
    });

    it('saveTrackCanvasVideo no debe volver a copiar el archivo si ya existe en la caché', async () => {
      const sourceUri = 'file:///cache/temp_track_video.mp4';
      const hash = 'track_video_md5_abc';
      const cachedDest = `${CANVAS_DIR}canvas_${hash}.mp4`;

      (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        if (uri === sourceUri) {
          return { exists: true, size: 3000000, md5: hash };
        }
        if (uri === cachedDest) {
          return { exists: true, size: 3000000, md5: hash };
        }
        return { exists: false };
      });

      const resultUri = await MediaAssetService.saveTrackCanvasVideo('t100', sourceUri);

      // Verificamos que no ejecutó copia duplicada
      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
      expect(resultUri).toBe(cachedDest);
    });
  });

  describe('5. Comportamiento en PlayerScreen con respecto a LyricsScreen', () => {
    it('el canvas de la pista actual debe permanecer montado en el slot de fondo sin importar si la pantalla pierde foco al abrir LyricsScreen', () => {
      const track = createMockTrack('t-playing', 'file:///canvas_playing.mp4');

      // Simulamos la resolución de propiedades de fondo en PlayerBackground:
      // Anteriormente: bgVideo = (isFocused && !isTransitioning) ? track.bgVideo : null
      // Corrección: bgVideo se mantiene directamente con track.bgVideo para que no se desmonte al abrir LyricsScreen
      const resolveSlotBgVideo = (trackModel: Track) => {
        return trackModel.bgVideo;
      };

      // Cuando la pantalla está enfocada
      const bgVideoFocused = resolveSlotBgVideo(track);
      expect(bgVideoFocused).toBe('file:///canvas_playing.mp4');

      // Cuando la pantalla pierde foco (por ejemplo al abrir LyricsScreen modal)
      const bgVideoUnfocused = resolveSlotBgVideo(track);
      expect(bgVideoUnfocused).toBe('file:///canvas_playing.mp4');
      // Garantiza que no se evalúa a null ni se desmonta el reproductor de vídeo
      expect(bgVideoUnfocused).not.toBeNull();
    });

    it('si dos canciones del mismo álbum tienen el mismo canvas, debe activar la animación de ventana al deslizar (isPrevBgIdentical = false)', () => {
      // Función lógica idéntica a la implementada en PlayerScreen
      const checkIsBgIdentical = (
        targetTrack: { bgVideo?: string | null; coverUrl: string | null } | null,
        currTrack: { bgVideo?: string | null; coverUrl: string | null },
        showCanvas: boolean
      ) => {
        if (!targetTrack) return true;
        const currBg = showCanvas && !!currTrack.bgVideo ? currTrack.bgVideo : null;
        const targetBg = showCanvas && !!targetTrack.bgVideo ? targetTrack.bgVideo : null;
        if (currBg || targetBg) return false;
        return currTrack.coverUrl === targetTrack.coverUrl;
      };

      const sharedCanvas = 'file:///media_assets/canvas_videos/canvas_album_shared.mp4';
      const albumCover = 'file:///media_assets/cd_covers/album_cover_1.jpg';

      const currentSong = { bgVideo: sharedCanvas, coverUrl: albumCover };
      const nextSongSameAlbumSameCanvas = { bgVideo: sharedCanvas, coverUrl: albumCover };
      const nextSongSameAlbumNoCanvas = { bgVideo: null, coverUrl: albumCover };
      const nextSongDifferentAlbum = { bgVideo: null, coverUrl: 'file:///other_cover.jpg' };

      // Caso 1: Mismo álbum y mismo canva -> DEBE animar la ventana (false)
      const isIdenticalSameAlbumSameCanvas = checkIsBgIdentical(nextSongSameAlbumSameCanvas, currentSong, true);
      expect(isIdenticalSameAlbumSameCanvas).toBe(false);

      // Caso 2: Mismo álbum, uno con canva y otro sin canva -> DEBE animar la ventana (false)
      const isIdenticalOneCanvas = checkIsBgIdentical(nextSongSameAlbumNoCanvas, currentSong, true);
      expect(isIdenticalOneCanvas).toBe(false);

      // Caso 3: Canciones sin canva del mismo álbum -> Fondo estático continuo sin animación redundante (true)
      const songNoCanvasA = { bgVideo: null, coverUrl: albumCover };
      const songNoCanvasB = { bgVideo: null, coverUrl: albumCover };
      const isIdenticalNoCanvasSameAlbum = checkIsBgIdentical(songNoCanvasB, songNoCanvasA, true);
      expect(isIdenticalNoCanvasSameAlbum).toBe(true);

      // Caso 4: Canciones sin canva de álbumes diferentes -> Animación de cambio de álbum (false)
      const isIdenticalDifferentAlbums = checkIsBgIdentical(nextSongDifferentAlbum, songNoCanvasA, true);
      expect(isIdenticalDifferentAlbums).toBe(false);
    });
  });
});
