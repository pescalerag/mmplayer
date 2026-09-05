import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TrackPlayer from 'react-native-track-player';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BaseMenuSheet, MenuOption } from '@/components/sheets/BaseMenuSheet';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';

export default function QueueManageSheet() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const closeSheet = useUIStore(state => state.closeSheet);

    const clearPlayer = usePlayerStore(state => state.clearPlayer);
    const clearUserQueue = usePlayerStore(state => state.clearUserQueue);
    const clearContextQueue = usePlayerStore(state => state.clearContextQueue);
    const isQueueLoading = usePlayerStore(state => state.isQueueLoading);

    const [hasManualUpcoming, setHasManualUpcoming] = useState(false);
    const [hasContextUpcoming, setHasContextUpcoming] = useState(false);

    useEffect(() => {
        let isMounted = true;
        Promise.all([
            TrackPlayer.getQueue(),
            TrackPlayer.getActiveTrackIndex(),
        ]).then(([queue, activeIndex]) => {
            if (!isMounted) return;
            const idx = activeIndex ?? -1;
            const upcoming = idx >= 0 && queue ? queue.slice(idx + 1) : [];
            setHasManualUpcoming(upcoming.some(t => (t as any).isManual === true));
            setHasContextUpcoming(upcoming.some(t => !(t as any).isManual));
        }).catch(() => {});

        return () => {
            isMounted = false;
        };
    }, []);

    const handleClearManual = async () => {
        closeSheet();
        await clearUserQueue();
    };

    const handleClearContext = async () => {
        closeSheet();
        await clearContextQueue();
    };

    const handleStopPlayback = async () => {
        closeSheet();
        await clearPlayer();
    };

    return (
        <BaseMenuSheet
            title={t('queue.manage') || 'Gestionar cola'}
            subtitle={t('queue.what_to_do') || '¿Qué deseas hacer?'}
        >
            {hasManualUpcoming && (
                <MenuOption
                    icon="list-outline"
                    text={t('queue.clear_manual') || 'Borrar la cola añadida'}
                    onPress={handleClearManual}
                />
            )}

            {(hasContextUpcoming || isQueueLoading) && (
                <MenuOption
                    icon="albums-outline"
                    text={t('queue.clear_context') || 'Borrar contexto'}
                    onPress={handleClearContext}
                />
            )}

            <MenuOption
                icon="stop-circle-outline"
                text={t('queue.stop_playback') || 'Parar la reproducción'}
                iconColor={colors.heartIcon || '#EF4444'}
                textStyle={{ color: colors.heartIcon || '#EF4444' }}
                onPress={handleStopPlayback}
            />
        </BaseMenuSheet>
    );
}
