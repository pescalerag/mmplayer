import { PermissionsAndroid, Platform } from 'react-native';

export type AudioPermissionStatus = 'granted' | 'denied' | 'never_ask_again';

export class PermissionService {
    /**
     * Checks whether the required audio permission is already granted.
     * - Android 13+ (API 33+): checks READ_MEDIA_AUDIO
     * - Android 12 and below: checks READ_EXTERNAL_STORAGE
     * - Other platforms (iOS/Web): returns true
     */
    static async checkAudioPermission(): Promise<boolean> {
        if (Platform.OS !== 'android') return true;

        const permission = Platform.Version >= 33
            ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
            : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

        return await PermissionsAndroid.check(permission);
    }

    /**
     * Requests the required audio permission from the user.
     * - Android 13+ (API 33+): requests READ_MEDIA_AUDIO
     * - Android 12 and below: requests READ_EXTERNAL_STORAGE
     *
     * Never requests READ_MEDIA_IMAGES or READ_MEDIA_VIDEO, complying with
     * Google Play's Photo and Video Permissions policy.
     */
    static async requestAudioPermission(): Promise<AudioPermissionStatus> {
        if (Platform.OS !== 'android') return 'granted';

        const permission = Platform.Version >= 33
            ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
            : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

        const hasPermission = await PermissionsAndroid.check(permission);
        if (hasPermission) return 'granted';

        const result = await PermissionsAndroid.request(permission);
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
            return 'granted';
        }
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            return 'never_ask_again';
        }
        return 'denied';
    }
}
