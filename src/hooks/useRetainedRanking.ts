import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Observable, Subscription } from 'rxjs';
import { observeTableChanges } from '../services/ScreenDataChanges';
import { useSettingsStore } from '../store/useSettingsStore';
import { useDelayedLoader } from './useDelayedLoader';
import { scheduleScreenRefresh } from '../utils/scheduleScreenRefresh';

/** Keep the last ranking on blur, reconnect its DB queries only when dirty. */
export function useRetainedRanking<T>(source: () => Observable<T>, tables: readonly string[], initial: () => T, enabled: boolean) {
    const navigation = useNavigation();
    const [data, setData] = useState(initial);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt(value => value + 1), []);
    const loaded = useRef(false);
    const dirty = useRef(true);
    const lastAttempt = useRef(0);
    const visible = useRef(navigation.isFocused());
    const connectRef = useRef<() => void>(() => {});
    const tableKey = tables.join('|');
    useEffect(() => {
        if (!enabled) return;
        const invalidate = () => { dirty.current = true; if (visible.current) connectRef.current(); };
        const subscription = observeTableChanges(tableKey.split('|')).subscribe(invalidate);
        const unsubscribe = useSettingsStore.subscribe((state, previous) => {
            if (state.excludedSongs !== previous.excludedSongs) invalidate();
        });
        return () => { subscription.unsubscribe(); unsubscribe(); dirty.current = true; };
    }, [enabled, tableKey]);
    useEffect(() => {
        if (!enabled) return;
        let subscription: Subscription | undefined;
        let cancelScheduled: (() => void) | undefined;
        let disposed = false;
        const connect = () => {
            if (disposed || !visible.current || cancelScheduled || (subscription && !subscription.closed)) return;
            cancelScheduled = scheduleScreenRefresh(() => {
                cancelScheduled = undefined;
                if (disposed) return;
                setLoading(!loaded.current); setError(false);
                subscription = source().subscribe({
                    next: value => { loaded.current = true; dirty.current = false; setData(value); setLoading(false); },
                    error: () => { dirty.current = true; setError(true); setLoading(false); },
                });
            });
        };
        connectRef.current = connect;
        if (lastAttempt.current !== attempt) { lastAttempt.current = attempt; dirty.current = true; }
        const focus = () => { visible.current = true; if (dirty.current) connect(); };
        const blur = () => {
            visible.current = false;
            cancelScheduled?.(); cancelScheduled = undefined;
            subscription?.unsubscribe(); subscription = undefined;
        };
        const unsubscribeFocus = navigation.addListener('focus', focus);
        const unsubscribeBlur = navigation.addListener('blur', blur);
        visible.current = navigation.isFocused();
        if (visible.current && dirty.current) connect();
        return () => { disposed = true; blur(); unsubscribeFocus(); unsubscribeBlur(); connectRef.current = () => {}; };
    }, [enabled, navigation, attempt, source]);
    const showLoader = useDelayedLoader(enabled && loading, { delay: 250, minDisplayTime: 0 });
    return { data, error, loading: enabled && loading, showLoader, retry };
}
