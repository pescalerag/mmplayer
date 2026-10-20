import { AppState } from 'react-native';
import { LibraryRefreshService } from './LibraryRefreshService';
import { usePlayerStore } from '../store/usePlayerStore';

/** Foregrounding restores transport state; only a fresh session starts a scan. */
export function subscribeApplicationLifecycle(): () => void {
    void LibraryRefreshService.startup().catch(error => console.error('Initial library scan failed:', error));
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
        if (/inactive|background/.test(previous) && next === 'active') {
            void usePlayerStore.getState().syncWithTrackPlayer().catch(() => {});
        } else if (/inactive|background/.test(next)) {
            void usePlayerStore.getState().savePlaybackState().catch(() => {});
        }
        previous = next;
    });
    return () => subscription.remove();
}
