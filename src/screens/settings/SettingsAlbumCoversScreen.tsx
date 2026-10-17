import React from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeaderLayout } from '../../components/layouts/ScreenHeaderLayout';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSyncStore } from '../../store/useSyncStore';
import { AlbumCoverService } from '../../services/AlbumCoverService';

export default function SettingsAlbumCoversScreen() {
    const { t } = useTranslation();
    const { colors, fonts } = useAppTheme();
    const background = useSettingsStore(state => state.albumCoverBackgroundDownload);
    const setBackground = useSettingsStore(state => state.setAlbumCoverBackgroundDownload);
    const downloading = useSyncStore(state => state.isDownloadingAlbumCovers);
    const progress = useSyncStore(state => state.albumCoverProgress);
    const download = async () => {
        try {
            const summary = await AlbumCoverService.processMissingAlbumCovers();
            Alert.alert(t('settings.album_covers_title'), t('settings.album_covers_result', { ...summary }));
        } catch {
            Alert.alert(t('common.error'), t('settings.album_covers_error'));
        }
    };
    return <ScreenHeaderLayout title={t('settings.album_covers_title')}>
        {({ headerHeight, bottomPadding }) => <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: headerHeight + 20, paddingBottom: bottomPadding + 20 }}>
            <View style={{ padding: 18, borderRadius: 14, backgroundColor: colors.cardBackground, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 16 }}>{t('settings.album_covers_background')}</Text>
                    <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, marginTop: 8 }}>{t('settings.album_covers_background_desc')}</Text>
                </View>
                <Switch value={background} onValueChange={setBackground} accessibilityLabel={t('settings.album_covers_background')}
                    trackColor={{ false: '#282828', true: colors.accent }} thumbColor={background ? '#fff' : '#888'} />
            </View>
            <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, marginVertical: 24 }}>{t('settings.album_covers_desc')}</Text>
            <TouchableOpacity disabled={downloading} accessibilityRole="button" onPress={() => void download()}
                style={{ padding: 16, borderRadius: 12, backgroundColor: colors.accent, opacity: downloading ? 0.6 : 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                {downloading && <ActivityIndicator color={colors.onAccent} />}
                <Text style={{ color: colors.onAccent, fontFamily: fonts.bold }}>{downloading ? t('settings.album_covers_progress', progress) : t('settings.album_covers_download')}</Text>
            </TouchableOpacity>
        </ScrollView>}
    </ScreenHeaderLayout>;
}
