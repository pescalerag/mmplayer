import { EqualizerService } from '../services/EqualizerService';
import {
  initializeEqualizer,
  setEqualizerEnabled,
  setEqualizerBandLevel,
  setEqualizerBassBoost,
  getEqualizerBandFrequencies,
  getEqualizerBandLevelRange,
  getEqualizerNumberOfBands,
  releaseEqualizer,
  extractColorFromImage,
} from '../../modules/native-equalizer';
import { usePlayerStore } from '../store/usePlayerStore';
import { useSettingsStore } from '../store/useSettingsStore';
import TrackPlayer from 'react-native-track-player';
import { requireNativeModule } from 'expo-modules-core';

const nativeModuleMock = requireNativeModule('NativeEqualizer');

describe('Audio Equalization & Effects Test Suite', () => {
  beforeEach(async () => {
    usePlayerStore.setState({
      playbackSpeed: 1.0,
      playbackPitch: 1.0,
      isVinylModeEnabled: false,
    });
    useSettingsStore.setState({
      isEqualizerEnabled: false,
      equalizerBands: [0, 0, 0, 0, 0],
      bassBoostStrength: 0,
    });
    await usePlayerStore.getState().applySpeedAndPitch();
    jest.clearAllMocks();
  });

  describe('1. Módulo Nativo de Ecualización (native-equalizer)', () => {
    it('debe inicializar el ecualizador con el audioSessionId correcto', async () => {
      await initializeEqualizer(42);
      expect(nativeModuleMock.initialize).toHaveBeenCalledWith(42);
    });

    it('debe inicializar por defecto con audioSessionId 0 si no se provee', async () => {
      await initializeEqualizer();
      expect(nativeModuleMock.initialize).toHaveBeenCalledWith(0);
    });

    it('debe activar y desactivar el ecualizador', async () => {
      await setEqualizerEnabled(true);
      expect(nativeModuleMock.setEnabled).toHaveBeenCalledWith(true);

      await setEqualizerEnabled(false);
      expect(nativeModuleMock.setEnabled).toHaveBeenCalledWith(false);
    });

    it('debe modificar el nivel de una banda específica en milibelios (mB)', async () => {
      await setEqualizerBandLevel(2, 600);
      expect(nativeModuleMock.setBandLevel).toHaveBeenCalledWith(2, 600);
    });

    it('debe ajustar la fuerza del BassBoost', async () => {
      await setEqualizerBassBoost(800);
      expect(nativeModuleMock.setBassBoost).toHaveBeenCalledWith(800);
    });

    it('debe consultar frecuencias, rango y número de bandas correctamente', async () => {
      const freqs = await getEqualizerBandFrequencies();
      const range = await getEqualizerBandLevelRange();
      const numBands = await getEqualizerNumberOfBands();

      expect(freqs).toEqual([60, 230, 910, 3600, 14000]);
      expect(range).toEqual({ min: -1500, max: 1500 });
      expect(numBands).toBe(5);
    });

    it('debe liberar recursos nativos al llamar a releaseEqualizer', async () => {
      await releaseEqualizer();
      expect(nativeModuleMock.release).toHaveBeenCalled();
    });

    it('debe extraer el color dominante de una imagen para las animaciones visuales', async () => {
      const color = await extractColorFromImage('file:///dummy/cover.jpg');
      expect(nativeModuleMock.extractColorFromImage).toHaveBeenCalledWith('file:///dummy/cover.jpg');
      expect(color).toBe('#ff0000');
    });
  });

  describe('2. Servicio de Ecualización (EqualizerService)', () => {
    it('debe inicializarse sincronizando número de bandas y rangos', async () => {
      await EqualizerService.initialize();
      expect(EqualizerService.getNumberOfBands()).toBe(5);
      expect(EqualizerService.getBandFrequencies()).toHaveLength(5);
      expect(EqualizerService.getBandLevelRange()).toEqual({ min: -1500, max: 1500 });
    });

    it('debe aplicar la configuración actual del store al hardware de audio', async () => {
      useSettingsStore.setState({
        isEqualizerEnabled: true,
        equalizerBands: [100, 200, 300, 400, 500],
        bassBoostStrength: 450,
      });

      await EqualizerService.applyCurrentSettings();

      expect(nativeModuleMock.setEnabled).toHaveBeenCalledWith(true);
      expect(nativeModuleMock.setBandLevel).toHaveBeenCalledWith(0, 100);
      expect(nativeModuleMock.setBandLevel).toHaveBeenCalledWith(1, 200);
      expect(nativeModuleMock.setBandLevel).toHaveBeenCalledWith(2, 300);
      expect(nativeModuleMock.setBandLevel).toHaveBeenCalledWith(3, 400);
      expect(nativeModuleMock.setBandLevel).toHaveBeenCalledWith(4, 500);
      expect(nativeModuleMock.setBassBoost).toHaveBeenCalledWith(450);
    });

    it('debe permitir cambiar directamente un band level y el bass boost', async () => {
      await EqualizerService.setBandLevel(1, -300);
      expect(nativeModuleMock.setBandLevel).toHaveBeenCalledWith(1, -300);

      await EqualizerService.setBassBoost(600);
      expect(nativeModuleMock.setBassBoost).toHaveBeenCalledWith(600);

      await EqualizerService.setEnabled(true);
      expect(nativeModuleMock.setEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('3. Cambio de Velocidad (Playback Speed - Modo Estándar)', () => {
    it('debe alterar la velocidad de reproducción sin modificar el tono cuando no está en modo vinilo', async () => {
      usePlayerStore.setState({ isVinylModeEnabled: false, playbackPitch: 1.0 });

      await usePlayerStore.getState().setPlaybackSpeed(1.5);

      expect(usePlayerStore.getState().playbackSpeed).toBe(1.5);
      expect(usePlayerStore.getState().playbackPitch).toBe(1.0);
      expect(TrackPlayer.setRate).toHaveBeenCalledWith(1.5);
      expect(TrackPlayer.setPitch).not.toHaveBeenCalled();
    });

    it('debe permitir desacelerar la reproducción (ej. 0.75x) preservando el tono', async () => {
      usePlayerStore.setState({ isVinylModeEnabled: false, playbackPitch: 1.0 });

      await usePlayerStore.getState().setPlaybackSpeed(0.75);

      expect(usePlayerStore.getState().playbackSpeed).toBe(0.75);
      expect(usePlayerStore.getState().playbackPitch).toBe(1.0);
      expect(TrackPlayer.setRate).toHaveBeenCalledWith(0.75);
    });
  });

  describe('4. Cambio de Tono (Playback Pitch)', () => {
    it('debe alterar el tono musical (pitch) en semitonos sin cambiar la velocidad', async () => {
      usePlayerStore.setState({ playbackSpeed: 1.0 });

      // Factor de pitch 1.25992 (aprox +4 semitonos)
      await usePlayerStore.getState().setPlaybackPitch(1.26);

      expect(usePlayerStore.getState().playbackPitch).toBe(1.26);
      expect(usePlayerStore.getState().playbackSpeed).toBe(1.0);
      expect(TrackPlayer.setPitch).toHaveBeenCalledWith(1.26);
      expect(TrackPlayer.setRate).not.toHaveBeenCalled();
    });

    it('debe permitir tonos graves (pitch inferior a 1.0)', async () => {
      await usePlayerStore.getState().setPlaybackPitch(0.85);

      expect(usePlayerStore.getState().playbackPitch).toBe(0.85);
      expect(TrackPlayer.setPitch).toHaveBeenCalledWith(0.85);
    });
  });

  describe('5. Cambio de Velocidad en Modo Hi-Fi / Vinilo (Vinyl Mode)', () => {
    it('debe cambiar conjuntamente la velocidad Y el tono 1:1 simulando reproducción analógica pura', async () => {
      // Activar modo Hi-Fi / Vinilo
      await usePlayerStore.getState().setVinylModeEnabled(true);
      expect(usePlayerStore.getState().isVinylModeEnabled).toBe(true);

      jest.clearAllMocks();

      // Al cambiar la velocidad en modo HiFi, el pitch debe igualarse exactamente a la velocidad
      await usePlayerStore.getState().setPlaybackSpeed(1.25);

      expect(usePlayerStore.getState().playbackSpeed).toBe(1.25);
      expect(usePlayerStore.getState().playbackPitch).toBe(1.25);
      expect(TrackPlayer.setRate).toHaveBeenCalledWith(1.25);
      expect(TrackPlayer.setPitch).toHaveBeenCalledWith(1.25);
    });

    it('al desacelerar en modo Hi-Fi / Vinilo (ej. 0.8x), el tono desciende en la misma proporción', async () => {
      usePlayerStore.setState({ isVinylModeEnabled: true });
      jest.clearAllMocks();

      await usePlayerStore.getState().setPlaybackSpeed(0.8);

      expect(usePlayerStore.getState().playbackSpeed).toBe(0.8);
      expect(usePlayerStore.getState().playbackPitch).toBe(0.8);
      expect(TrackPlayer.setRate).toHaveBeenCalledWith(0.8);
      expect(TrackPlayer.setPitch).toHaveBeenCalledWith(0.8);
    });

    it('al desactivar el modo Hi-Fi / Vinilo, la velocidad y el tono vuelven a comportarse de forma independiente', async () => {
      usePlayerStore.setState({ isVinylModeEnabled: true, playbackSpeed: 1.2, playbackPitch: 1.2 });
      await usePlayerStore.getState().setVinylModeEnabled(false);

      expect(usePlayerStore.getState().isVinylModeEnabled).toBe(false);

      jest.clearAllMocks();

      // Ahora cambiar velocidad no debe arrastrar el pitch
      await usePlayerStore.getState().setPlaybackSpeed(1.5);
      expect(usePlayerStore.getState().playbackSpeed).toBe(1.5);
      expect(usePlayerStore.getState().playbackPitch).toBe(1.2); // Se mantiene el pitch anterior
      expect(TrackPlayer.setRate).toHaveBeenCalledWith(1.5);
      expect(TrackPlayer.setPitch).not.toHaveBeenCalled();
    });
  });

  describe('6. Robustez y saneamiento de valores inválidos', () => {
    it('debe sanear velocidades infinitas o no numéricas por defecto a 1.0', async () => {
      usePlayerStore.setState({ playbackSpeed: 1.5 });
      await usePlayerStore.getState().applySpeedAndPitch();
      jest.clearAllMocks();

      usePlayerStore.setState({ playbackSpeed: NaN });
      await usePlayerStore.getState().applySpeedAndPitch();
      expect(TrackPlayer.setRate).toHaveBeenCalledWith(1.0);
    });

    it('debe sanear pitch negativo o 0 por defecto a 1.0', async () => {
      usePlayerStore.setState({ playbackPitch: 1.5 });
      await usePlayerStore.getState().applySpeedAndPitch();
      jest.clearAllMocks();

      usePlayerStore.setState({ playbackPitch: -0.5 });
      await usePlayerStore.getState().applySpeedAndPitch();
      expect(TrackPlayer.setPitch).toHaveBeenCalledWith(1.0);
    });
  });
});
