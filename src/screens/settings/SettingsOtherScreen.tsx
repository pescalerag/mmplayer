import React from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeaderLayout } from '../../components/layouts/ScreenHeaderLayout';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDiscordPresenceStatus } from '../../services/DiscordPresenceService';

export default function SettingsOtherScreen() {
    const { t } = useTranslation();
    const { colors, fonts } = useAppTheme();
    const enabled = useSettingsStore(state => state.discordRichPresenceEnabled);
    const setEnabled = useSettingsStore(state => state.setDiscordRichPresenceEnabled);
    const status = useDiscordPresenceStatus(state => state.status);
    return <ScreenHeaderLayout title={t('discord.other_settings')}>
        {({ headerHeight, bottomPadding }) => <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: headerHeight + 20, paddingBottom: bottomPadding }}>
            <View style={{ padding: 20, borderRadius: 20, backgroundColor: colors.cardBackground }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 16 }}>{t('discord.title')}</Text>
                        <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13, marginTop: 6 }}>{t('discord.description')}</Text>
                    </View>
                    <Switch testID="discord-presence-toggle" accessibilityLabel={t('discord.title')} value={enabled} onValueChange={setEnabled}
                        trackColor={{ false: '#555', true: colors.accent }} thumbColor="#FFFFFF" />
                </View>
                {enabled && <Text testID="discord-presence-status" style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 16 }}>{t('discord.status_' + status)}</Text>}
            </View>
        </ScrollView>}
    </ScreenHeaderLayout>;
}
