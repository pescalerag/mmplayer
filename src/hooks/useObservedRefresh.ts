import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';
import { observeTableChanges } from '../services/ScreenDataChanges';
import { ObservedRefresh } from '../utils/observedRefresh';
import { scheduleScreenRefresh } from '../utils/scheduleScreenRefresh';
import { useSyncStore } from '../store/useSyncStore';
import { useBackupStore } from '../store/useBackupStore';

/** Retain the UI; only refresh dirty data while the screen is visible. */
export function useObservedRefresh(load: (signal: AbortSignal) => Promise<unknown> | void, tables: readonly string[], enabled = true) {
    const navigation = useNavigation();
    const focusedRef = useRef(navigation.isFocused());
    const tableKey = tables.join('|');
    useEffect(() => {
        if (!enabled) return;
        const refresh = new ObservedRefresh(load, scheduleScreenRefresh, error => console.error('[ObservedRefresh]', error));
        focusedRef.current = navigation.isFocused();
        const updateVisibility = () => {
            const mode = useBackupStore.getState().mode;
            refresh.setBusy(useSyncStore.getState().isScanning || mode === 'importing' || mode === 'reconciling');
            refresh.setVisible(focusedRef.current && AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
        };
        // Focus controls background work, not rendering. useIsFocused would
        // rebuild each consuming screen on every tab press even when clean.
        const unsubscribeFocus = navigation.addListener('focus', () => { focusedRef.current = true; updateVisibility(); });
        const unsubscribeBlur = navigation.addListener('blur', () => { focusedRef.current = false; updateVisibility(); });
        const unsubscribeScan = useSyncStore.subscribe((state, previous) => {
            if (state.isScanning !== previous.isScanning) updateVisibility();
        });
        const unsubscribeBackup = useBackupStore.subscribe((state, previous) => {
            if (state.mode !== previous.mode) updateVisibility();
        });
        let day = new Date().toDateString();
        const checkDate = () => {
            const next = new Date().toDateString();
            if (day !== next) { day = next; refresh.invalidate(); }
        };
        const subscription = observeTableChanges(tableKey.split('|').filter(Boolean)).subscribe(() => refresh.invalidate());
        const appState = AppState.addEventListener('change', state => {
            if (state === 'active') checkDate();
            refresh.setVisible(focusedRef.current && state === 'active');
        });
        // Time-based lists must change at midnight even without a DB write.
        const midnightCheck = setInterval(checkDate, 60_000);
        updateVisibility();
        return () => { refresh.dispose(); subscription.unsubscribe(); unsubscribeFocus(); unsubscribeBlur(); unsubscribeScan(); unsubscribeBackup(); appState.remove(); clearInterval(midnightCheck); };
    }, [load, tableKey, enabled, navigation]);
}
