import { useRef } from 'react';
import { createCascadeEntry } from '../utils/cascadeAnimations';

export function useCascadeEntry(key?: unknown) {
    const previousKey = useRef(key);
    const entry = useRef<ReturnType<typeof createCascadeEntry> | null>(null);
    if (entry.current === null || !Object.is(previousKey.current, key)) {
        entry.current = createCascadeEntry();
        previousKey.current = key;
    }
    return entry.current;
}
