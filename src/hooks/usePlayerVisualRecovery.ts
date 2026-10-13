import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// Refresh native visuals once after returning from the background. If another
// screen is open, defer the refresh until PlayerScreen becomes visible.
export function usePlayerVisualRecovery(isFocused: boolean) {
    const [revision, setRevision] = useState(0);
    const previousState = useRef(AppState.currentState);
    const pending = useRef(false);

    useEffect(() => {
        const refreshIfVisible = () => {
            if (isFocused && AppState.currentState === 'active' && pending.current) {
                pending.current = false;
                setRevision(value => value + 1);
            }
        };
        refreshIfVisible();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active' && previousState.current !== 'active') {
                pending.current = true;
            }
            previousState.current = state;
            refreshIfVisible();
        });
        return () => subscription.remove();
    }, [isFocused]);

    return revision;
}
