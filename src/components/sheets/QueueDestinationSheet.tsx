import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { useSheetProps } from '../../hooks/useSheetProps';
import Track from '../../database/models/Track';
import { useMultipleQueuesStore } from '../../store/useMultipleQueuesStore';
import { MultipleQueuesService } from '../../services/MultipleQueuesService';
import { BaseMenuSheet, MenuOption } from './BaseMenuSheet';
import { useToastStore } from '../../store/useToastStore';

export default function QueueDestinationSheet() {
    const { t } = useTranslation();
    const { props: { tracks = [], onAdded }, close } = useSheetProps<{ tracks: Track[]; onAdded?: () => void }>('queue-destination');
    const names = useMultipleQueuesStore(useShallow(state => state.slots.map(slot => slot.name)));
    const activeId = useMultipleQueuesStore(state => state.activeId);
    const isSwitching = useMultipleQueuesStore(state => state.isSwitching);
    const [busy, setBusy] = useState(false);
    const add = async (id: number) => {
        if (busy) return;
        setBusy(true);
        try {
            await MultipleQueuesService.addToQueue(id, tracks);
            onAdded?.(); close();
            useToastStore.getState().showToast(t('queue.added_to', { name: names[id] || t('queue.slot_name', { number: id + 1 }) }), 'list');
        } catch { useToastStore.getState().showToast(t('queue.switch_error'), 'warning'); }
        finally { setBusy(false); }
    };
    return <BaseMenuSheet title={t('queue.add_to_other')}>
        {names.map((name, id) => id !== activeId && <MenuOption key={id} icon="list" disabled={busy || isSwitching}
            text={name || t('queue.slot_name', { number: id + 1 })} onPress={() => add(id)} />)}
    </BaseMenuSheet>;
}
