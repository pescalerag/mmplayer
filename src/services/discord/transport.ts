import { NativeModules, Platform } from 'react-native';
import { DiscordTransport, validApplicationId } from './activity';

/** Android SDK bridge boundary; never falls back to logging in with a Discord user token. */
export const discordTransport: DiscordTransport = {
    async configure(applicationId) {
        if (!validApplicationId(applicationId)) return 'needs_application_id';
        const native = NativeModules.MMPlayerDiscordPresence;
        if (Platform.OS !== 'android' || !native) return 'native_unavailable';
        return await native.configure(applicationId);
    },
    async setActivity(activity) {
        const native = NativeModules.MMPlayerDiscordPresence;
        if (native) await native.setActivity(activity);
    },
    async disconnect() {
        const native = NativeModules.MMPlayerDiscordPresence;
        if (native) await native.disconnect();
    },
};
