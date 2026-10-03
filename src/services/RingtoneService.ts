import { Alert, Platform } from 'react-native';
import i18n from 'i18next';
import { useToastStore } from '@/store/useToastStore';
import {
  canWriteSettings,
  openWriteSettingsPermission,
  setRingtone,
  RingtoneType,
} from '../../modules/native-audio-scanner';
import Track from '@/database/models/Track';

export { RingtoneType };

export const RingtoneService = {
  canWriteSettings(): boolean {
    if (Platform.OS !== 'android') return false;
    return canWriteSettings();
  },

  openWriteSettings(): void {
    if (Platform.OS === 'android') {
      openWriteSettingsPermission();
    }
  },

  async applyRingtone(track: Track, type: RingtoneType): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const fileUrl = track.fileUrl;
    if (!fileUrl) {
      Alert.alert(
        i18n.t('actions.error') || 'Error',
        i18n.t('ringtone.error_invalid_file') || 'El archivo de audio no es válido o no está disponible.'
      );
      return false;
    }

    // Check WRITE_SETTINGS permission
    const hasPermission = canWriteSettings();
    if (!hasPermission) {
      Alert.alert(
        i18n.t('ringtone.permission_required_title') || 'Permiso necesario',
        i18n.t('ringtone.permission_required_desc') ||
          'Para establecer tonos de llamada, notificaciones o alarmas, debes permitir que MMPlayer modifique los ajustes del sistema.',
        [
          {
            text: i18n.t('actions.cancel') || 'Cancelar',
            style: 'cancel',
          },
          {
            text: i18n.t('ringtone.open_settings') || 'Abrir ajustes',
            onPress: () => {
              openWriteSettingsPermission();
            },
          },
        ]
      );
      return false;
    }

    try {
      const result = await setRingtone(fileUrl, type);

      if (result.success) {
        let toastMsg = '';
        switch (type) {
          case RingtoneType.RINGTONE:
            toastMsg = i18n.t('ringtone.success_ringtone') || 'Tono de llamada establecido';
            break;
          case RingtoneType.NOTIFICATION:
            toastMsg = i18n.t('ringtone.success_notification') || 'Tono de notificación establecido';
            break;
          case RingtoneType.ALARM:
            toastMsg = i18n.t('ringtone.success_alarm') || 'Tono de alarma establecido';
            break;
        }
        useToastStore.getState().showToast(toastMsg, 'checkmark-circle');
        return true;
      } else {
        if (result.error === 'PERMISSION_DENIED') {
          Alert.alert(
            i18n.t('ringtone.permission_required_title') || 'Permiso necesario',
            i18n.t('ringtone.permission_required_desc') ||
              'Para establecer tonos de llamada, notificaciones o alarmas, debes permitir que MMPlayer modifique los ajustes del sistema.',
            [
              { text: i18n.t('actions.cancel') || 'Cancelar', style: 'cancel' },
              {
                text: i18n.t('ringtone.open_settings') || 'Abrir ajustes',
                onPress: () => openWriteSettingsPermission(),
              },
            ]
          );
        } else {
          Alert.alert(
            i18n.t('actions.error') || 'Error',
            i18n.t('ringtone.error_generic') || 'No se pudo establecer el tono seleccionado.'
          );
        }
        return false;
      }
    } catch (e: any) {
      console.error('[RingtoneService] Error setting ringtone:', e);
      Alert.alert(
        i18n.t('actions.error') || 'Error',
        i18n.t('ringtone.error_generic') || 'No se pudo establecer el tono seleccionado.'
      );
      return false;
    }
  },
};
