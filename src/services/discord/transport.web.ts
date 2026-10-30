import { DiscordTransport } from './activity';
export const discordTransport: DiscordTransport = {
    configure: applicationId => window.mmplayer.invoke('discordPresence', { op: 'configure', applicationId }),
    async setActivity(activity) { await window.mmplayer.invoke('discordPresence', { op: 'activity', activity }); },
    async disconnect() { await window.mmplayer.invoke('discordPresence', { op: 'disconnect' }); },
};
