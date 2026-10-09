import { InteractionManager } from 'react-native';

/** Allow the new screen to paint before starting its database refresh. */
export function scheduleScreenRefresh(refresh: () => void): () => void {
    let cancelled = false;
    let task: ReturnType<typeof InteractionManager.runAfterInteractions> | undefined;
    let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
            if (cancelled) return;
            task = InteractionManager.runAfterInteractions(() => {
                if (!cancelled) refresh();
            });
        });
    });
    return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        task?.cancel();
    };
}
