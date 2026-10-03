import { Alert, Platform } from 'react-native';
import { RingtoneService, RingtoneType } from '../services/RingtoneService';
import * as NativeScanner from '../../modules/native-audio-scanner';
import { useToastStore } from '../store/useToastStore';
import Track from '../database/models/Track';

jest.mock('../../modules/native-audio-scanner', () => ({
  canWriteSettings: jest.fn(),
  openWriteSettingsPermission: jest.fn(),
  setRingtone: jest.fn(),
  RingtoneType: {
    RINGTONE: 1,
    NOTIFICATION: 2,
    ALARM: 4,
  },
}));

describe('RingtoneService', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const showToastSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    (useToastStore.getState as jest.Mock) = jest.fn().mockReturnValue({
      showToast: showToastSpy,
    });
  });

  describe('canWriteSettings', () => {
    it('returns false on non-Android platform', () => {
      (Platform as any).OS = 'ios';
      expect(RingtoneService.canWriteSettings()).toBe(false);
      expect(NativeScanner.canWriteSettings).not.toHaveBeenCalled();
    });

    it('returns native result on Android', () => {
      (Platform as any).OS = 'android';
      (NativeScanner.canWriteSettings as jest.Mock).mockReturnValue(true);
      expect(RingtoneService.canWriteSettings()).toBe(true);

      (NativeScanner.canWriteSettings as jest.Mock).mockReturnValue(false);
      expect(RingtoneService.canWriteSettings()).toBe(false);
    });
  });

  describe('openWriteSettings', () => {
    it('calls native openWriteSettingsPermission on Android', () => {
      (Platform as any).OS = 'android';
      RingtoneService.openWriteSettings();
      expect(NativeScanner.openWriteSettingsPermission).toHaveBeenCalled();
    });

    it('does nothing on non-Android', () => {
      (Platform as any).OS = 'ios';
      RingtoneService.openWriteSettings();
      expect(NativeScanner.openWriteSettingsPermission).not.toHaveBeenCalled();
    });
  });

  describe('applyRingtone', () => {
    const mockTrack = {
      id: 't1',
      fileUrl: 'file:///path/to/song.mp3',
    } as unknown as Track;

    it('returns false if not Android', async () => {
      (Platform as any).OS = 'ios';
      const result = await RingtoneService.applyRingtone(mockTrack, RingtoneType.RINGTONE);
      expect(result).toBe(false);
    });

    it('returns false and alerts if track has no fileUrl', async () => {
      const invalidTrack = { id: 't2', fileUrl: '' } as unknown as Track;
      const result = await RingtoneService.applyRingtone(invalidTrack, RingtoneType.RINGTONE);
      expect(result).toBe(false);
      expect(alertSpy).toHaveBeenCalled();
    });

    it('returns false and prompts settings if canWriteSettings is false', async () => {
      (NativeScanner.canWriteSettings as jest.Mock).mockReturnValue(false);
      const result = await RingtoneService.applyRingtone(mockTrack, RingtoneType.RINGTONE);
      expect(result).toBe(false);
      expect(alertSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ style: 'cancel' }),
          expect.objectContaining({ onPress: expect.any(Function) }),
        ])
      );

      // Trigger the onPress callback for settings button
      const alertCall = alertSpy.mock.calls[0];
      const buttons = alertCall[2] as any[];
      buttons[1].onPress();
      expect(NativeScanner.openWriteSettingsPermission).toHaveBeenCalled();
    });

    it('successfully applies ringtone, notification, and alarm', async () => {
      (NativeScanner.canWriteSettings as jest.Mock).mockReturnValue(true);
      (NativeScanner.setRingtone as jest.Mock).mockResolvedValue({ success: true });

      // Ringtone
      let result = await RingtoneService.applyRingtone(mockTrack, RingtoneType.RINGTONE);
      expect(result).toBe(true);
      expect(showToastSpy).toHaveBeenCalled();

      // Notification
      result = await RingtoneService.applyRingtone(mockTrack, RingtoneType.NOTIFICATION);
      expect(result).toBe(true);

      // Alarm
      result = await RingtoneService.applyRingtone(mockTrack, RingtoneType.ALARM);
      expect(result).toBe(true);
    });

    it('handles PERMISSION_DENIED error from native side', async () => {
      (NativeScanner.canWriteSettings as jest.Mock).mockReturnValue(true);
      (NativeScanner.setRingtone as jest.Mock).mockResolvedValue({
        success: false,
        error: 'PERMISSION_DENIED',
      });

      const result = await RingtoneService.applyRingtone(mockTrack, RingtoneType.RINGTONE);
      expect(result).toBe(false);
      expect(alertSpy).toHaveBeenCalled();

      const alertCall = alertSpy.mock.calls[0];
      const buttons = alertCall[2] as any[];
      buttons[1].onPress();
      expect(NativeScanner.openWriteSettingsPermission).toHaveBeenCalled();
    });

    it('handles generic error from native side', async () => {
      (NativeScanner.canWriteSettings as jest.Mock).mockReturnValue(true);
      (NativeScanner.setRingtone as jest.Mock).mockResolvedValue({
        success: false,
        error: 'UNKNOWN_ERROR',
      });

      const result = await RingtoneService.applyRingtone(mockTrack, RingtoneType.RINGTONE);
      expect(result).toBe(false);
      expect(alertSpy).toHaveBeenCalled();
    });

    it('handles unexpected exceptions gracefully', async () => {
      (NativeScanner.canWriteSettings as jest.Mock).mockReturnValue(true);
      (NativeScanner.setRingtone as jest.Mock).mockRejectedValue(new Error('Crash'));

      const result = await RingtoneService.applyRingtone(mockTrack, RingtoneType.RINGTONE);
      expect(result).toBe(false);
      expect(alertSpy).toHaveBeenCalled();
    });
  });
});
