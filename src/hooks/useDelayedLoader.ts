import { useState, useEffect, useRef } from 'react';
import { DelayedLoaderController, DelayedLoaderOptions } from '../utils/delayedLoader';

export type { DelayedLoaderOptions };

/**
 * Delayed Loader Pattern Hook (Loader Retrasado).
 *
 * 1. Delays loader display for `delay` ms: Fast devices / cached queries that finish
 *    within the window never show a loader or flash.
 * 2. Minimum Display Time: If the loader does show (because delay threshold was exceeded),
 *    it remains on screen for at least `minDisplayTime` ms before smoothly transitioning
 *    out, preventing jarring 10-20ms flashes.
 *
 * @param isLoading Whether data is currently loading
 * @param options Configuration for delay and minimum display time
 * @returns boolean indicating whether the loader / skeleton should be rendered
 */
export function useDelayedLoader(
  isLoading: boolean,
  options: DelayedLoaderOptions = {}
): boolean {
  const [showLoader, setShowLoader] = useState(false);
  const controllerRef = useRef<DelayedLoaderController | null>(null);

  controllerRef.current ??= new DelayedLoaderController(setShowLoader, options);

  useEffect(() => {
    if (isLoading) {
      controllerRef.current?.startLoading();
    } else {
      controllerRef.current?.stopLoading();
    }
  }, [isLoading]);

  useEffect(() => {
    return () => {
      controllerRef.current?.destroy();
    };
  }, []);

  return showLoader;
}

export default useDelayedLoader;
