import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useMultipleQueuesStore } from '../../store/useMultipleQueuesStore';
import { useCastStore } from '../../store/useCastStore';
import { MultipleQueuesService } from '../../services/MultipleQueuesService';
import { useToastStore } from '../../store/useToastStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useQueueRenameModalStore } from '../../store/useQueueRenameModalStore';

const SELECTOR_VERTICAL_SPACING = 16;

export function QueueSelector() {
    const { t } = useTranslation();
    const { colors, fonts } = useAppTheme();
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const names = useMultipleQueuesStore(useShallow(state => state.slots.map(slot => slot.name)));
    const activeId = useMultipleQueuesStore(state => state.activeId);
    const isSwitching = useMultipleQueuesStore(state => state.isSwitching);
    const editingQueue = useMultipleQueuesStore(state => state.pendingEdits > 0);
    const casting = useCastStore(state => state.isLocalCastActive || state.isServerRunning);
    const loading = usePlayerStore(state => state.isQueueLoading);
    const [expanded, setExpanded] = useState(false);
    const [dropdownTop, setDropdownTop] = useState(0);
    const label = (id: number) => names[id] || t('queue.slot_name', { number: id + 1 });
    const disabled = casting || isSwitching || loading || editingQueue;
    const menuMaxHeight = Math.max(0, Math.min(height * 0.92, height - insets.top - 8) - dropdownTop - insets.bottom - 12);
    const select = async (id: number) => {
        setExpanded(false);
        try { await MultipleQueuesService.switchQueue(id); }
        catch { useToastStore.getState().showToast(t('queue.switch_error'), 'warning'); }
    };
    const reset = async () => {
        try { await MultipleQueuesService.resetAllQueues(); }
        catch { useToastStore.getState().showToast(t('queue.reset_all_error'), 'warning'); }
    };
    const confirmReset = () => {
        setExpanded(false);
        Alert.alert(t('queue.reset_all'), t('queue.reset_all_confirm'), [
            { text: t('actions.cancel'), style: 'cancel' },
            { text: t('queue.reset_all'), style: 'destructive', onPress: () => void reset() },
        ]);
    };
    return <>
    <View onLayout={event => setDropdownTop(event.nativeEvent.layout.y + event.nativeEvent.layout.height - SELECTOR_VERTICAL_SPACING + 4)}
        style={{ paddingVertical: SELECTOR_VERTICAL_SPACING, marginHorizontal: 24, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity disabled={disabled} accessibilityRole="button" accessibilityLabel={t('queue.select_queue')}
                accessibilityState={{ disabled, expanded }} onPress={() => setExpanded(!expanded)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardBackground, borderRadius: 10, padding: 12, opacity: disabled ? 0.5 : 1 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontFamily: fonts.regular }}>{label(activeId)}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity disabled={isSwitching} accessibilityLabel={t('queue.rename_title')} onPress={() => { setExpanded(false); useQueueRenameModalStore.getState().open(activeId); }} style={{ padding: 12 }}>
                <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
        {casting && <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 6 }}>{t('queue.cast_switch_disabled')}</Text>}
    </View>
    {expanded && !disabled && <View style={[StyleSheet.absoluteFill, { zIndex: 20, elevation: 20 }]}>
        <Pressable onPress={() => setExpanded(false)} style={StyleSheet.absoluteFill} accessibilityLabel={t('actions.cancel')} />
        <View style={{ position: 'absolute', top: dropdownTop, left: 24, right: 76, maxHeight: menuMaxHeight, elevation: 12, backgroundColor: colors.cardBackground, borderRadius: 10, overflow: 'hidden' }}>
            <ScrollView bounces={false} style={{ flexGrow: 0 }}>
            {names.map((_, id) => <TouchableOpacity key={id} onPress={() => void select(id)} accessibilityRole="radio" accessibilityState={{ checked: id === activeId }}
                style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ color: colors.text, flex: 1, fontFamily: fonts.regular }}>{label(id)}</Text>
                {id === activeId && <Ionicons name="checkmark" size={18} color={colors.accent} />}
            </TouchableOpacity>)}
            <TouchableOpacity onPress={confirmReset} accessibilityRole="button" style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#FFFFFF20' }}>
                <Ionicons name="refresh-outline" size={18} color="#EF4444" />
                <Text style={{ color: '#EF4444', flex: 1, fontFamily: fonts.regular }}>{t('queue.reset_all')}</Text>
            </TouchableOpacity>
            </ScrollView>
        </View>
    </View>}
    </>;
}
